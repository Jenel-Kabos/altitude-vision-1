import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HotelDetailScreen from '../HotelDetailScreen';
import { getPublicHotel, getHotelReviews, getNearbyHotels, searchHotelAvailability } from '../../../services/hotelReservationService';

jest.mock('@expo/vector-icons', () => { const ReactActual = require('react'); const RN = require('react-native'); return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) }; });
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View };
});
jest.mock('expo-linear-gradient', () => {
  const RN = require('react-native');
  return { LinearGradient: RN.View };
});
jest.mock('react-native-maps', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  const MockMapView = (props) => ReactActual.createElement(RN.View, { testID: 'hotel-map', ...props }, props.children);
  const MockMarker = (props) => ReactActual.createElement(RN.View, { testID: 'hotel-map-marker', ...props });
  return { __esModule: true, default: MockMapView, Marker: MockMarker, PROVIDER_DEFAULT: 'default', PROVIDER_GOOGLE: 'google' };
});
jest.mock('../../../services/hotelReservationService', () => ({ getPublicHotel: jest.fn(), searchHotelAvailability: jest.fn(), getHotelReviews: jest.fn(), getNearbyHotels: jest.fn() }));
jest.mock('@react-native-community/datetimepicker', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  // PHASE-H2 — stub minimal : "confirmer" avance toujours d'un jour après
  // `minimumDate` (valide pour l'arrivée comme pour le départ, jamais un
  // ordre de dates invalide dans les tests).
  return function MockDateTimePicker(props) {
    return ReactActual.createElement(RN.TouchableOpacity, {
      testID: `date-picker-${props.mode}`,
      accessibilityLabel: 'Confirmer la date',
      onPress: () => props.onChange({ type: 'set' }, new Date(props.minimumDate.getTime() + 86400000)),
    }, ReactActual.createElement(RN.Text, null, 'confirmer'));
  };
});

const navigation = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() };

const fullDetail = {
  id: 'hotel-1',
  name: 'Altitude Palace',
  brand: 'Altitude Collection',
  hotelType: 'hotel',
  starRating: 4,
  description: 'A'.repeat(220),
  gallery: [{ url: 'https://placehold.co/800x600/png?text=1' }, { url: 'https://placehold.co/800x600/png?text=2' }],
  location: { address: 'Avenue de la Paix', neighborhood: 'Centre', district: 'Bacongo', city: 'Brazzaville', country: null, coordinates: [15.24, -4.26] },
  contact: { horaires: '24h/24', languesParlees: ['Français'] },
  amenities: { hotelServices: { restaurant: true, wifi: true, piscine: false }, services: ['Blanchisserie'] },
  // PHASE-H3 — clés normalisées (checkIn/checkOut remplacent checkInTime/
  // checkOutTime) + reviewSummary/faq désormais présents sur la fiche.
  policies: { checkIn: '14:00', checkOut: '11:00', cancellation: 'Gratuite 48h avant', pets: null, children: null, visitors: null, accessibility: null, smoking: null, deposit: null, paymentMethods: null, minimumAge: null },
  reviewSummary: { averageRating: null, reviewCount: 0, categories: null },
  faq: [],
  legal: null,
  roomCategories: [
    {
      id: 'cat-1', name: 'Chambre Deluxe', capacity: { maxAdults: 2, maxChildren: 1 }, bedCount: 2, size: 28,
      amenities: { salon: ['Climatisation'], internet: ['Wifi'] }, gallery: [{ url: 'https://placehold.co/800x600/png?text=room' }],
      rates: [{ id: 'rate-1', rateType: 'public', amount: 45000, currency: 'XAF' }],
    },
  ],
};

