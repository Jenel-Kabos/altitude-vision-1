const fs = require('fs');
const path = require('path');

const PRODUCTION_LAYERS = ['routes', 'controllers', 'services', 'models', 'middleware', 'constants', 'utils', 'config'];
const SOURCE_EXTENSIONS = ['.js', '.cjs', '.mjs'];
const RULES = Object.freeze({
  SERVICE_TO_CONTROLLER: 'ARCH-LAYER-001',
  CONTROLLER_TO_CONTROLLER: 'ARCH-LAYER-002',
  ROUTE_TO_MODEL: 'ARCH-LAYER-003',
  CYCLE: 'ARCH-CYCLE-001',
});
const LAYER_RULES = new Map([
  ['services:controllers', RULES.SERVICE_TO_CONTROLLER],
  ['controllers:controllers', RULES.CONTROLLER_TO_CONTROLLER],
  ['routes:models', RULES.ROUTE_TO_MODEL],
]);

const toPosix = (value) => value.split(path.sep).join('/');
const relativePath = (rootDir, file) => toPosix(path.relative(rootDir, file));

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function collectProductionFiles(rootDir) {
  return PRODUCTION_LAYERS.flatMap((layer) => walk(path.join(rootDir, layer)))
    .filter((file) => SOURCE_EXTENSIONS.includes(path.extname(file)))
    .sort();
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function maskComments(source) {
  const characters = [...source];
  let state = 'code';
  let escaped = false;
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const next = characters[index + 1];
    if (state === 'line-comment') {
      if (character === '\n') state = 'code';
      else characters[index] = ' ';
      continue;
    }
    if (state === 'block-comment') {
      if (character === '*' && next === '/') {
        characters[index] = ' ';
        characters[index + 1] = ' ';
        index += 1;
        state = 'code';
      } else if (character !== '\n') characters[index] = ' ';
      continue;
    }
    if (state !== 'code') {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if ((state === 'single-quote' && character === "'")
        || (state === 'double-quote' && character === '"')
        || (state === 'template' && character === '`')) state = 'code';
      continue;
    }
    if (character === '/' && next === '/') {
      characters[index] = ' ';
      characters[index + 1] = ' ';
      index += 1;
      state = 'line-comment';
    } else if (character === '/' && next === '*') {
      characters[index] = ' ';
      characters[index + 1] = ' ';
      index += 1;
      state = 'block-comment';
    } else if (character === "'") state = 'single-quote';
    else if (character === '"') state = 'double-quote';
    else if (character === '`') state = 'template';
  }
  return characters.join('');
}

function parseImports(source) {
  const analyzableSource = maskComments(source);
  const imports = [];
  const occupied = [];
  const patterns = [
    { kind: 'require', regex: /\brequire\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g },
    { kind: 'dynamic-import', regex: /\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g },
    { kind: 'esm', regex: /\b(?:import|export)\s+(?:[^'"`]*?\s+from\s+)?(['"])([^'"]+)\1/g },
  ];
  for (const { kind, regex } of patterns) {
    for (const match of analyzableSource.matchAll(regex)) {
      if (match[1] === '`' && match[2].includes('${')) continue;
      imports.push({ kind, specifier: match[2], line: lineAt(analyzableSource, match.index) });
      occupied.push([match.index, match.index + match[0].length]);
    }
  }

  const unresolved = [];
  const callPattern = /\b(require|import)\s*\(([^)]*)\)/g;
  for (const match of analyzableSource.matchAll(callPattern)) {
    if (occupied.some(([start, end]) => match.index >= start && match.index < end)) continue;
    unresolved.push({ expression: match[0], line: lineAt(analyzableSource, match.index) });
  }
  return { imports, unresolved };
}

function resolveInternalImport(fromFile, specifier, knownFiles, rootDir) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, ...SOURCE_EXTENSIONS.map((ext) => `${base}${ext}`), ...SOURCE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`))];
  const resolved = candidates.find((candidate) => knownFiles.has(path.normalize(candidate)));
  if (resolved) return resolved;
  const inferred = path.extname(base) ? base : `${base}.js`;
  const inferredRelative = relativePath(rootDir, inferred);
  return PRODUCTION_LAYERS.includes(layerOf(inferredRelative)) && !inferredRelative.startsWith('../') ? inferred : null;
}

function layerOf(relativeFile) {
  return relativeFile.split('/')[0];
}

function findStronglyConnectedComponents(files, edges) {
  const adjacency = new Map(files.map((file) => [file, []]));
  edges.forEach(({ from, to }) => adjacency.get(from)?.push(to));
  let nextIndex = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  function visit(node) {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);
    for (const target of adjacency.get(node) || []) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(target)));
      }
    }
    if (lowLinks.get(node) !== indices.get(node)) return;
    const component = [];
    let current;
    do {
      current = stack.pop();
      onStack.delete(current);
      component.push(current);
    } while (current !== node);
    const selfCycle = component.length === 1 && (adjacency.get(component[0]) || []).includes(component[0]);
    if (component.length > 1 || selfCycle) components.push(component.sort());
  }

  files.forEach((file) => { if (!indices.has(file)) visit(file); });
  return components.sort((left, right) => left.join('|').localeCompare(right.join('|')));
}

function analyzeArchitecture(rootDir) {
  const absoluteRoot = path.resolve(rootDir);
  const files = collectProductionFiles(absoluteRoot);
  const knownFiles = new Set(files.map((file) => path.normalize(file)));
  const edgeKeys = new Set();
  const edges = [];
  const unresolved = [];

  for (const from of files) {
    const parsed = parseImports(fs.readFileSync(from, 'utf8'));
    parsed.unresolved.forEach((entry) => unresolved.push({ file: relativePath(absoluteRoot, from), ...entry }));
    for (const imported of parsed.imports) {
      const to = resolveInternalImport(from, imported.specifier, knownFiles, absoluteRoot);
      if (!to) continue;
      const key = `${from}\0${to}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({
        from,
        to,
        source: relativePath(absoluteRoot, from),
        target: relativePath(absoluteRoot, to),
        dangling: !knownFiles.has(path.normalize(to)),
      });
    }
  }

  edges.sort((left, right) => `${left.source}|${left.target}`.localeCompare(`${right.source}|${right.target}`));
  const violations = edges.flatMap((edge) => {
    const rule = LAYER_RULES.get(`${layerOf(edge.source)}:${layerOf(edge.target)}`);
    return rule ? [{ rule, from: edge.source, to: edge.target }] : [];
  });
  const cycles = findStronglyConnectedComponents(files, edges)
    .map((nodes) => nodes.map((node) => relativePath(absoluteRoot, node)).sort());
  const controllerModelEdges = edges.filter((edge) => layerOf(edge.source) === 'controllers' && layerOf(edge.target) === 'models');

  const danglingImports = edges.filter((edge) => edge.dangling);
  return { rootDir: absoluteRoot, files: files.map((file) => relativePath(absoluteRoot, file)), edges, violations, cycles, unresolved, danglingImports, controllerModelEdges };
}

