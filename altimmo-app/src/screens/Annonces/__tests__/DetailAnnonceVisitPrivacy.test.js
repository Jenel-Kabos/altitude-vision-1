/* eslint-env node, jest */
const fs = require('fs');
const path = require('path');

test('la demande de visite mobile ne place jamais le téléphone dans le message commercial', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../DetailAnnonceScreen.jsx'), 'utf8');
  expect(source).not.toContain('Tél: ${rdvTelephone}');
  expect(source).not.toContain("if (!rdvTelephone.trim() || !rdvConsent)");
  expect(source).toContain('Téléphone (optionnel, réservé à Altitude Vision)');
});
