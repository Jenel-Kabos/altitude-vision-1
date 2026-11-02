/* global AbortController */
// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — conseiller conversationnel mobile. Services simulés : aucun réseau.
import React from 'react';
import { AppState } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdvisorScreen from '../AdvisorScreen';
import AssistantGateScreen from '../AssistantGateScreen';
import * as advisor from '../../../services/altimmoAdvisorService';
import { getAssistantStatus } from '../../../services/altimmoAssistantService';
import { useAuth } from '../../../context/AuthContext';

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
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ themeColors: require('../../../theme/colors').colors, isDark: false }) }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../services/altimmoAssistantService', () => ({ getAssistantStatus: jest.fn(), searchWithAssistant: jest.fn(), compareWithAssistant: jest.fn() }));
jest.mock('../../../services/altimmoAdvisorService', () => {
  const actual = jest.requireActual('../../../services/altimmoAdvisorService');
  return { ...actual, getAdvisorStatus: jest.fn(), getAdvisorConversation: jest.fn(), resetAdvisorConversation: jest.fn(), cancelAdvisorTurn: jest.fn(), sendAdvisorTurn: jest.fn() };
});

const HOUSE = { id: '64b0000000000000000000a1', title: 'Maison familiale Moungali', type: 'Maison', status: 'location', price: 200000, pricePeriod: 'month', bedrooms: 3, address: { city: 'Brazzaville', arrondissement: 'Moungali' } };
const HOTEL = { id: '64b0000000000000000000a3', title: 'Hôtel fictif du Centre', type: 'Commerce', status: 'hebergement', price: 25000, pricePeriod: 'night', address: { city: 'Brazzaville' }, lodging: true, hotelId: '64b0000000000000000000f1' };
const STATUS = { available: true, mode: 'deepseek' };
const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const final = (overrides = {}) => ({ status: 'success', reply: 'Voici la maison de Moungali à 200 000 FCFA par mois.', criteria: 'location · Maison · Moungali', cards: [{ listing: HOUSE }], fits: {}, comparison: null, metrics: { mode: 'deepseek', narration: 'model' }, ...overrides });

beforeEach(async () => {
  jest.clearAllMocks();
  // Réponses « une fois » restées en file d'un test précédent : vidées pour les seuls services du conseiller.
  [advisor.getAdvisorStatus, advisor.getAdvisorConversation, advisor.resetAdvisorConversation, advisor.cancelAdvisorTurn, advisor.sendAdvisorTurn].forEach((fn) => fn.mockReset());
  await AsyncStorage.clear();
  useAuth.mockReturnValue({ user: { _id: 'u1' }, loading: false });
  getAssistantStatus.mockResolvedValue(true);
  advisor.getAdvisorStatus.mockResolvedValue(STATUS);
  advisor.getAdvisorConversation.mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }));
});

const send = async (text) => {
  fireEvent.changeText(await screen.findByLabelText('Votre message'), text);
  await waitFor(() => expect(screen.getByLabelText('Envoyer')).not.toBeDisabled());
  fireEvent.press(screen.getByLabelText('Envoyer'));
};

test('30 · aiguillage : compte non autorisé → assistant existant ; compte autorisé → conseiller', async () => {
  advisor.getAdvisorStatus.mockResolvedValue({ available: false });
  const first = render(<AssistantGateScreen navigation={nav()} route={{ params: {} }} />);
  expect(await screen.findByLabelText('Décrivez votre recherche')).toBeTruthy();
  first.unmount();
  useAuth.mockReturnValue({ user: null, loading: false });
  const second = render(<AssistantGateScreen navigation={nav()} route={{ params: {} }} />);
  expect(await screen.findByLabelText('Décrivez votre recherche')).toBeTruthy();
  expect(advisor.getAdvisorStatus).toHaveBeenCalledTimes(1); // aucun appel sans session
  second.unmount();
  useAuth.mockReturnValue({ user: { _id: 'u1' }, loading: false });
  advisor.getAdvisorStatus.mockResolvedValue(STATUS);
  render(<AssistantGateScreen navigation={nav()} route={{ params: {} }} />);
  expect(await screen.findByTestId('advisor-screen')).toBeTruthy();
  expect(screen.getByText('Accès interne · Conseiller DeepSeek')).toBeTruthy();
});

