// ALTIMMO-AI-INTEGRATION-02 — assistant mobile branché sur le contrat IA-03.
// Service simulé avec les réponses RÉELLES du moteur (jeu de référence partagé) ; aucun appel réseau.
import React from 'react';
import { Linking } from 'react-native';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';
import fixtures from '../../../../../shared/altimmoAssistant/contractFixtures.json';
import AssistantScreen from '../AssistantScreen';
import AssistantEntryCard from '../../../components/AssistantEntryCard';
import { getAssistantStatus, searchWithAssistant, compareWithAssistant } from '../../../services/altimmoAssistantService';

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});
jest.mock('@miblanchard/react-native-slider', () => ({ Slider: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ themeColors: require('../../../theme/colors').colors, isDark: false }) }));
jest.mock('../../../services/altimmoAssistantService', () => ({ getAssistantStatus: jest.fn(), searchWithAssistant: jest.fn(), compareWithAssistant: jest.fn() }));

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const httpError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
const firstId = (fixture, title) => fixture.data.rankedResults.find((item) => item.listing.title === title).listing.id;

beforeEach(() => {
  jest.clearAllMocks();
  getAssistantStatus.mockResolvedValue(true);
});

const type = async (text) => fireEvent.changeText(await screen.findByLabelText('Décrivez votre recherche'), text);
const search = () => fireEvent.press(screen.getByTestId('assistant-search'));

test('carte d’accueil : ouvre l’assistant', () => {
  const onPress = jest.fn();
  render(<AssistantEntryCard onPress={onPress} />);
  fireEvent.press(screen.getByLabelText('Trouver mon bien avec l’assistant'));
  expect(onPress).toHaveBeenCalled();
});

test('désactivé : aucun formulaire, aucune recherche', async () => {
  getAssistantStatus.mockResolvedValue(false);
  render(<AssistantScreen navigation={nav()} route={{}} />);
  expect(await screen.findByTestId('assistant-disabled')).toBeTruthy();
  expect(screen.queryByTestId('assistant-search')).toBeNull();
  expect(searchWithAssistant).not.toHaveBeenCalled();
});

test('recherche par critères : filtres envoyés, cartes et fiche du bien', async () => {
  searchWithAssistant.mockResolvedValue(fixtures.searchResults);
  const navigation = nav();
  render(<AssistantScreen navigation={navigation} route={{}} />);
  fireEvent.press(await screen.findByTestId('offer-location'));
  fireEvent.press(screen.getByLabelText('Maison'));
  fireEvent.press(screen.getByLabelText('Brazzaville'));
  fireEvent.press(screen.getByLabelText('Moungali'));
  fireEvent.changeText(screen.getByLabelText('Budget maximum en FCFA'), '300 000');
  await type('avec parking si possible');
  search();
  await waitFor(() => expect(searchWithAssistant).toHaveBeenCalledWith({
    query: 'avec parking si possible', filters: { offerType: 'location', propertyType: 'Maison', city: 'Brazzaville', arrondissement: 'Moungali', maxPrice: '300000' },
  }));
  const id = firstId(fixtures.searchResults, 'AI02 Maison Moungali 3 chambres');
  const card = await screen.findByTestId(`assistant-result-${id}`);
  expect(within(card).getByText('Loyer indiqué : 200 000 FCFA')).toBeTruthy();
  expect(within(card).getByText('✓ Parking confirmé.')).toBeTruthy();
  fireEvent.press(within(card).getByLabelText('Voir la fiche AI02 Maison Moungali 3 chambres'));
  expect(navigation.navigate).toHaveBeenCalledWith('DetailAnnonce', { resourceType: 'property', resourceId: id });
  expect(screen.queryByText(/score|confiance/i)).toBeNull();
});

test('informations manquantes, proximité non vérifiable, aucun résultat exact, critères incomplets', async () => {
  searchWithAssistant
    .mockResolvedValueOnce(fixtures.searchToVerify).mockResolvedValueOnce(fixtures.searchProximity)
    .mockResolvedValueOnce(fixtures.searchEmpty).mockResolvedValueOnce(fixtures.searchIncomplete);
  render(<AssistantScreen navigation={nav()} route={{}} />);
  await type('maison à louer à Moungali avec parking'); search();
  expect(await screen.findByText('Biens dont certaines informations sont à vérifier')).toBeTruthy();
  expect(screen.getByText('? Parking')).toBeTruthy();
  await type('maison à louer à Moungali proche d’un marché'); search();
  expect(await screen.findByText('Proche d’un marché (non vérifiable)')).toBeTruthy();
  expect(screen.getByText('Données non vérifiables')).toBeTruthy();
  await type('villa 6 chambres avec piscine'); search();
  expect(await screen.findByText('Aucune annonce ne correspond exactement à tous vos critères.')).toBeTruthy();
  await type('Brazzaville'); search();
  expect(await screen.findByText('Critères incomplets')).toBeTruthy();
});

