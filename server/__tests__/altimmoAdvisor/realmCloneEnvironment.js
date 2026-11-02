// Environnement Jest des suites du conseiller (portées de node:test) : `structuredClone` de Node crée ses
// objets dans le domaine d'exécution principal, et `assert.deepStrictEqual` les voit alors avec un autre
// prototype que les littéraux du test. Cet environnement définit un clone équivalent pour les données du
// conseiller (objets simples, tableaux, dates, Map, Set) DANS le contexte du test. Le code de production
// et les assertions sont inchangés.
const { TestEnvironment } = require('jest-environment-node');
const vm = require('node:vm');

const SOURCE = `(function realmStructuredClone(value, seen = new Map()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function' || typeof value === 'symbol') throw new DOMException('Valeur non clonable.', 'DataCloneError');
    return value;
  }
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date || Object.prototype.toString.call(value) === '[object Date]') return new Date(value.getTime());
  if (Array.isArray(value)) { const out = []; seen.set(value, out); value.forEach((item, i) => { out[i] = realmStructuredClone(item, seen); }); return out; }
  if (Object.prototype.toString.call(value) === '[object Map]') { const out = new Map(); seen.set(value, out); value.forEach((v, k) => out.set(realmStructuredClone(k, seen), realmStructuredClone(v, seen))); return out; }
  if (Object.prototype.toString.call(value) === '[object Set]') { const out = new Set(); seen.set(value, out); value.forEach((v) => out.add(realmStructuredClone(v, seen))); return out; }
  const out = {}; seen.set(value, out);
  for (const key of Object.keys(value)) out[key] = realmStructuredClone(value[key], seen);
  return out;
})`;

class RealmCloneEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    this.global.structuredClone = vm.runInContext(SOURCE, this.getVmContext());
  }
}

module.exports = RealmCloneEnvironment;
