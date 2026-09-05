import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HotelReservationDetailScreen from '../HotelReservationDetailScreen';
import {
  getHotelReservation, getReservationAssignments, getCancellationEligibility, createHotelReview,
} from '../../../services/hotelReservationService';

jest.mock('@expo/vector-icons', () => { const ReactActual = require('react'); const RN = require('react-native'); return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) }; });
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => { const RN = require('react-native'); return { SafeAreaView: RN.View }; });
// `useFocusEffect` exige un vrai NavigationContainer — ce test ne porte pas
// sur la logique de focus, seulement sur le chargement au montage (même
// convention que ListeAnnoncesScreenRecommended.test.jsx).
jest.mock('@react-navigation/native', () => {
  const ReactActual = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useFocusEffect: (cb) => ReactActual.useEffect(() => { cb(); }, []) };
});
jest.mock('../../../services/hotelReservationService', () => ({
  getHotelReservation: jest.fn(), getReservationAssignments: jest.fn(), getCancellationEligibility: jest.fn(), createHotelReview: jest.fn(),
}));

const route = { params: { reservationId: 'res-1' } };

const baseReservation = {
  _id: 'res-1', reference: 'HTL-000001', status: 'checked_out',
  hotel: { _id: 'hotel-1', name: 'Altitude Palace' },
  checkInDate: '2026-01-10T00:00:00.000Z', checkOutDate: '2026-01-12T00:00:00.000Z',
  roomsCount: 1, adults: 2, totalAmount: 90000,
  rateSnapshot: { mealPlan: 'breakfast_included', cancellation: { type: 'free_until', deadlineHoursBeforeCheckIn: 48 } },
};