describe('HotelDetailScreen — Phase H1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getHotelReviews.mockResolvedValue({ reviews: [], pagination: { page: 1, limit: 5, total: 0, pages: 1 } });
    getNearbyHotels.mockResolvedValue([]);
  });

  test('affiche le squelette de chargement puis la fiche complète', async () => {
    getPublicHotel.mockResolvedValue({ detail: fullDetail });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    // Le premier test du fichier paie le coût d'initialisation à froid des
    // modules (transform Babel, polices, etc.) — délai de sécurité plus
    // large, jamais un signe d'un vrai problème d'implémentation (les 13
    // autres tests utilisant le même appel passent en ~100ms une fois
    // l'environnement chaud).
    await waitFor(() => expect(screen.getByText('Altitude Palace')).toBeTruthy(), { timeout: 5000 });
    expect(getPublicHotel).toHaveBeenCalledWith('hotel-1');
  });

  test('affiche identité, étoiles et localisation condensée', async () => {
    getPublicHotel.mockResolvedValue({ detail: fullDetail });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Altitude Palace')).toBeTruthy());
    expect(screen.getByText('hotel')).toBeTruthy();
    expect(screen.getByText('Bacongo, Brazzaville')).toBeTruthy();
    // PHASE-H3 a introduit une vraie section avis (donc le mot "avis" apparaît
    // légitimement) ; ce qui reste interdit, c'est une note/qualification
    // inventée à côté de l'identité, hors de la section Évaluations.
    expect(screen.queryByText(/8\.7|Excellent/i)).toBeNull();
  });

  test('affiche les points forts dérivés des services actifs uniquement', async () => {
    getPublicHotel.mockResolvedValue({ detail: fullDetail });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Restaurant')).toBeTruthy());
    expect(screen.getByText('Wi-Fi')).toBeTruthy();
    expect(screen.queryByText('Piscine')).toBeNull();
  });

  test('la description longue est tronquée puis se déplie', async () => {
    getPublicHotel.mockResolvedValue({ detail: fullDetail });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Voir la description complète')).toBeTruthy());
    fireEvent.press(screen.getByText('Voir la description complète'));
    expect(screen.getByText('Réduire')).toBeTruthy();
  });

  test('affiche les politiques publiques et masque celles non renseignées', async () => {
    getPublicHotel.mockResolvedValue({ detail: fullDetail });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Gratuite 48h avant')).toBeTruthy());
    expect(screen.queryByText('Animaux')).toBeNull();
  });

  test('affiche l’aperçu de chambre avec capacité, lits, taille et tarif', async () => {
    getPublicHotel.mockResolvedValue({ detail: fullDetail });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Chambre Deluxe')).toBeTruthy());
    expect(screen.getByText('Dès 45 000 XAF / nuit')).toBeTruthy();
  });

  test('la barre CTA affiche le tarif le plus bas et navigue vers HotelBooking en préservant l’hotelId', async () => {
    getPublicHotel.mockResolvedValue({ detail: fullDetail });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByLabelText('Choisir une chambre')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Choisir une chambre'));
    expect(navigation.navigate).toHaveBeenCalledWith('HotelBooking', { hotelId: 'hotel-1' });
  });

  test('sans catégorie de chambre publiée, le CTA propose "Voir les chambres" et un message explicite', async () => {
    getPublicHotel.mockResolvedValue({ detail: { ...fullDetail, roomCategories: [] } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByLabelText('Voir les chambres')).toBeTruthy());
    expect(screen.getByText('Aucune catégorie de chambre publiée pour le moment.')).toBeTruthy();
  });

  test('sans galerie, un état vide explicite est affiché (jamais un écran blanc)', async () => {
    getPublicHotel.mockResolvedValue({ detail: { ...fullDetail, gallery: [] } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Aucune photo disponible')).toBeTruthy());
  });

  test('sans description, la section est simplement absente', async () => {
    getPublicHotel.mockResolvedValue({ detail: { ...fullDetail, description: null } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Altitude Palace')).toBeTruthy());
    expect(screen.queryByText('À propos')).toBeNull();
  });

  test('sans coordonnées, seule l’adresse textuelle est affichée (jamais de carte)', async () => {
    getPublicHotel.mockResolvedValue({ detail: { ...fullDetail, location: { ...fullDetail.location, coordinates: null } } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Carte indisponible pour cet établissement.')).toBeTruthy());
    expect(screen.queryByTestId('hotel-map')).toBeNull();
  });

  test('avec coordonnées, la carte intégrée s’affiche avec un marqueur (PHASE-H1.5)', async () => {
    getPublicHotel.mockResolvedValue({ detail: fullDetail });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByTestId('hotel-map')).toBeTruthy());
    expect(screen.getByTestId('hotel-map-marker')).toBeTruthy();
    expect(screen.queryByText('Carte indisponible pour cet établissement.')).toBeNull();
  });

  test('hôtel introuvable (404) affiche un message dédié et un retour', async () => {
    getPublicHotel.mockRejectedValue({ response: { status: 404 } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText(/n’a pas encore été publié/)).toBeTruthy());
    fireEvent.press(screen.getByText('Retour'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('erreur réseau propose de réessayer', async () => {
    getPublicHotel.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ detail: fullDetail });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Réessayer')).toBeTruthy());
    fireEvent.press(screen.getByText('Réessayer'));
    await waitFor(() => expect(screen.getByText('Altitude Palace')).toBeTruthy());
  });

  test('sans hotelId dans les params, un message dédié est affiché sans planter', async () => {
    render(<HotelDetailScreen navigation={navigation} route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByText('Cet hôtel est introuvable.')).toBeTruthy());
    expect(getPublicHotel).not.toHaveBeenCalled();
  });
});

describe('HotelDetailScreen — Phase H2 (recherche + disponibilité en direct)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPublicHotel.mockResolvedValue({ detail: fullDetail });
    getHotelReviews.mockResolvedValue({ reviews: [], pagination: { page: 1, limit: 5, total: 0, pages: 1 } });
    getNearbyHotels.mockResolvedValue([]);
  });

  const searchResult = {
    hotelId: 'hotel-1', search: { nights: 2, adults: 1, children: 0, rooms: 1 },
    roomCategories: [{
      id: 'cat-1', name: 'Chambre Deluxe', capacity: { maxAdults: 2, maxChildren: 1 }, beds: 2, size: 28,
      gallery: [], availableQuantity: 3,
      offers: [{
        ratePlanId: 'rate-1', rateType: 'public', amount: 45000, currency: 'XAF', nights: 2, totalAmount: 90000,
        // PHASE-H5 — conditions commerciales réelles (jamais fabriquées).
        mealPlan: 'breakfast_included', cancellation: { type: 'free_until', deadlineAt: '2026-09-12T00:00:00.000Z', penaltyType: null, penaltyValue: null },
      }],
    }],
  };

  async function performSearch() {
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Vérifier la disponibilité')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Choisir la date d’arrivée'));
    fireEvent.press(screen.getByTestId('date-picker-date'));
    fireEvent.press(screen.getByLabelText('Choisir la date de départ'));
    fireEvent.press(screen.getByTestId('date-picker-date'));
    fireEvent.press(screen.getByLabelText('Rechercher'));
  }

  test('un séjour sans dates ne peut pas être lancé (bouton désactivé)', async () => {
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Vérifier la disponibilité')).toBeTruthy());
    expect(searchHotelAvailability).not.toHaveBeenCalled();
  });

  test('une recherche valide affiche les catégories disponibles avec leurs offres réelles', async () => {
    searchHotelAvailability.mockResolvedValue(searchResult);
    await performSearch();
    await waitFor(() => expect(searchHotelAvailability).toHaveBeenCalledWith('hotel-1', expect.objectContaining({ adults: 1, rooms: 1 })));
    expect(await screen.findByText('Total 2 nuit(s) : 90 000 XAF')).toBeTruthy();
    expect(screen.getByText('Choisir')).toBeTruthy();
  });

  test('PHASE-H5 — les conditions commerciales réelles de l’offre sont affichées', async () => {
    searchHotelAvailability.mockResolvedValue(searchResult);
    await performSearch();
    expect(await screen.findByText('Petit-déjeuner inclus')).toBeTruthy();
    expect(screen.getByText(/Annulation gratuite jusqu’au 12\/09\/2026/)).toBeTruthy();
  });

  test('PHASE-H5 — une offre legacy sans conditions n’affiche aucun libellé fabriqué', async () => {
    searchHotelAvailability.mockResolvedValue({
      ...searchResult,
      roomCategories: [{
        ...searchResult.roomCategories[0],
        offers: [{ ratePlanId: 'rate-legacy', rateType: 'public', amount: 45000, currency: 'XAF', nights: 2, totalAmount: 90000, mealPlan: null, cancellation: null }],
      }],
    });
    await performSearch();
    await waitFor(() => expect(screen.getByText('Choisir')).toBeTruthy());
    expect(screen.queryByText('Petit-déjeuner inclus')).toBeNull();
    // Distinct de la politique hôtel H3 ("Annulation : Gratuite 48h avant"
    // dans Informations pratiques) : seul le libellé d'OFFRE H5 est visé ici.
    expect(screen.queryByText(/Annulation gratuite/)).toBeNull();
    expect(screen.queryByText(/Non remboursable/)).toBeNull();
    expect(screen.queryByText(/Repas non inclus/)).toBeNull();
  });

  test('choisir une offre navigue vers HotelBooking avec le contexte complet (catégorie/tarif/dates/voyageurs verrouillés)', async () => {
    searchHotelAvailability.mockResolvedValue(searchResult);
    await performSearch();
    fireEvent.press(await screen.findByText('Choisir'));
    expect(navigation.navigate).toHaveBeenCalledWith('HotelBooking', expect.objectContaining({
      hotelId: 'hotel-1', roomCategoryId: 'cat-1', ratePlanId: 'rate-1', adults: 1, children: 0, roomsCount: 1,
    }));
  });

  test('aucune disponibilité affiche un message dédié et permet de modifier les dates', async () => {
    searchHotelAvailability.mockResolvedValue({ ...searchResult, roomCategories: [] });
    await performSearch();
    expect(await screen.findByText('Aucune chambre disponible pour ces dates.')).toBeTruthy();
    fireEvent.press(screen.getByText('Modifier les dates'));
    expect(screen.queryByText('Aucune chambre disponible pour ces dates.')).toBeNull();
  });

  test('une erreur réseau sur la disponibilité propose de réessayer (jamais confondue avec "aucune disponibilité")', async () => {
    searchHotelAvailability.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(searchResult);
    await performSearch();
    expect(await screen.findByText('Impossible de vérifier la disponibilité. Vérifiez votre connexion.')).toBeTruthy();
    expect(screen.queryByText('Aucune chambre disponible pour ces dates.')).toBeNull();
    fireEvent.press(screen.getByText('Réessayer'));
    await waitFor(() => expect(screen.getByText('Total 2 nuit(s) : 90 000 XAF')).toBeTruthy());
  });

  test('des dates déjà fournies par la navigation lancent la recherche automatiquement', async () => {
    searchHotelAvailability.mockResolvedValue(searchResult);
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1', checkIn: '2026-12-01', checkOut: '2026-12-03', adults: 2 } }} />);
    await waitFor(() => expect(searchHotelAvailability).toHaveBeenCalledWith('hotel-1', expect.objectContaining({ checkIn: '2026-12-01', checkOut: '2026-12-03', adults: 2 })));
  });
});