function violationKey(entry) {
  return `${entry.rule}|${entry.from}|${entry.to}`;
}

function cycleKey(nodes) {
  return [...nodes].sort().join('|');
}

function validateBaseline(baseline) {
  const errors = [];
  const allowedLayerRules = new Set([...LAYER_RULES.values()]);
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) return ['Baseline must be a JSON object.'];
  if (baseline.version !== 1) errors.push('Baseline version must be 1.');
  if (!Array.isArray(baseline.violations)) errors.push('Baseline violations must be an array.');
  if (!Array.isArray(baseline.cycles)) errors.push('Baseline cycles must be an array.');

  const violationKeys = new Set();
  for (const [index, entry] of (baseline.violations || []).entries()) {
    const prefix = `violations[${index}]`;
    if (!allowedLayerRules.has(entry?.rule)) errors.push(`${prefix}.rule is unknown.`);
    for (const field of ['from', 'to', 'reason', 'category']) {
      if (typeof entry?.[field] !== 'string' || !entry[field].trim()) errors.push(`${prefix}.${field} is required.`);
    }
    if (typeof entry?.from === 'string' && entry.from.includes('\\')) errors.push(`${prefix}.from must use POSIX paths.`);
    if (typeof entry?.to === 'string' && entry.to.includes('\\')) errors.push(`${prefix}.to must use POSIX paths.`);
    const key = violationKey(entry || {});
    if (violationKeys.has(key)) errors.push(`${prefix} duplicates ${key}.`);
    violationKeys.add(key);
  }

  const cycleKeys = new Set();
  for (const [index, entry] of (baseline.cycles || []).entries()) {
    const prefix = `cycles[${index}]`;
    if (entry?.rule !== RULES.CYCLE) errors.push(`${prefix}.rule is unknown.`);
    if (!Array.isArray(entry?.nodes) || entry.nodes.length < 1 || entry.nodes.some((node) => typeof node !== 'string' || !node.trim())) errors.push(`${prefix}.nodes must be a non-empty string array.`);
    for (const field of ['reason', 'category']) {
      if (typeof entry?.[field] !== 'string' || !entry[field].trim()) errors.push(`${prefix}.${field} is required.`);
    }
    const nodes = entry?.nodes || [];
    if (nodes.some((node) => node.includes('\\'))) errors.push(`${prefix}.nodes must use POSIX paths.`);
    if (JSON.stringify(nodes) !== JSON.stringify([...nodes].sort())) errors.push(`${prefix}.nodes must be sorted.`);
    const key = cycleKey(nodes);
    if (cycleKeys.has(key)) errors.push(`${prefix} duplicates ${key}.`);
    cycleKeys.add(key);
  }
  return errors;
}

function compareWithBaseline(analysis, baseline) {
  const baselineErrors = validateBaseline(baseline);
  if (baselineErrors.length) return { baselineErrors, newViolations: [], staleViolations: [], newCycles: [], staleCycles: [] };
  const currentViolations = new Map(analysis.violations.map((entry) => [violationKey(entry), entry]));
  const allowedViolations = new Map(baseline.violations.map((entry) => [violationKey(entry), entry]));
  const currentCycles = new Map(analysis.cycles.map((nodes) => [cycleKey(nodes), nodes]));
  const allowedCycles = new Map(baseline.cycles.map((entry) => [cycleKey(entry.nodes), entry]));
  return {
    baselineErrors: [],
    newViolations: [...currentViolations].filter(([key]) => !allowedViolations.has(key)).map(([, value]) => value),
    staleViolations: [...allowedViolations].filter(([key]) => !currentViolations.has(key)).map(([, value]) => value),
    newCycles: [...currentCycles].filter(([key]) => !allowedCycles.has(key)).map(([, value]) => value),
    staleCycles: [...allowedCycles].filter(([key]) => !currentCycles.has(key)).map(([, value]) => value),
  };
}

function loadBaseline(file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Architecture baseline cannot be read: ${error.message}`);
  }
  const errors = validateBaseline(parsed);
  if (errors.length) throw new Error(`Architecture baseline is invalid:\n- ${errors.join('\n- ')}`);
  return parsed;
}

module.exports = {
  PRODUCTION_LAYERS,
  RULES,
  SOURCE_EXTENSIONS,
  analyzeArchitecture,
  collectProductionFiles,
  compareWithBaseline,
  cycleKey,
  loadBaseline,
  parseImports,
  validateBaseline,
  violationKey,
};