test('30 · envoi : fragments, réponse finale, critères, origine de la réponse, ouverture de la fiche', async () => {
  advisor.sendAdvisorTurn.mockImplementation(async ({ onEvent }) => {
    onEvent({ event: 'status', data: { label: 'Recherche dans les annonces publiées' } });
    onEvent({ event: 'delta', data: { text: 'Voici ' } });
    return final();
  });
  const navigation = nav();
  render(<AdvisorScreen navigation={navigation} status={STATUS} />);
  await send('Je cherche une maison à louer à Moungali.');
  expect(await screen.findByText('Voici la maison de Moungali à 200 000 FCFA par mois.')).toBeTruthy();
  expect(screen.getByText('Réponse : DeepSeek')).toBeTruthy();
  expect(screen.getByTestId('advisor-criteria')).toHaveTextContent('Critères retenus : location · Maison · Moungali');
  expect(screen.getByText('Prix (par mois) : 200 000 FCFA')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Voir la fiche Maison familiale Moungali'));
  expect(navigation.navigate).toHaveBeenCalledWith('DetailAnnonce', { resourceType: 'property', resourceId: HOUSE.id });
  expect(advisor.sendAdvisorTurn.mock.calls[0][0].conversationId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
});

test('30 · hébergement : tarif par nuit, disponibilité non vérifiée, fiche hôtel publique', async () => {
  advisor.sendAdvisorTurn.mockResolvedValue(final({ cards: [{ listing: HOTEL }], metrics: { mode: 'secours', narration: 'deterministic' } }));
  const navigation = nav();
  render(<AdvisorScreen navigation={navigation} status={STATUS} />);
  await send('Un hôtel pour 2 nuits.');
  expect(await screen.findByText('Prix (par nuit) : 25 000 FCFA')).toBeTruthy();
  expect(screen.getByText(/Disponibilités aux dates souhaitées non vérifiées/)).toBeTruthy();
  expect(screen.getByText('Réponse : moteur Altimmo (secours)')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Voir la fiche Hôtel fictif du Centre'));
  expect(navigation.navigate).toHaveBeenCalled();
});

test('30 · annulation : demande serveur puis interruption, critères conservés', async () => {
  advisor.sendAdvisorTurn.mockImplementation(({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' })));
  }));
  render(<AdvisorScreen navigation={nav()} status={STATUS} />);
  await send('Je cherche une villa.');
  fireEvent.press(await screen.findByLabelText('Annuler'));
  expect(await screen.findByTestId('advisor-error-cancelled')).toBeTruthy();
  expect(advisor.cancelAdvisorTurn).toHaveBeenCalledWith(expect.any(String), advisor.sendAdvisorTurn.mock.calls[0][0].turnId);
});

test('30 · interruption de l’application : la mémoire validée est relue au retour au premier plan', async () => {
  await AsyncStorage.setItem('altimmo.advisor.conversation', 'conv-mobile-0001');
  advisor.getAdvisorConversation.mockResolvedValueOnce({ messages: [{ role: 'assistant', content: 'Premier échange.' }], criteria: 'Maison', cards: [] });
  const listeners = [];
  const original = AppState.addEventListener;
  AppState.addEventListener = (_event, handler) => { listeners.push(handler); return { remove: () => {} }; };
  try {
  render(<AdvisorScreen navigation={nav()} status={STATUS} />);
  expect(await screen.findByText('Premier échange.')).toBeTruthy();
  advisor.getAdvisorConversation.mockResolvedValueOnce({ messages: [{ role: 'assistant', content: 'Premier échange.' }, { role: 'user', content: 'Moungali' }, { role: 'assistant', content: 'Réponse reçue pendant l’interruption.' }], criteria: 'Maison · Moungali', cards: [{ listing: HOUSE }] });
  await act(async () => { listeners.forEach((handler) => handler('active')); });
  expect(await screen.findByText('Réponse reçue pendant l’interruption.')).toBeTruthy();
  expect(advisor.getAdvisorConversation).toHaveBeenCalledWith('conv-mobile-0001');
  } finally { AppState.addEventListener = original; }
});

test('30 · réinitialisation : conversation effacée côté serveur, nouvel identifiant mémorisé', async () => {
  await AsyncStorage.setItem('altimmo.advisor.conversation', 'conv-mobile-reset');
  advisor.getAdvisorConversation.mockResolvedValue({ messages: [{ role: 'assistant', content: 'Ancien échange.' }], criteria: 'Maison', cards: [] });
  render(<AdvisorScreen navigation={nav()} status={STATUS} />);
  await screen.findByText('Ancien échange.');
  await act(async () => { fireEvent.press(screen.getByLabelText('Nouvelle conversation')); });
  expect(advisor.resetAdvisorConversation).toHaveBeenCalledWith('conv-mobile-reset');
  await waitFor(() => expect(screen.queryByText('Ancien échange.')).toBeNull());
  expect(await AsyncStorage.getItem('altimmo.advisor.conversation')).not.toBe('conv-mobile-reset');
});

describe('transport XMLHttpRequest', () => {
  jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => 'jeton-mobile'), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
  const real = jest.requireActual('../../../services/altimmoAdvisorService');
  function fakeXhr(script) {
    return class FakeXhr {
      constructor() { this.headers = {}; this.responseText = ''; this.status = 0; FakeXhr.last = this; }
      open(method, url) { this.method = method; this.url = url; }
      setRequestHeader(key, value) { this.headers[key] = value; }
      abort() { this.aborted = true; }
      send(body) { this.body = body; script(this); }
    };
  }

  test('flux progressif : événements traités au fil de la réception, réponse finale résolue', async () => {
    const seen = [];
    const XHR = fakeXhr((xhr) => {
      xhr.status = 200;
      setTimeout(() => { xhr.responseText = 'event: status\ndata: {"label":"Analyse"}\n\nevent: delta\ndata: {"text":"Bon'; xhr.onprogress(); }, 0);
      setTimeout(() => { xhr.responseText += 'jour"}\n\nevent: final\ndata: {"reply":"Bonjour","cards":[]}\n\n'; xhr.onprogress(); xhr.onload(); }, 5);
    });
    const result = await real.sendAdvisorTurn({ conversationId: 'conv-xhr-0001', turnId: 't1', message: 'Bonjour', onEvent: (e) => seen.push(e.event), XHR });
    expect(result.reply).toBe('Bonjour');
    expect(seen).toEqual(['status', 'delta', 'final']);
    expect(XHR.last.url).toMatch(/\/altimmo\/advisor\/conversations\/conv-xhr-0001\/turns$/);
    expect(XHR.last.headers).toMatchObject({ Accept: 'text/event-stream', 'Content-Type': 'application/json' });
    expect(JSON.parse(XHR.last.body)).toEqual({ message: 'Bonjour', turnId: 't1' });
  });

  test('réponse livrée en une fois (sans progression) : même résultat', async () => {
    const XHR = fakeXhr((xhr) => { setTimeout(() => { xhr.status = 200; xhr.responseText = 'event: final\ndata: {"reply":"Fin"}\n\n'; xhr.onload(); }, 0); });
    await expect(real.sendAdvisorTurn({ conversationId: 'conv-xhr-0002', turnId: 't2', message: 'x', XHR })).resolves.toMatchObject({ reply: 'Fin' });
  });

  test('refus serveur, annulation locale, coupure réseau', async () => {
    const denied = fakeXhr((xhr) => { setTimeout(() => { xhr.status = 403; xhr.responseText = '{"code":"ADVISOR_ACCESS_DENIED"}'; xhr.onload(); }, 0); });
    const refusal = await real.sendAdvisorTurn({ conversationId: 'conv-xhr-0003', turnId: 't3', message: 'x', XHR: denied }).catch((e) => e);
    expect(real.classifyAdvisorError(refusal).kind).toBe('disabled');
    const controller = new AbortController();
    const hanging = fakeXhr(() => {});
    const pending = real.sendAdvisorTurn({ conversationId: 'conv-xhr-0004', turnId: 't4', message: 'x', signal: controller.signal, XHR: hanging });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(hanging.last.aborted).toBe(true);
    const offline = fakeXhr((xhr) => { setTimeout(() => xhr.onerror(), 0); });
    const cut = await real.sendAdvisorTurn({ conversationId: 'conv-xhr-0005', turnId: 't5', message: 'x', XHR: offline }).catch((e) => e);
    expect(real.classifyAdvisorError(cut).kind).toBe('network');
  });
});
