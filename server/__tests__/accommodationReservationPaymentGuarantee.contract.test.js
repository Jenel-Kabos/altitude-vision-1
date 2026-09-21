const mongoose = require('mongoose');
const Reservation = require('../models/AccommodationReservation');

describe('AccommodationReservation — contrat de garantie', () => {
  test('expose les états pending_payment et expired sans réinterpréter les historiques', () => {
    expect(Reservation.STATUSES).toEqual(expect.arrayContaining(['pending_payment', 'expired']));
  });

  test('persiste le délai de paiement et le montant requis dans le snapshot', () => {
    const reservation = new Reservation({
      accommodation: new mongoose.Types.ObjectId(), guest: new mongoose.Types.ObjectId(),
      owner: new mongoose.Types.ObjectId(), createdBy: new mongoose.Types.ObjectId(),
      checkInDate: new Date('2027-09-10T00:00:00Z'), checkOutDate: new Date('2027-09-15T00:00:00Z'),
      nights: 5, guestCount: 1, adults: 1, status: 'pending_payment',
      paymentExpiresAt: new Date('2027-09-01T12:00:00Z'),
      pricingSnapshot: { nightlyRate: 50000, nights: 5, total: 250000, requiredToConfirm: 50000, currency: 'XAF' },
    });
    expect(reservation.paymentExpiresAt).toBeInstanceOf(Date);
    expect(reservation.pricingSnapshot.requiredToConfirm).toBe(50000);
    expect(reservation.pricingSnapshot.total).toBe(250000);
  });
});
