const mongoose = require('mongoose');
const {
  serializeDecisionView,
  serializeApplicantView,
  serializePlatformView,
} = require('../services/realEstateApplicationPrivacyService');

const id = () => new mongoose.Types.ObjectId();
const fixture = () => ({
  _id: id(), kind: 'rental_application', status: 'submitted', message: 'Dossier sérieux',
  property: { _id: id(), title: 'Villa', owner: id() }, owner: id(),
  applicant: {
    _id: id(), name: 'Candidate', firstName: 'Ada', lastName: 'Lovelace',
    email: 'ada@example.test', phone: '+242060000000', address: 'Adresse privée',
    password: 'hash', tokenVersion: 7,
  },
  rentalApplication: { desiredMoveIn: new Date('2027-01-01'), desiredDurationMonths: 12, occupants: 2, monthlyIncome: 500000, incomeCurrency: 'XAF' },
  attachments: [{ _id: id(), name: 'salaire.pdf', mimeType: 'application/pdf', size: 42, storageKey: 'private/secret' }],
  history: [{ action: 'submitted', actor: id() }],
});

test('la vue décision propriétaire masque coordonnées, adresse, revenu brut et justificatifs', () => {
  const value = serializeDecisionView(fixture());
  expect(value.applicant).toMatchObject({ name: 'Candidate', firstName: 'Ada', lastName: 'Lovelace' });
  expect(value.applicant).not.toHaveProperty('email');
  expect(value.applicant).not.toHaveProperty('phone');
  expect(value.applicant).not.toHaveProperty('address');
  expect(value.rentalApplication).not.toHaveProperty('monthlyIncome');
  expect(value.rentalApplication).not.toHaveProperty('incomeCurrency');
  expect(value).not.toHaveProperty('attachments');
  expect(JSON.stringify(value)).not.toMatch(/private\/secret|hash/);
});

test('la vue candidat conserve ses propres données et seulement les métadonnées sûres de ses pièces', () => {
  const value = serializeApplicantView(fixture());
  expect(value.applicant.email).toBe('ada@example.test');
  expect(value.rentalApplication.monthlyIncome).toBe(500000);
  expect(value.attachments[0]).toMatchObject({ name: 'salaire.pdf', mimeType: 'application/pdf', size: 42 });
  expect(value.attachments[0]).not.toHaveProperty('storageKey');
  expect(value.applicant).not.toHaveProperty('password');
  expect(value.applicant).not.toHaveProperty('tokenVersion');
});

test('la vue médiateur plateforme masque les données protégées jusqu’à une divulgation explicite auditée', () => {
  const value = serializePlatformView(fixture());
  expect(value.applicant).not.toHaveProperty('email');
  expect(value.applicant).not.toHaveProperty('phone');
  expect(value.rentalApplication).not.toHaveProperty('monthlyIncome');
  expect(value).not.toHaveProperty('attachments');
  expect(value.projection).toEqual(expect.objectContaining({ audience: 'platform_mediator', contactDetailsVisible: false, contactDisclosureAvailable: true }));
});
