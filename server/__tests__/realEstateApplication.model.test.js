const mongoose = require('mongoose');
const Application = require('../models/RealEstateApplication');
const Reservation = require('../models/RealEstateReservation');

describe('IM-2 model invariants', () => {
  test('rejects a non-positive purchase offer', async () => {
    const row = new Application({
      kind: 'purchase_offer', property: new mongoose.Types.ObjectId(), applicant: new mongoose.Types.ObjectId(),
      owner: new mongoose.Types.ObjectId(), validUntil: new Date(Date.now() + 1000), purchaseOffer: { amount: 0 },
    });
    await expect(row.validate()).rejects.toThrow(/minimum allowed value/);
  });

  test('rejects an unsupported private attachment type', async () => {
    const row = new Application({
      kind: 'rental_application', property: new mongoose.Types.ObjectId(), applicant: new mongoose.Types.ObjectId(),
      owner: new mongoose.Types.ObjectId(), validUntil: new Date(Date.now() + 1000),
      attachments: [{ storageKey: 'private/a', name: 'a.exe', mimeType: 'application/octet-stream', size: 12 }],
    });
    await expect(row.validate()).rejects.toThrow(/not a valid enum value/);
  });

  test('reservation terminal states and idempotency key are explicit', async () => {
    const row = new Reservation({
      property: new mongoose.Types.ObjectId(), client: new mongoose.Types.ObjectId(), application: new mongoose.Types.ObjectId(),
      type: 'sale', status: 'active', expiresAt: new Date(Date.now() + 1000), idempotencyKey: 'accept:1',
    });
    await expect(row.validate()).resolves.toBeUndefined();
    expect(Reservation.schema.path('status').enumValues).toEqual(['active', 'converted', 'cancelled', 'expired']);
  });
});
