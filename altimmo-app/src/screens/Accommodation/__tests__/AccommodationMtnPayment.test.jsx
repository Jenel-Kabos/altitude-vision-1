import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AccommodationReservationDetailScreen from '../AccommodationReservationDetailScreen';
import * as reservationApi from '../../../services/accommodationReservationService';

jest.mock('../../../services/accommodationReservationService');
jest.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ themeColors: { bg: '#fff', bgCard: '#fff', border: '#ddd', text: '#111', textSub: '#333', textMuted: '#666', gold: '#b88700', warning: '#8a4b00', error: 'red' } }) }));
jest.mock('../../../components/PageHeader', () => { const RN = require('react-native'); return ({ title }) => <RN.Text>{title}</RN.Text>; });
jest.mock('../../../components/ui/Button', () => { const RN = require('react-native'); return ({ label, onPress, disabled }) => <RN.Button title={label} onPress={onPress} disabled={disabled}/>; });
jest.mock('../../../components/ui/EmptyState', () => () => null);
jest.mock('../../../components/ui/Skeleton', () => () => null);
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));

const pending = { _id: 'reservation-1', status: 'pending_payment', checkInDate: '2027-09-10', checkOutDate: '2027-09-15', nights: 5, adults: 1, children: 0, total: 250000, amountPaid: 0, remainingAmount: 250000, currency: 'XAF', paymentExpiresAt: new Date(Date.now() + 3600000).toISOString(), pricingSnapshot: { requiredToConfirm: 50000 }, accommodation: { property: { title: 'Maison Mila', address: { city: 'Brazzaville' } } }, workflowHistory: [] };

beforeEach(() => {
  jest.clearAllMocks();
  reservationApi.getAccommodationReservation.mockResolvedValue({ data: { reservation: pending }, offline: false });
  reservationApi.getAccommodationFinancialSummary.mockResolvedValue({ data: { total: 250000, amountPaid: 0, remainingAmount: 250000, requiredToConfirm: 50000, payments: [] }, offline: false });
  reservationApi.getAccommodationRefundableSummary.mockResolvedValue({ data: { payments: [], refunds: [], refundableAmount: 0 }, offline: false });
});

test('Payer maintenant initie MTN avec reservationId et téléphone, sans prix, statut ou tenant', async () => {
  reservationApi.initiateAccommodationMtnPayment.mockResolvedValue({ paymentId: 'payment-1', status: 'pending', amountMinor: 50000 });
  render(<AccommodationReservationDetailScreen navigation={{ goBack: jest.fn() }} route={{ params: { reservationId: 'reservation-1' } }}/>);
  await screen.findByText('Payer maintenant');
  fireEvent.changeText(screen.getByLabelText('Numéro MTN Mobile Money'), '060000000');
  fireEvent.press(screen.getByText('Payer maintenant'));
  await waitFor(() => expect(reservationApi.initiateAccommodationMtnPayment).toHaveBeenCalledWith('reservation-1', '060000000', 'mobile-mtn:uuid-1', 'guarantee'));
  expect(screen.getByText('Vérifier le paiement')).toBeTruthy();
});

test('STAY-24/25 affiche le paiement progressif et total avec les montants serveur', async () => {
  const confirmed = { ...pending, status: 'confirmed', amountPaid: 50000, remainingAmount: 200000, paymentExpiresAt: null, pricingSnapshot: { nightlyRate: 50000, requiredToConfirm: 50000 } };
  reservationApi.getAccommodationReservation.mockResolvedValue({ data: { reservation: confirmed }, offline: false });
  reservationApi.getAccommodationFinancialSummary.mockResolvedValue({ data: { nightlyRate: 50000, numberOfNights: 5, total: 250000, amountPaid: 50000, remainingBalance: 200000, consumedNights: 0, consumedStayAmount: 0, remainingNights: 5, payments: [] }, offline: false });
  reservationApi.initiateAccommodationMtnPayment.mockResolvedValue({ paymentId: 'payment-2', status: 'pending', amountMinor: 50000 });
  render(<AccommodationReservationDetailScreen navigation={{ goBack: jest.fn() }} route={{ params: { reservationId: 'reservation-1' } }}/>);
  await screen.findByText('Payer la prochaine nuit');
  expect(screen.getByText('Payer le solde')).toBeTruthy();
  expect(screen.getByText('Votre première nuit est déjà payée.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Numéro MTN Mobile Money'), '060000000');
  fireEvent.press(screen.getByText('Payer le solde'));
  await waitFor(() => expect(reservationApi.initiateAccommodationMtnPayment).toHaveBeenCalledWith('reservation-1', '060000000', 'mobile-mtn:uuid-1', 'remaining_balance'));
});
