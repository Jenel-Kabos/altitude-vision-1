// IA-03C4 — Passerelle unique de l'assistant : seule surface que pourra appeler un futur contrôleur.
// Chaque sortie traverse la garde de contrat ; les modules sont appelés via leur objet exporté
// (pas de déstructuration) pour que la garde s'applique au comportement réellement exécuté.
const { guardAssistantOutput, CONTRACT_VERSION } = require('./assistantContract');
const search = require('./intelligentSearchService');
const ranking = require('./personalizedSearchService');
const comparison = require('./comparisonService');

async function searchRealEstate(input, dependencies) {
  return guardAssistantOutput('search', await search.searchRealEstateFromText(input, dependencies));
}

async function searchAndRankRealEstate(input, dependencies) {
  return guardAssistantOutput('ranking', await ranking.searchAndRankRealEstateFromText(input, dependencies));
}

async function compareRealEstate(input, dependencies) {
  return guardAssistantOutput('comparison', await comparison.compareRealEstate(input, dependencies));
}

async function searchRankAndCompare(input, dependencies) {
  return guardAssistantOutput('comparison', await comparison.searchRankAndCompareFromText(input, dependencies));
}

module.exports = { searchRealEstate, searchAndRankRealEstate, compareRealEstate, searchRankAndCompare, CONTRACT_VERSION };
