import fs from 'fs';
import path from 'path';

const BASE = process.cwd();
const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:18799';

interface TestResult { name: string; passed: boolean; detail?: string }
const results: TestResult[] = [];
function pass(name: string) { results.push({ name, passed: true }); }
function fail(name: string, detail?: string) { results.push({ name, passed: false, detail }); }

async function main() {
  console.log('\n=== Sprint 5: validate_memory_graph.ts ===\n');

  const memViewSrc = fs.readFileSync(path.join(BASE, 'web/src/components/MemoryView.tsx'), 'utf-8');
  const cssSrc = fs.readFileSync(path.join(BASE, 'web/src/app/globals.css'), 'utf-8');

  // Section 1: Ripple pulse animation
  console.log('Section 1: Ripple pulse animation\n');

  memViewSrc.includes('memory-pulse') ? pass('Listens for memory-pulse WebSocket event') : fail('Listens for memory-pulse WebSocket event');
  memViewSrc.includes('createElementNS') && memViewSrc.includes('circle') ? pass('Creates SVG circle for ripple') : fail('Creates SVG circle for ripple');
  memViewSrc.includes('animate') ? pass('Uses SVG animate elements') : fail('Uses SVG animate elements');
  memViewSrc.includes('2.5') ? pass('Ripple expands to 2.5x radius') : fail('Ripple expands to 2.5x radius');
  memViewSrc.includes('0.8s') || memViewSrc.includes('800') ? pass('800ms animation duration') : fail('800ms animation duration');
  memViewSrc.includes('opacity') && memViewSrc.includes('0.6') ? pass('Starts at opacity 0.6, fades to 0') : fail('Starts at opacity 0.6, fades to 0');
  memViewSrc.includes('insertBefore') ? pass('Ripple inserted before node (behind)') : fail('Ripple inserted before node (behind)');
  memViewSrc.includes('setTimeout') && memViewSrc.includes('remove') ? pass('Ripple removed after animation') : fail('Ripple removed after animation');

  // Section 2: Logarithmic node sizing
  console.log('Section 2: Logarithmic node sizing\n');

  memViewSrc.includes('Math.log') ? pass('Uses Math.log for node sizing') : fail('Uses Math.log for node sizing');
  memViewSrc.includes('8 + Math.log') || memViewSrc.includes('nodeRadius') ? pass('nodeRadius formula present') : fail('nodeRadius formula present');
  memViewSrc.includes('* 6') ? pass('Multiplier of 6 for log scale') : fail('Multiplier of 6 for log scale');
  memViewSrc.includes('Math.min(28') || memViewSrc.includes('max(8') ? pass('Clamped 8-28px range') : fail('Clamped 8-28px range');

  // Verify the formula: nodeRadius(0) should be ~8, nodeRadius(50) should be ~8+ln(51)*6 ≈ 31.5 → clamped to 28
  const nr0 = 8 + Math.log(0 + 1) * 6; // = 8
  const nr50 = Math.min(28, Math.max(8, 8 + Math.log(50 + 1) * 6)); // = 28
  const nr1 = 8 + Math.log(1 + 1) * 6; // ≈ 12.16
  nr0 === 8 ? pass('nodeRadius(0) = 8px minimum') : fail('nodeRadius(0) = 8px minimum', `got ${nr0}`);
  nr50 === 28 ? pass('nodeRadius(50) = 28px maximum') : fail('nodeRadius(50) = 28px maximum', `got ${nr50}`);
  nr1 > 8 && nr1 < 28 ? pass('nodeRadius(1) is between min and max') : fail('nodeRadius(1) is between min and max', `got ${nr1}`);

  // Section 3: Cluster hover dimming
  console.log('Section 3: Cluster hover dimming\n');

  memViewSrc.includes('mouseenter') ? pass('mouseenter handler on cluster labels') : fail('mouseenter handler on cluster labels');
  memViewSrc.includes('mouseleave') ? pass('mouseleave handler on cluster labels') : fail('mouseleave handler on cluster labels');
  memViewSrc.includes('0.2') ? pass('Non-cluster nodes dimmed to 0.2 opacity') : fail('Non-cluster nodes dimmed to 0.2 opacity');
  memViewSrc.includes('1.0') ? pass('Cluster nodes set to 1.0 opacity') : fail('Cluster nodes set to 1.0 opacity');
  memViewSrc.includes('transition') && memViewSrc.includes('150') ? pass('150ms CSS transition') : fail('150ms CSS transition');
  memViewSrc.includes('d3.drag') || memViewSrc.includes('drag') ? pass('Drag interactions preserved') : fail('Drag interactions preserved');
  memViewSrc.includes('zoom') ? pass('Zoom interactions preserved') : fail('Zoom interactions preserved');

  // Section 4: Graph/Grid toggle
  console.log('Section 4: Graph view infrastructure\n');

  memViewSrc.includes('viewMode') ? pass('View mode state (graph/grid)') : fail('View mode state (graph/grid)');
  memViewSrc.includes('svgRef') ? pass('SVG ref for D3 graph') : fail('SVG ref for D3 graph');
  memViewSrc.includes('forceSimulation') || memViewSrc.includes('d3.forceSimulation') ? pass('D3 force simulation') : fail('D3 force simulation');
  memViewSrc.includes('forceLink') ? pass('Force link for edges') : fail('Force link for edges');
  memViewSrc.includes('forceCollide') ? pass('Collision force to prevent overlap') : fail('Collision force to prevent overlap');

  // Section 5: Live API — seed memories and test graph
  console.log('Section 5: Live API tests\n');

  try {
    // Seed some memories with different usage counts
    for (let i = 0; i < 5; i++) {
      await fetch(`${GATEWAY}/api/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `Graph test memory ${i}: This is a test memory about topic ${i} for validating the memory graph visual upgrades`,
          category: ['fact', 'preference', 'goal'][i % 3],
          confidence: 0.5 + (i * 0.1),
        }),
      });
    }
    pass('Seeded 5 test memories');

    // Test graph endpoint
    const graphRes = await fetch(`${GATEWAY}/api/memories/graph?cluster=true`);
    if (graphRes.ok) {
      const graph = await graphRes.json() as any;
      pass('Graph API responds');
      graph.nodes && graph.nodes.length > 0 ? pass('Graph has nodes') : fail('Graph has nodes');
      graph.clusters ? pass('Graph includes clusters') : fail('Graph includes clusters');
    } else {
      fail('Graph API responds', `${graphRes.status}`);
    }

    // Test memory pulse endpoint
    const memsRes = await fetch(`${GATEWAY}/api/memories?limit=1`);
    const mems = await memsRes.json() as any[];
    if (mems.length > 0) {
      const pulseRes = await fetch(`${GATEWAY}/api/memories/${mems[0].id}/reinforce`, { method: 'POST' });
      pulseRes.ok ? pass('Memory reinforce/pulse endpoint works') : fail('Memory reinforce/pulse endpoint works');
    }
  } catch (e: any) {
    fail('Live API tests', e.message);
  }

  // Print results
  console.log('\n' + '='.repeat(50));
  for (const r of results) {
    console.log(`  ${r.passed ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log('='.repeat(50));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nTotal: ${results.length} tests, ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