describe('HotelDetailScreen — Phase H3 (avis, FAQ, politiques normalisées)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPublicHotel.mockResolvedValue({ detail: fullDetail });
    getNearbyHotels.mockResolvedValue([]);
  });

  test('aucun avis : état vide explicite, jamais une note par défaut inventée', async () => {
    getHotelReviews.mockResolvedValue({ reviews: [], pagination: { page: 1, limit: 5, total: 0, pages: 1 } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Évaluations des clients')).toBeTruthy());
    expect(await screen.findByText(/Aucun avis pour le moment/)).toBeTruthy();
    expect(screen.queryByText(/5\.0|Nouveau/)).toBeNull();
  });

  test('résumé + première page d’avis affichés avec indicateur de séjour vérifié', async () => {
    getPublicHotel.mockResolvedValue({ detail: { ...fullDetail, reviewSummary: { averageRating: 4.5, reviewCount: 2, categories: null } } });
    getHotelReviews.mockResolvedValue({
      reviews: [
        { id: 'r1', overallRating: 5, comment: 'Séjour exceptionnel.', author: 'Thibaut K.', verifiedStay: true, createdAt: new Date().toISOString() },
        { id: 'r2', overallRating: 4, comment: 'Très bon accueil.', author: 'Marie N.', verifiedStay: true, createdAt: new Date().toISOString() },
      ],
      pagination: { page: 1, limit: 5, total: 2, pages: 1 },
    });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    expect(await screen.findByText('4.5')).toBeTruthy();
    expect(screen.getByText('2 avis vérifiés')).toBeTruthy();
    expect(screen.getByText('Séjour exceptionnel.')).toBeTruthy();
    expect(screen.getAllByText('Séjour vérifié').length).toBe(2);
    expect(screen.queryByText('Voir plus d’avis')).toBeNull();
  });

  test('pagination des avis : "Voir plus d’avis" charge la page suivante et l’ajoute à la liste', async () => {
    getPublicHotel.mockResolvedValue({ detail: { ...fullDetail, reviewSummary: { averageRating: 5, reviewCount: 6, categories: null } } });
    getHotelReviews.mockResolvedValueOnce({
      reviews: [{ id: 'r1', overallRating: 5, comment: 'Premier avis.', author: 'A. B.', verifiedStay: true }],
      pagination: { page: 1, limit: 5, total: 6, pages: 2 },
    }).mockResolvedValueOnce({
      reviews: [{ id: 'r2', overallRating: 5, comment: 'Deuxième page.', author: 'C. D.', verifiedStay: true }],
      pagination: { page: 2, limit: 5, total: 6, pages: 2 },
    });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Premier avis.')).toBeTruthy());
    fireEvent.press(screen.getByText('Voir plus d’avis'));
    await waitFor(() => expect(getHotelReviews).toHaveBeenCalledWith('hotel-1', { page: 2, limit: 5 }));
    expect(await screen.findByText('Deuxième page.')).toBeTruthy();
    expect(screen.getByText('Premier avis.')).toBeTruthy();
  });

  test('FAQ : accordéon replié par défaut, se déplie au clic', async () => {
    getPublicHotel.mockResolvedValue({ detail: { ...fullDetail, faq: [{ id: 'faq-1', question: 'Le petit-déjeuner est-il inclus ?', answer: 'Oui, servi de 7h à 10h.' }] } });
    getHotelReviews.mockResolvedValue({ reviews: [], pagination: { page: 1, limit: 5, total: 0, pages: 1 } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Le petit-déjeuner est-il inclus ?')).toBeTruthy());
    expect(screen.queryByText('Oui, servi de 7h à 10h.')).toBeNull();
    fireEvent.press(screen.getByText('Le petit-déjeuner est-il inclus ?'));
    expect(await screen.findByText('Oui, servi de 7h à 10h.')).toBeTruthy();
  });

  test('sans FAQ publiée, aucune section FAQ n’est affichée', async () => {
    getPublicHotel.mockResolvedValue({ detail: { ...fullDetail, faq: [] } });
    getHotelReviews.mockResolvedValue({ reviews: [], pagination: { page: 1, limit: 5, total: 0, pages: 1 } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Évaluations des clients')).toBeTruthy());
    expect(screen.queryByText('Questions fréquentes')).toBeNull();
  });

  test('politiques : dépôt de garantie affiché comme un montant formaté, jamais un objet brut', async () => {
    getPublicHotel.mockResolvedValue({
      detail: { ...fullDetail, policies: { ...fullDetail.policies, deposit: { amount: 25000, currency: 'XAF' }, smoking: 'Non autorisé' } },
    });
    getHotelReviews.mockResolvedValue({ reviews: [], pagination: { page: 1, limit: 5, total: 0, pages: 1 } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    expect(await screen.findByText('25 000 XAF')).toBeTruthy();
    expect(screen.getByText('Non autorisé')).toBeTruthy();
  });

  test('navigation de section : les ancres présentes (avec données) sont proposées', async () => {
    getPublicHotel.mockResolvedValue({ detail: { ...fullDetail, faq: [{ id: 'faq-1', question: 'Q ?', answer: 'A.' }] } });
    getHotelReviews.mockResolvedValue({ reviews: [], pagination: { page: 1, limit: 5, total: 0, pages: 1 } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Altitude Palace')).toBeTruthy());
    ['Aperçu', 'Chambres', 'Évaluations', 'Emplacement', 'Services', 'Politiques', 'FAQ'].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  });

  test('sans services libres ni politiques renseignées, ces ancres de navigation sont absentes', async () => {
    getPublicHotel.mockResolvedValue({
      detail: { ...fullDetail, amenities: { hotelServices: {}, services: [] }, policies: {}, faq: [] },
    });
    getHotelReviews.mockResolvedValue({ reviews: [], pagination: { page: 1, limit: 5, total: 0, pages: 1 } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Altitude Palace')).toBeTruthy());
    expect(screen.queryByText('Politiques')).toBeNull();
    expect(screen.queryByText('FAQ')).toBeNull();
  });

  test('une erreur réseau sur les avis n’empêche pas l’affichage du reste de la fiche', async () => {
    getHotelReviews.mockRejectedValue(new Error('network'));
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Altitude Palace')).toBeTruthy());
    expect(screen.getByText('Évaluations des clients')).toBeTruthy();
  });
});

describe('HotelDetailScreen — Phase H4 (hôtels à proximité)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPublicHotel.mockResolvedValue({ detail: fullDetail });
    getHotelReviews.mockResolvedValue({ reviews: [], pagination: { page: 1, limit: 5, total: 0, pages: 1 } });
  });

  const nearbyHotels = [
    { hotelId: 'hotel-2', name: 'Hôtel Voisin', starRating: 3, hotelType: 'hotel', heroImage: 'https://placehold.co/400x300/png?text=near', city: 'Brazzaville', district: 'Poto-Poto', distanceMeters: 850, startingPrice: 32000, currency: 'XAF' },
    { hotelId: 'hotel-3', name: 'Hôtel Lointain', starRating: null, hotelType: null, heroImage: null, city: 'Brazzaville', district: null, distanceMeters: 4200, startingPrice: null, currency: null },
  ];

  test('la section "Hôtels à proximité" s’affiche avec les bonnes cartes', async () => {
    getNearbyHotels.mockResolvedValue(nearbyHotels);
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    expect(await screen.findByText('Hôtels à proximité')).toBeTruthy();
    expect(await screen.findByText('Hôtel Voisin')).toBeTruthy();
    expect(screen.getByText('Hôtel Lointain')).toBeTruthy();
    expect(getNearbyHotels).toHaveBeenCalledWith('hotel-1');
  });

  test('la distance est formatée en mètres sous 1 km, en kilomètres au-delà', async () => {
    getNearbyHotels.mockResolvedValue(nearbyHotels);
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    expect(await screen.findByText('850 m')).toBeTruthy();
    expect(screen.getByText('4.2 km')).toBeTruthy();
  });

  test('le tarif de départ est optionnel : affiché si fourni, absent sinon (jamais inventé)', async () => {
    getNearbyHotels.mockResolvedValue(nearbyHotels);
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Hôtel Lointain')).toBeTruthy());
    expect(screen.getByText('Dès 32 000 XAF')).toBeTruthy();
    expect(screen.queryByText(/Dès.*Hôtel Lointain/)).toBeNull();
  });

  test('taper sur une carte remplace la fiche courante (jamais un `push`, aucune pile qui grossit)', async () => {
    getNearbyHotels.mockResolvedValue(nearbyHotels);
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    fireEvent.press(await screen.findByText('Hôtel Voisin'));
    expect(navigation.replace).toHaveBeenCalledWith('HotelDetail', { hotelId: 'hotel-2' });
    expect(navigation.navigate).not.toHaveBeenCalledWith('HotelDetail', expect.anything());
  });

  test('aucun hôtel à proximité : état vide neutre, jamais une alternative inventée', async () => {
    getNearbyHotels.mockResolvedValue([]);
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    expect(await screen.findByText('Aucun autre hôtel à proximité pour le moment.')).toBeTruthy();
  });

  test('sans image, un repli visuel neutre est affiché (jamais un écran cassé)', async () => {
    getNearbyHotels.mockResolvedValue([nearbyHotels[1]]);
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    expect(await screen.findByText('Hôtel Lointain')).toBeTruthy();
  });

  test('une erreur réseau sur les hôtels à proximité n’empêche pas le reste de la fiche', async () => {
    getNearbyHotels.mockRejectedValue(new Error('network'));
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    await waitFor(() => expect(screen.getByText('Altitude Palace')).toBeTruthy());
    expect(await screen.findByText('Aucun autre hôtel à proximité pour le moment.')).toBeTruthy();
  });

  test('H3 (avis) continue de s’afficher malgré la nouvelle section H4', async () => {
    getNearbyHotels.mockResolvedValue(nearbyHotels);
    getHotelReviews.mockResolvedValue({ reviews: [{ id: 'r1', overallRating: 5, comment: 'Toujours là.', author: 'A. B.', verifiedStay: true }], pagination: { page: 1, limit: 5, total: 1, pages: 1 } });
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    expect(await screen.findByText('Toujours là.')).toBeTruthy();
  });

  test('H2 (chambres) continue de s’afficher malgré la nouvelle section H4', async () => {
    getNearbyHotels.mockResolvedValue(nearbyHotels);
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    expect(await screen.findByText('Chambre Deluxe')).toBeTruthy();
  });

  test('le CTA de réservation continue de fonctionner malgré la nouvelle section H4', async () => {
    getNearbyHotels.mockResolvedValue(nearbyHotels);
    render(<HotelDetailScreen navigation={navigation} route={{ params: { hotelId: 'hotel-1' } }} />);
    fireEvent.press(await screen.findByLabelText('Choisir une chambre'));
    expect(navigation.navigate).toHaveBeenCalledWith('HotelBooking', { hotelId: 'hotel-1' });
  });
});
