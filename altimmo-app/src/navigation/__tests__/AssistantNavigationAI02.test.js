/* eslint-env node, jest */
// ALTIMMO-AI-INTEGRATION-02 — l'assistant est enregistré dans la pile Annonces ; la carte d'accès
// n'est affichée que si le serveur confirme l'activation ; la couche de présentation est identique au web.
const fs = require('fs');
const path = require('path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', '..', relative), 'utf8');

test('pile Annonces : écran Assistant enregistré', () => {
  const tabs = read('navigation/TabNavigator.jsx');
  // AI-INTEGRATION-01 (DeepSeek) : l'écran passe par l'aiguillage, qui rend l'assistant existant par défaut.
  expect(tabs).toMatch(/import AssistantGateScreen\s+from '\.\.\/screens\/Assistant\/AssistantGateScreen'/);
  expect(tabs).toMatch(/<Stack\.Screen name="Assistant" component=\{AssistantGateScreen\} \/>/);
  expect(read('screens/Assistant/AssistantGateScreen.jsx')).toMatch(/return <AssistantScreen \{\.\.\.props\} \/>;/);
});

test('accueil : carte conditionnée à l’activation, filtres transmis', () => {
  const home = read('screens/Annonces/ListeAnnoncesScreen.jsx');
  expect(home).toMatch(/\{assistantEnabled \? <AssistantEntryCard onPress=\{onOpenAssistant\} refine=\{activeFilterCount > 0\} \/> : null\}/);
  expect(home).toMatch(/getAssistantStatus\(\)\.then/);
  expect(home).toMatch(/await getToken\(\)\.catch\(\(\) => null\)\) \? \(await getAdvisorStatus\(\)\)\.available === true/);
  expect(home).toMatch(/navigation\.navigate\('Assistant', \{ filters: assistantFiltersFromListFilters\(activeFilters\) \}\)/);
});

test('couche de présentation identique au web', () => {
  const mobile = read('utils/assistantViewModel.js');
  const web = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'client', 'lib', 'utils', 'assistantViewModel.js'), 'utf8');
  expect(mobile).toBe(web);
  const advisorMobile = read('utils/advisorViewModel.js');
  const advisorWeb = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'client', 'lib', 'utils', 'advisorViewModel.js'), 'utf8');
  expect(advisorMobile).toBe(advisorWeb);
});