test('comparaison de deux biens', async () => {
  searchWithAssistant.mockResolvedValue(fixtures.searchResults);
  compareWithAssistant.mockResolvedValue(fixtures.compareSelected);
  render(<AssistantScreen navigation={nav()} route={{}} />);
  await type('maison à louer à Moungali'); search();
  const ids = fixtures.searchResults.data.rankedResults.slice(0, 2).map((item) => item.listing.id);
  fireEvent.press(await screen.findByTestId(`compare-${ids[0]}`));
  fireEvent.press(screen.getByTestId(`compare-${ids[1]}`));
  fireEvent.press(screen.getByLabelText('Comparer les 2 biens sélectionnés'));
  const panel = await screen.findByTestId('assistant-comparison');
  expect(compareWithAssistant).toHaveBeenCalledWith({ propertyIds: ids, query: 'maison à louer à Moungali' });
  expect(within(panel).getAllByText('Avantages')).toHaveLength(2);
});

test('hôtel : page établissement, avertissement sur les dates', async () => {
  searchWithAssistant.mockResolvedValue(fixtures.searchHotel);
  const navigation = nav();
  render(<AssistantScreen navigation={navigation} route={{}} />);
  await type('hôtel à Brazzaville'); search();
  const listing = [...fixtures.searchHotel.data.rankedResults, ...fixtures.searchHotel.data.rankedCandidatesToVerify][0].listing;
  // Avertissement sur la carte et rappel constant du serveur.
  expect((await screen.findAllByText(/confirmées uniquement lors de la réservation/)).length).toBeGreaterThanOrEqual(2);
  fireEvent.press(screen.getByLabelText(`Voir la fiche ${listing.title}`));
  expect(navigation.navigate).toHaveBeenCalledWith('Profil', { screen: 'HotelDetail', params: { hotelId: listing.hotel } });
});

test.each([
  [httpError(503, fixtures.disabled), 'assistant-disabled'],
  [httpError(429, fixtures.rateLimited), 'assistant-error-rate_limited'],
  [httpError(500, {}), 'assistant-error-unavailable'],
  [new Error('Network Error'), 'assistant-error-network'],
])('erreur %#', async (error, testId) => {
  searchWithAssistant.mockRejectedValue(error);
  render(<AssistantScreen navigation={nav()} route={{}} />);
  await type('maison à louer à Moungali'); search();
  expect(await screen.findByTestId(testId)).toBeTruthy();
});

test('requêtes répétées : un seul envoi pendant la recherche ; formulaire vide refusé', async () => {
  searchWithAssistant.mockReturnValue(new Promise(() => {}));
  render(<AssistantScreen navigation={nav()} route={{}} />);
  fireEvent.press(await screen.findByTestId('assistant-search'));
  expect(await screen.findByTestId('assistant-error-incomplete')).toBeTruthy();
  await type('maison à louer à Moungali');
  search(); search(); search();
  expect(searchWithAssistant).toHaveBeenCalledTimes(1);
});

test('« Affiner avec l’assistant » : filtres de la liste repris, valeurs inconnues écartées', async () => {
  searchWithAssistant.mockResolvedValue(fixtures.searchResults);
  render(<AssistantScreen navigation={nav()} route={{ params: { filters: { offerType: 'location', city: 'Dolisie', arrondissement: 'Centre-ville', maxPrice: '300000' } } }} />);
  await waitFor(() => expect(searchWithAssistant).toHaveBeenCalledWith({ filters: { offerType: 'location', city: 'Dolisie', maxPrice: '300000' } }));
});

test('conseiller : lien WhatsApp de l’agence', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  searchWithAssistant.mockResolvedValue(fixtures.searchResults);
  render(<AssistantScreen navigation={nav()} route={{}} />);
  await type('maison à louer à Moungali'); search();
  fireEvent.press((await screen.findAllByLabelText('Parler à un conseiller'))[0]);
  expect(open.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/242068002151\?text=/);
});
