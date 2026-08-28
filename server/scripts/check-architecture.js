#!/usr/bin/env node
const path = require('path');
const { analyzeArchitecture, compareWithBaseline, loadBaseline, RULES } = require('../architecture/checker');

const serverRoot = path.resolve(__dirname, '..');
const baselinePath = path.join(serverRoot, 'architecture', 'baseline.json');

function labelFor(rule) {
  return {
    [RULES.SERVICE_TO_CONTROLLER]: 'service → controller',
    [RULES.CONTROLLER_TO_CONTROLLER]: 'controller → controller',
    [RULES.ROUTE_TO_MODEL]: 'route → model',
  }[rule] || rule;
}

function printViolation(title, violation) {
  console.error(`\n${violation.rule}: ${title}`);
  console.error(`source: ${violation.from}`);
  console.error(`target: ${violation.to}`);
}

function main() {
  const startedAt = process.hrtime.bigint();
  const baseline = loadBaseline(baselinePath);
  const analysis = analyzeArchitecture(serverRoot);
  const comparison = compareWithBaseline(analysis, baseline);
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  const counts = Object.fromEntries(Object.values(RULES).map((rule) => [rule, analysis.violations.filter((entry) => entry.rule === rule).length]));

  console.log(`Architecture files analyzed: ${analysis.files.length}`);
  console.log(`Internal static edges: ${analysis.edges.length}`);
  console.log('Known legacy debt:');
  console.log(`- service → controller: ${counts[RULES.SERVICE_TO_CONTROLLER]}`);
  console.log(`- controller → controller: ${counts[RULES.CONTROLLER_TO_CONTROLLER]}`);
  console.log(`- route → model: ${counts[RULES.ROUTE_TO_MODEL]} edges across ${new Set(analysis.violations.filter((entry) => entry.rule === RULES.ROUTE_TO_MODEL).map((entry) => entry.from)).size} routes`);
  console.log(`- controller → model (progressive metric): ${analysis.controllerModelEdges.length}`);
  console.log(`- known cycles: ${analysis.cycles.length}`);
  baseline.cycles.forEach((cycle) => console.log(`  ${cycle.label || 'Known cycle'}: ${cycle.nodes.join(' → ')}`));
  console.log(`Statically unresolved imports: ${analysis.unresolved.length}`);
  console.log(`Dangling internal imports (progressive metric): ${analysis.danglingImports.length}`);
  console.log(`Architecture check duration: ${elapsedMs.toFixed(1)} ms`);

  comparison.baselineErrors.forEach((error) => console.error(`ARCH-BASELINE-001: ${error}`));
  comparison.newViolations.forEach((violation) => {
    printViolation(`New ${labelFor(violation.rule)} dependency detected`, violation);
    console.error('This dependency is not part of the historical baseline.');
    console.error('Do not add it automatically. Refactor through a service/helper/application boundary.');
  });
  comparison.staleViolations.forEach((violation) => {
    printViolation('Stale baseline entry detected', violation);
    console.error('The historical dependency was removed. Remove this exact baseline entry before merging.');
  });
  comparison.newCycles.forEach((nodes) => {
    console.error(`\n${RULES.CYCLE}: New strong dependency cycle detected`);
    console.error(`nodes: ${nodes.join(' → ')}`);
    console.error('This cycle is not part of the historical baseline. Do not baseline it automatically.');
  });
  comparison.staleCycles.forEach((cycle) => {
    console.error(`\n${RULES.CYCLE}: Stale cycle baseline detected`);
    console.error(`nodes: ${cycle.nodes.join(' → ')}`);
    console.error('The known cycle was removed or changed. Update the exact baseline signature.');
  });

  const failed = Object.values(comparison).some((items) => items.length > 0);
  if (failed) {
    console.error('\nArchitecture boundaries: FAIL');
    process.exitCode = 1;
  } else {
    console.log('\nNew violations: 0');
    console.log('Architecture boundaries: PASS');
  }
}

try {
  main();
} catch (error) {
  console.error(`ARCH-BASELINE-001: ${error.message}`);
  process.exitCode = 1;
}
