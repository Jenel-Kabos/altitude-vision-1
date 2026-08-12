const mongoose = require('mongoose');
const Message = require('../models/Message');
const RentalMaintenanceTicket = require('../models/RentalMaintenanceTicket');
const InternalMail = require('../models/InternalMail');
const Litige = require('../models/Litige');
const Signalement = require('../models/Signalement');

const ID = new mongoose.Types.ObjectId();
const ASSET = {
  assetClass: 'PRIVATE_DOCUMENT', purpose: 'administrative', provider: 'cloudinary',
  publicId: 'private/secret-id', resourceType: 'raw', deliveryType: 'authenticated',
  version: '1', format: 'pdf', mimeType: 'application/pdf', originalFilename: 'secret.pdf', size: 12,
};

const expectOpaqueEndpoint = (json, endpointPart) => {
  const serialized = JSON.stringify(json);
  expect(serialized).not.toContain('private/secret-id');
  expect(serialized).not.toContain('res.cloudinary.com');
  expect(serialized).toContain(endpointPart);
};

test('conversation attachment exposes only its protected business endpoint', () => {
  const json = new Message({ _id: ID, conversation: ID, sender: ID, content: 'x', attachments: [{ asset: { ...ASSET, purpose: 'conversation' }, nom: 'secret.pdf' }] }).toJSON();
  expectOpaqueEndpoint(json, `/api/messages/${ID}/attachments/`);
});

test('maintenance evidence exposes only its protected business endpoint', () => {
  const json = new RentalMaintenanceTicket({ _id: ID, property: ID, category: 'autre', description: 'x', attachments: [{ asset: { ...ASSET, purpose: 'maintenance' }, nom: 'secret.pdf' }] }).toJSON();
  expectOpaqueEndpoint(json, `/api/rental-maintenance/${ID}/attachments/0`);
});

test('administrative mail attachment exposes only its protected business endpoint', () => {
  const json = new InternalMail({ _id: ID, sender: ID, receiver: ID, content: 'x', attachments: [{ asset: ASSET, filename: 'secret.pdf' }] }).toJSON();
  expectOpaqueEndpoint(json, `/api/internal-mails/${ID}/attachments/0`);
});

test('litigation proofs expose only protected Litige and Signalement endpoints', () => {
  const litige = new Litige({ _id: ID, type: 'Autre', description: 'x', preuves: [{ asset: ASSET, nom: 'secret.pdf' }] }).toJSON();
  const signalement = new Signalement({ _id: ID, property: ID, signalePar: ID, raison: 'autre', preuves: [{ asset: ASSET, nom: 'secret.pdf' }] }).toJSON();
  expectOpaqueEndpoint(litige, `/api/litiges/${ID}/proofs/0`);
  expectOpaqueEndpoint(signalement, `/api/signalements/${ID}/proofs/0`);
});
