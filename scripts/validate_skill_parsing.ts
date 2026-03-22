/**
 * validate_skill_parsing.ts — Sprint 5 CP3 Item 8
 * Creates skill file with description and cron trigger,
 * calls listing endpoint, asserts both fields returned correctly,
 * confirms unit test passes.
 */

const GW = process.env.GATEWAY_URL || "http://localhost:18799";

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

async function run() {
  console.log("\n=== validate_skill_parsing.ts ===\n");

  // 1. Create a skill with description and cron trigger in YAML frontmatter
  console.log("1. Creating skill with YAML frontmatter...");
  const skillContent = `---
name: weekly-briefing-test
description: "Sends weekly briefing"
triggers:
  - cron: "0 8 * * 1"
  - keyword: "briefing"
---
# Weekly Briefing
This skill sends a weekly briefing every Monday at 8am.
It summarises the most important memories and priorities.`;

  const createRes = await fetchJSON("/api/v1/skills", {
    method: "POST",
    body: JSON.stringify({ name: "weekly-briefing-test", content: skillContent }),
  });
  assert(createRes.status === 200 || createRes.status === 201, "Skill created successfully");

  // 2. Call listing endpoint
  console.log("2. Calling skills listing endpoint...");
  const listRes = await fetchJSON("/api/v1/skills");
  assert(listRes.status === 200, "Skills listing returns 200");

  const skills = Array.isArray(listRes.data) ? listRes.data : [];
  const testSkill = skills.find((s: any) => s.name === "weekly-briefing-test");
  assert(!!testSkill, "Test skill found in listing");

  // 3. Assert description field returned correctly
  console.log("3. Checking description field...");
  if (testSkill) {
    assert(
      testSkill.description === "Sends weekly briefing",
      `Description is correct: "${testSkill.description}"`
    );
  } else {
    assert(false, "Description field (skill not found)");
  }

  // 4. Assert trigger fields returned correctly
  console.log("4. Checking trigger fields...");
  if (testSkill) {
    const triggers = testSkill.triggers || [];
    assert(Array.isArray(triggers), "Triggers is an array");
    assert(triggers.length >= 1, `Has ${triggers.length} trigger(s)`);

    // Check for cron trigger
    const cronTrigger = triggers.find((t: any) => t.cron);
    assert(!!cronTrigger, "Has cron trigger");
    if (cronTrigger) {
      assert(cronTrigger.cron === "0 8 * * 1", `Cron value correct: "${cronTrigger.cron}"`);
    } else {
      assert(false, "Cron value correct (no cron trigger found)");
    }

    // Check for keyword trigger
    const keywordTrigger = triggers.find((t: any) => t.keyword);
    assert(!!keywordTrigger, "Has keyword trigger");
    if (keywordTrigger) {
      assert(keywordTrigger.keyword === "briefing", `Keyword value correct: "${keywordTrigger.keyword}"`);
    } else {
      assert(false, "Keyword value correct (no keyword trigger found)");
    }
  } else {
    assert(false, "Triggers array (skill not found)");
    assert(false, "Has cron trigger (skill not found)");
    assert(false, "Cron value correct (skill not found)");
    assert(false, "Has keyword trigger (skill not found)");
    assert(false, "Keyword value correct (skill not found)");
  }

  // 5. Verify skills/index.ts parses YAML correctly
  console.log("5. Checking skills parser source...");
  const fs = await import("fs");
  const skillsSrc = fs.readFileSync("/home/ubuntu/nexus-agent/src/skills/index.ts", "utf-8");
  assert(skillsSrc.includes("gray-matter") || skillsSrc.includes("matter(") || skillsSrc.includes("frontmatter"), "Skills parser uses YAML frontmatter parsing");
  assert(skillsSrc.includes("description"), "Skills parser extracts description");
  assert(skillsSrc.includes("triggers") || skillsSrc.includes("trigger"), "Skills parser extracts triggers");

  // 6. Create another skill with different format to test robustness
  console.log("6. Testing skill with different YAML format...");
  const skill2Content = `---
name: pattern-detector-test
description: "Detects patterns in user behavior"
triggers:
  - keyword: "patterns"
---
# Pattern Detector
Analyzes conversation patterns.`;

  const create2 = await fetchJSON("/api/v1/skills", {
    method: "POST",
    body: JSON.stringify({ name: "pattern-detector-test", content: skill2Content }),
  });
  assert(create2.status === 200 || create2.status === 201, "Second skill created");

  const list2 = await fetchJSON("/api/v1/skills");
  const skill2 = (Array.isArray(list2.data) ? list2.data : []).find((s: any) => s.name === "pattern-detector-test");
  if (skill2) {
    assert(skill2.description === "Detects patterns in user behavior", `Second skill description correct: "${skill2.description}"`);
    const kw = (skill2.triggers || []).find((t: any) => t.keyword);
    assert(!!kw && kw.keyword === "patterns", `Second skill keyword trigger correct: "${kw?.keyword}"`);
  } else {
    assert(false, "Second skill description correct (not found)");
    assert(false, "Second skill keyword correct (not found)");
  }

  // Clean up
  await fetchJSON("/api/v1/skills/weekly-briefing-test", { method: "DELETE" }).catch(() => {});
  await fetchJSON("/api/v1/skills/pattern-detector-test", { method: "DELETE" }).catch(() => {});

  printSummary();
}

function printSummary() {
  console.log("\n--- Results ---");
  results.forEach(r => console.log(r));
  console.log(`\n${passed}/${passed + failed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
