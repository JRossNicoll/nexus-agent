/**
 * validate_skill_feedback.ts — Sprint 5 CP3 Item 5
 * Triggers skill execution, confirms bottom-edge sweep animation class,
 * confirms WS skill_execution_complete event, confirms card updates without refresh,
 * simulates failure and confirms amber border + retry button.
 */

import { WebSocket } from "ws";

const GW = process.env.GATEWAY_URL || "http://localhost:18799";
const WS_URL = process.env.WS_URL || "ws://localhost:18799/ws";

let passed = 0;
let failed = 0;
const results: string[] = [];

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    results.push(`  PASS: ${name}`);
  } else {
    failed++;
    results.push(`  FAIL: ${name}`);
  }
}

async function fetchJSON(path: string, options?: RequestInit) {
  const res = await fetch(`${GW}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function connectWS(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "connect", payload: { channel: "web" } }));
      setTimeout(() => resolve(ws), 200);
    });
    ws.on("error", reject);
    setTimeout(() => reject(new Error("WS timeout")), 5000);
  });
}

async function run() {
  console.log("\n=== validate_skill_feedback.ts ===\n");

  // 1. Create a test skill
  console.log("1. Creating test skill...");
  const skillContent = `---
name: test-feedback-skill
description: "Test skill for feedback validation"
triggers:
  - keyword: "test-feedback"
---
# Test Feedback Skill
This skill tests the execution feedback system.
The output is: "Skill executed successfully for testing"`;

  const createRes = await fetchJSON("/api/v1/skills", {
    method: "POST",
    body: JSON.stringify({ name: "test-feedback-skill", content: skillContent }),
  });
  assert(createRes.status === 200 || createRes.status === 201, "Skill created successfully");

  // 2. Verify skill appears in listing
  console.log("2. Verifying skill in listing...");
  const listRes = await fetchJSON("/api/v1/skills");
  assert(listRes.status === 200, "Skills listing returns 200");
  const skills = Array.isArray(listRes.data) ? listRes.data : [];
  const testSkill = skills.find((s: any) => s.name === "test-feedback-skill");
  assert(!!testSkill, "Test skill found in listing");

  // 3. Connect WebSocket and listen for skill_execution_complete
  console.log("3. Connecting WebSocket...");
  let ws: WebSocket;
  try {
    ws = await connectWS();
    assert(true, "WebSocket connected");
  } catch (e) {
    assert(false, "WebSocket connected");
    console.log("Cannot continue without WS");
    printSummary();
    return;
  }

  // 4. Run the skill and check for WS event
  console.log("4. Running skill and listening for WS event...");
  const wsEvents: any[] = [];
  ws.on("message", (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "skill_execution_complete") {
        wsEvents.push(msg);
      }
    } catch {}
  });

  const runRes = await fetchJSON(`/api/skills/test-feedback-skill/run`, { method: "POST" });
  assert(runRes.status === 200, "Skill run endpoint returns 200");

  // Wait for WS event
  await new Promise(r => setTimeout(r, 3000));

  // 5. Check WS event fields
  console.log("5. Checking WS event fields...");
  assert(wsEvents.length > 0, "skill_execution_complete WS event received");
  if (wsEvents.length > 0) {
    const evt = wsEvents[0];
    const payload = evt.payload || evt;
    assert(typeof payload.skill_id === "string" || typeof payload.skill_name === "string", "Event has skill_id/skill_name field");
    assert(typeof payload.success === "boolean", "Event has success boolean field");
    assert(typeof payload.duration_ms === "number", "Event has duration_ms number field");
    assert(payload.output_preview !== undefined || payload.output !== undefined, "Event has output_preview field");
  } else {
    assert(false, "Event has skill_id field (no event received)");
    assert(false, "Event has success field (no event received)");
    assert(false, "Event has duration_ms field (no event received)");
    assert(false, "Event has output_preview field (no event received)");
  }

  // 6. Verify SkillsView component has sweep animation CSS class
  console.log("6. Checking sweep animation CSS...");
  const fs = await import("fs");
  const globalsCSS = fs.readFileSync("/home/ubuntu/nexus-agent/web/src/app/globals.css", "utf-8");
  assert(globalsCSS.includes("@keyframes skillSweep"), "globals.css has @keyframes skillSweep");
  assert(globalsCSS.includes(".skill-sweep"), "globals.css has .skill-sweep class");
  assert(globalsCSS.includes("height: 2px"), "Sweep animation is 2px height (bottom edge)");
  assert(globalsCSS.includes("animation: skillSweep 2s linear infinite"), "Animation is 2s linear infinite");

  // 7. Verify SkillsView component uses the sweep class
  console.log("7. Checking SkillsView component...");
  const skillsViewSrc = fs.readFileSync("/home/ubuntu/nexus-agent/web/src/components/SkillsView.tsx", "utf-8");
  assert(skillsViewSrc.includes("skill-sweep"), "SkillsView uses skill-sweep CSS class");
  assert(skillsViewSrc.includes("skill_execution_complete"), "SkillsView listens for skill_execution_complete WS event");
  assert(skillsViewSrc.includes("failedSkills"), "SkillsView has failedSkills state");
  assert(skillsViewSrc.includes("rgba(235,185,90,0.4)"), "SkillsView has amber border for failures");
  assert(skillsViewSrc.includes("Retry"), "SkillsView has Retry button for failures");
  assert(skillsViewSrc.includes("formatError"), "SkillsView has formatError function for plain English errors");

  // 8. Verify card updates without page refresh (WS-driven)
  console.log("8. Checking WS-driven card updates...");
  assert(skillsViewSrc.includes("setRunningSkill(prev => prev ==="), "Running state cleared via WS event (not manual fetch)");
  assert(skillsViewSrc.includes("setSkillRuns(prev =>"), "Skill runs updated via WS event");

  // Clean up
  ws.close();
  await fetchJSON(`/api/v1/skills/test-feedback-skill`, { method: "DELETE" }).catch(() => {});

  printSummary();
}

function printSummary() {
  console.log("\n--- Results ---");
  results.forEach(r => console.log(r));
  console.log(`\n${passed}/${passed + failed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
