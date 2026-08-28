const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  RULES,
  analyzeArchitecture,
  compareWithBaseline,
  loadBaseline,
  parseImports,
  validateBaseline,
} = require('../architecture/checker');

const emptyBaseline = () => ({ version: 1, violations: [], cycles: [] });
const metadata = { reason: 'Historical test debt.', category: 'legacy-test-debt' };

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'altimmo-architecture-'));
  Object.entries(files).forEach(([file, source]) => {
    const destination = path.join(root, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, source);
  });
  return root;
}

describe('architecture dependency guardrail', () => {
  const temporaryRoots = [];
  const makeFixture = (files) => {
    const root = fixture(files);
    temporaryRoots.push(root);
    return root;
  };

  afterEach(() => {
    temporaryRoots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true }));
  });

  test('accepts the intended route → controller → service → model flow', () => {
    const root = makeFixture({
      'routes/example.js': "module.exports = require('../controllers/example');",
      'controllers/example.js': "module.exports = require('../services/example');",
      'services/example.js': "module.exports = require('../models/Example');",
      'models/Example.js': 'module.exports = {};',
    });
    const comparison = compareWithBaseline(analyzeArchitecture(root), emptyBaseline());
    expect(comparison).toEqual({ baselineErrors: [], newViolations: [], staleViolations: [], newCycles: [], staleCycles: [] });
  });

  test('accepts an exact historical violation but rejects a new one', () => {
    const root = makeFixture({
      'routes/known.js': "require('../models/Known');",
      'routes/new.js': "require('../models/New');",
      'models/Known.js': 'module.exports = {};',
      'models/New.js': 'module.exports = {};',
    });
    const baseline = { version: 1, violations: [{ rule: RULES.ROUTE_TO_MODEL, from: 'routes/known.js', to: 'models/Known.js', ...metadata }], cycles: [] };
    const comparison = compareWithBaseline(analyzeArchitecture(root), baseline);
    expect(comparison.newViolations).toEqual([{ rule: RULES.ROUTE_TO_MODEL, from: 'routes/new.js', to: 'models/New.js' }]);
    expect(comparison.staleViolations).toEqual([]);
  });

  test('fails when a removed violation leaves a stale baseline entry', () => {
    const root = makeFixture({ 'routes/known.js': 'module.exports = {};', 'models/Known.js': 'module.exports = {};' });
    const baseline = { version: 1, violations: [{ rule: RULES.ROUTE_TO_MODEL, from: 'routes/known.js', to: 'models/Known.js', ...metadata }], cycles: [] };
    expect(compareWithBaseline(analyzeArchitecture(root), baseline).staleViolations).toHaveLength(1);
  });

  test('accepts the exact known cycle and rejects a changed or grown cycle', () => {
    const root = makeFixture({
      'services/a.js': "require('./b');",
      'services/b.js': "require('./a'); require('./c');",
      'services/c.js': "require('./b');",
    });
    const baseline = { version: 1, violations: [], cycles: [{ rule: RULES.CYCLE, nodes: ['services/a.js', 'services/b.js'], ...metadata }] };
    const comparison = compareWithBaseline(analyzeArchitecture(root), baseline);
    expect(comparison.newCycles).toEqual([['services/a.js', 'services/b.js', 'services/c.js']]);
    expect(comparison.staleCycles).toHaveLength(1);
  });

  test('parses CommonJS, ESM and literal dynamic imports without reading comments', () => {
    const parsed = parseImports(`
      // require('./ignored')
      const a = require('./a');
      import b from './b.mjs';
      export { c } from './c.js';
      const d = import('./d.cjs');
      require(variable);
    `);
    expect(parsed.imports.map(({ specifier }) => specifier).sort()).toEqual(['./a', './b.mjs', './c.js', './d.cjs']);
    expect(parsed.unresolved).toEqual([{ expression: 'require(variable)', line: 7 }]);
  });

  test('rejects malformed, unknown and duplicate baseline entries', () => {
    const duplicate = { rule: RULES.SERVICE_TO_CONTROLLER, from: 'services/a.js', to: 'controllers/a.js', ...metadata };
    const errors = validateBaseline({ version: 1, violations: [duplicate, duplicate, { rule: 'UNKNOWN' }], cycles: [] });
    expect(errors.some((error) => error.includes('duplicates'))).toBe(true);
    expect(errors.some((error) => error.includes('rule is unknown'))).toBe(true);
    expect(errors.some((error) => error.includes('reason is required'))).toBe(true);
  });

  test('loads the repository baseline and matches the current production graph', () => {
    const serverRoot = path.resolve(__dirname, '..');
    const baseline = loadBaseline(path.join(serverRoot, 'architecture', 'baseline.json'));
    const comparison = compareWithBaseline(analyzeArchitecture(serverRoot), baseline);
    expect(comparison).toEqual({ baselineErrors: [], newViolations: [], staleViolations: [], newCycles: [], staleCycles: [] });
  });
});
