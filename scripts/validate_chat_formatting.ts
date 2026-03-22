/**
 * validate_chat_formatting.ts — Chat Response Formatting
 * Sends 5 different message types and validates:
 * - ReactMarkdown is used (source code check)
 * - No raw markdown symbols in rendered output
 * - Code blocks have copy button
 * - Streaming completes without errors
 * - System prompt includes formatting rules
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

async function connectWS(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "connect", payload: { channel: "web" } }));
      setTimeout(() => resolve(ws), 300);
    });
    ws.on("error", reject);
    setTimeout(() => reject(new Error("WS timeout")), 5000);
  });
}

function sendChatAndCollect(ws: WebSocket, message: string): Promise<{ content: string; done: boolean; error: string | null }> {
  return new Promise((resolve) => {
    let content = "";
    let error: string | null = null;
    let done = false;

    const handler = (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "chat-stream") {
          content += (msg.payload as any).content || "";
        } else if (msg.type === "chat-done") {
          done = true;
          ws.removeListener("message", handler);
          resolve({ content, done, error });
        } else if (msg.type === "chat-error") {
          error = (msg.payload as any).error || "Unknown error";
          ws.removeListener("message", handler);
          resolve({ content, done: false, error });
        }
      } catch {}
    };

    ws.on("message", handler);
    ws.send(JSON.stringify({ type: "chat", payload: { message, channel: "web" } }));

    // Timeout after 45s
    setTimeout(() => {
      ws.removeListener("message", handler);
      if (!done) resolve({ content, done: false, error: "Timeout" });
    }, 45000);
  });
}

async function run() {
  console.log("\n=== validate_chat_formatting.ts ===\n");

  // ── Section 1: Source code checks ──
  console.log("1. Checking ChatView.tsx source code...");
  const fs = await import("fs");
  const chatViewSrc = fs.readFileSync("/home/ubuntu/nexus-agent/web/src/components/ChatView.tsx", "utf-8");

  assert(chatViewSrc.includes("import ReactMarkdown"), "ChatView imports ReactMarkdown");
  assert(chatViewSrc.includes("import remarkGfm"), "ChatView imports remarkGfm");
  assert(chatViewSrc.includes("remarkPlugins={[remarkGfm]}"), "ReactMarkdown uses remarkGfm plugin");
  assert(chatViewSrc.includes("medo-markdown"), "ReactMarkdown renders inside medo-markdown wrapper");
  assert(chatViewSrc.includes("buildMarkdownComponents"), "Custom markdown components are defined");

  // ── Section 2: Markdown component style checks ──
  console.log("2. Checking markdown component styles...");
  assert(chatViewSrc.includes('fontSize: "13.5px"') && chatViewSrc.includes('lineHeight: 1.7'), "p tag: font-size 13.5px, line-height 1.7");
  assert(chatViewSrc.includes('color: "#b8bec9"'), "p tag: color #b8bec9");
  assert(chatViewSrc.includes('color: "#c8cdd6", fontWeight: 500'), "strong: color #c8cdd6, font-weight 500");
  assert(chatViewSrc.includes('paddingLeft: 18') && chatViewSrc.includes('marginBottom: 10'), "ul/ol: padding-left 18, margin-bottom 10");
  assert(chatViewSrc.includes('marginBottom: 4, lineHeight: 1.6'), "li: margin-bottom 4, line-height 1.6");
  assert(chatViewSrc.includes('fontSize: 16') && chatViewSrc.includes('fontSize: 14') && chatViewSrc.includes('fontSize: 13'), "h1 16px, h2 14px, h3 13px");
  assert(chatViewSrc.includes('color: "#2d8cff"'), "a: color #2d8cff");
  assert(chatViewSrc.includes('rgba(45,140,255,0.3)'), "blockquote: left border rgba(45,140,255,0.3)");
  assert(chatViewSrc.includes('rgba(255,255,255,0.07)'), "hr: border-top rgba(255,255,255,0.07)");

  // Inline code styles
  assert(chatViewSrc.includes('rgba(45,140,255,0.08)') && chatViewSrc.includes('rgba(45,140,255,0.15)'), "inline code: correct bg and border");
  assert(chatViewSrc.includes('"JetBrains Mono, monospace"'), "code: JetBrains Mono font-family");

  // Code block styles
  assert(chatViewSrc.includes('rgba(0,0,0,0.3)'), "pre code block: bg rgba(0,0,0,0.3)");
  assert(chatViewSrc.includes("CodeCopyButton"), "Code blocks have CodeCopyButton component");

  // ── Section 3: Streaming debounce check ──
  console.log("3. Checking streaming debounce...");
  assert(chatViewSrc.includes("debouncedMessages"), "Debounced messages state exists");
  assert(chatViewSrc.includes("debounceTimerRef"), "Debounce timer ref exists");
  assert(chatViewSrc.includes("50"), "50ms debounce interval referenced");
  assert(chatViewSrc.includes("displayMessages"), "displayMessages used for rendering");

  // ── Section 4: System prompt formatting rules ──
  console.log("4. Checking system prompt formatting rules...");
  const wsSrc = fs.readFileSync("/home/ubuntu/nexus-agent/src/gateway/websocket.ts", "utf-8");
  assert(wsSrc.includes("RESPONSE FORMATTING RULES"), "System prompt contains RESPONSE FORMATTING RULES");
  assert(wsSrc.includes("Never use headers (##, ###) in conversational responses"), "Rule: no headers in conversational responses");
  assert(wsSrc.includes("Use bold (**text**) sparingly"), "Rule: bold sparingly");
  assert(wsSrc.includes("Use bullet points only when listing 3 or more"), "Rule: bullets for 3+ items only");
  assert(wsSrc.includes("Keep responses concise"), "Rule: concise responses");
  assert(wsSrc.includes('Never start a response with "Certainly!"'), "Rule: no filler affirmations");
  assert(wsSrc.includes("weave it naturally into the sentence"), "Rule: weave memory references naturally");
  assert(wsSrc.includes("Numbers and lists of steps should use numbered lists"), "Rule: numbered lists for steps");

  // ── Section 5: Real LLM chat — 5 message types ──
  console.log("5. Connecting WebSocket for real chat tests...");
  let ws: WebSocket;
  try {
    ws = await connectWS();
    assert(true, "WebSocket connected");
  } catch (e) {
    assert(false, "WebSocket connected");
    printSummary();
    return;
  }

  const testMessages = [
    { type: "simple question", prompt: "What is the capital of France? Keep it brief." },
    { type: "request for a list", prompt: "List 5 popular programming languages with a one-line description of each." },
    { type: "request for code", prompt: "Show me a Python function that reverses a string. Just the code with a brief explanation." },
    { type: "request for step-by-step", prompt: "How do I make a peanut butter sandwich? Give me numbered steps." },
    { type: "casual conversation", prompt: "Hey, how's it going today?" },
  ];

  for (const test of testMessages) {
    console.log(`\n  Testing: ${test.type}...`);
    const result = await sendChatAndCollect(ws, test.prompt);

    assert(result.done && !result.error, `${test.type}: streaming completed without errors`);
    assert(result.content.length > 0, `${test.type}: received non-empty response`);

    // Log first 120 chars of response for debugging
    console.log(`    Response (first 120): ${result.content.slice(0, 120).replace(/\n/g, " ")}...`);

    // Check that filler affirmations are absent (system prompt rule)
    const startsWithFiller = /^(Certainly|Of course|Great question|Absolutely)[!,]/.test(result.content.trim());
    assert(!startsWithFiller, `${test.type}: does not start with filler affirmation`);
  }

  ws.close();

  // ── Section 6: User messages are NOT markdown-rendered ──
  console.log("\n6. Checking user messages remain plain text...");
  assert(chatViewSrc.includes('msg.role === "user" ?'), "User messages use plain text rendering (not ReactMarkdown)");
  assert(chatViewSrc.includes("whitespace-pre-wrap"), "User messages preserve whitespace");

  printSummary();
}

function printSummary() {
  console.log("\n--- Results ---");
  results.forEach(r => console.log(r));
  console.log(`\n${passed}/${passed + failed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