describe('HotelReservationDetailScreen — PHASE-H5 (conditions + complétion avis H3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getReservationAssignments.mockResolvedValue({ activeRoomAssignments: [], assignmentState: 'unassigned' });
    getCancellationEligibility.mockResolvedValue({ policyKnown: true, freeCancellation: true, deadlineAt: '2026-01-08T00:00:00.000Z' });
  });

  test('affiche les conditions tarifaires figées (mealPlan/cancellation du snapshot)', async () => {
    getHotelReservation.mockResolvedValue({ reservation: baseReservation, reviewEligibility: { eligible: false, alreadyReviewed: false } });
    render(<HotelReservationDetailScreen route={route} />);
    await waitFor(() => expect(screen.getByText('HTL-000001')).toBeTruthy());
    expect(screen.getByText('Petit-déjeuner inclus')).toBeTruthy();
    expect(screen.getByText('Annulation gratuite jusqu’à 48h avant l’arrivée')).toBeTruthy();
  });

  test('affiche les conditions d’annulation dérivées de l’éligibilité serveur', async () => {
    getHotelReservation.mockResolvedValue({ reservation: baseReservation, reviewEligibility: { eligible: false, alreadyReviewed: false } });
    render(<HotelReservationDetailScreen route={route} />);
    await waitFor(() => expect(screen.getByText(/Annulation gratuite jusqu’au/)).toBeTruthy());
  });

  test('réservation à venir (pending) : aucun CTA d’avis, jamais avant un séjour terminé', async () => {
    getHotelReservation.mockResolvedValue({ reservation: { ...baseReservation, status: 'pending' }, reviewEligibility: null });
    render(<HotelReservationDetailScreen route={route} />);
    await waitFor(() => expect(screen.getByText('HTL-000001')).toBeTruthy());
    expect(screen.queryByText('Donner votre avis')).toBeNull();
  });

  test('séjour terminé et non encore évalué : le CTA "Donner votre avis" apparaît (server-authoritative)', async () => {
    getHotelReservation.mockResolvedValue({ reservation: baseReservation, reviewEligibility: { eligible: true, alreadyReviewed: false } });
    render(<HotelReservationDetailScreen route={route} />);
    expect(await screen.findByText('Donner votre avis')).toBeTruthy();
  });

  test('déjà évalué : aucun CTA, message informatif à la place', async () => {
    getHotelReservation.mockResolvedValue({ reservation: baseReservation, reviewEligibility: { eligible: false, alreadyReviewed: true } });
    render(<HotelReservationDetailScreen route={route} />);
    await waitFor(() => expect(screen.getByText('Vous avez déjà évalué ce séjour.')).toBeTruthy());
    expect(screen.queryByText('Donner votre avis')).toBeNull();
  });

  test('le formulaire exige une note ET un commentaire avant envoi', async () => {
    getHotelReservation.mockResolvedValue({ reservation: baseReservation, reviewEligibility: { eligible: true, alreadyReviewed: false } });
    render(<HotelReservationDetailScreen route={route} />);
    fireEvent.press(await screen.findByText('Donner votre avis'));
    expect(await screen.findByLabelText('Envoyer mon avis')).toBeDisabled();
    fireEvent.press(screen.getByLabelText('4 étoile(s)'));
    expect(screen.getByLabelText('Envoyer mon avis')).toBeDisabled(); // commentaire encore vide
  });

  test('soumission réussie : formulaire masqué, état "déjà évalué" appliqué localement', async () => {
    getHotelReservation.mockResolvedValue({ reservation: baseReservation, reviewEligibility: { eligible: true, alreadyReviewed: false } });
    createHotelReview.mockResolvedValue({});
    render(<HotelReservationDetailScreen route={route} />);
    fireEvent.press(await screen.findByText('Donner votre avis'));
    fireEvent.press(screen.getByLabelText('5 étoile(s)'));
    fireEvent.changeText(screen.getByLabelText('Votre commentaire'), 'Excellent séjour.');
    fireEvent.press(screen.getByLabelText('Envoyer mon avis'));
    await waitFor(() => expect(createHotelReview).toHaveBeenCalledWith('hotel-1', { reservationId: 'res-1', overallRating: 5, comment: 'Excellent séjour.' }));
    await waitFor(() => expect(screen.getByText('Vous avez déjà évalué ce séjour.')).toBeTruthy());
  });

  test('doublon (409) : traité comme "déjà évalué", jamais une erreur générique confuse', async () => {
    getHotelReservation.mockResolvedValue({ reservation: baseReservation, reviewEligibility: { eligible: true, alreadyReviewed: false } });
    createHotelReview.mockRejectedValue({ response: { status: 409, data: { message: 'Cette réservation a déjà fait l’objet d’un avis.' } } });
    render(<HotelReservationDetailScreen route={route} />);
    fireEvent.press(await screen.findByText('Donner votre avis'));
    fireEvent.press(screen.getByLabelText('3 étoile(s)'));
    fireEvent.changeText(screen.getByLabelText('Votre commentaire'), 'x');
    fireEvent.press(screen.getByLabelText('Envoyer mon avis'));
    await waitFor(() => expect(screen.getByText('Vous avez déjà évalué ce séjour.')).toBeTruthy());
  });

  test('erreur de validation (422) : affichée dans le formulaire, jamais silencieuse', async () => {
    getHotelReservation.mockResolvedValue({ reservation: baseReservation, reviewEligibility: { eligible: true, alreadyReviewed: false } });
    createHotelReview.mockRejectedValue({ response: { status: 422, data: { message: 'La note globale doit être comprise entre 1 et 5.' } } });
    render(<HotelReservationDetailScreen route={route} />);
    fireEvent.press(await screen.findByText('Donner votre avis'));
    fireEvent.press(screen.getByLabelText('3 étoile(s)'));
    fireEvent.changeText(screen.getByLabelText('Votre commentaire'), 'x');
    fireEvent.press(screen.getByLabelText('Envoyer mon avis'));
    expect(await screen.findByText('La note globale doit être comprise entre 1 et 5.')).toBeTruthy();
    expect(screen.getByText('Donner votre avis')).toBeTruthy(); // le CTA reste actionnable, aucun état "déjà évalué" faux
  });

  test('erreur réseau : alerte générique, formulaire toujours actionnable ensuite', async () => {
    getHotelReservation.mockResolvedValue({ reservation: baseReservation, reviewEligibility: { eligible: true, alreadyReviewed: false } });
    createHotelReview.mockRejectedValue(new Error('network'));
    render(<HotelReservationDetailScreen route={route} />);
    fireEvent.press(await screen.findByText('Donner votre avis'));
    fireEvent.press(screen.getByLabelText('3 étoile(s)'));
    fireEvent.changeText(screen.getByLabelText('Votre commentaire'), 'x');
    fireEvent.press(screen.getByLabelText('Envoyer mon avis'));
    await waitFor(() => expect(createHotelReview).toHaveBeenCalled());
    expect(screen.getByLabelText('Envoyer mon avis')).toBeTruthy();
  });

  test('une erreur sur l’éligibilité d’annulation n’empêche pas l’affichage du reste', async () => {
    getHotelReservation.mockResolvedValue({ reservation: baseReservation, reviewEligibility: { eligible: false, alreadyReviewed: false } });
    getCancellationEligibility.mockRejectedValue(new Error('network'));
    render(<HotelReservationDetailScreen route={route} />);
    await waitFor(() => expect(screen.getByText('HTL-000001')).toBeTruthy());
    expect(screen.queryByText('Conditions d’annulation')).toBeNull();
  });
});
