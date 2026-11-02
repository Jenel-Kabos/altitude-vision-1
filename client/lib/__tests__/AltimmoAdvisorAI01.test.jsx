// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — interface web du conseiller conversationnel.
// Services simulés : aucun appel réseau, aucun appel DeepSeek.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AltimmoAssistantGate from '../components/assistant/AltimmoAssistantGate';
import AltimmoAdvisorChat from '../components/assistant/AltimmoAdvisorChat';
import * as advisor from '../services/altimmoAdvisorService';
import * as assistant from '../services/altimmoAssistantService';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../services/altimmoAssistantService', () => ({ getAssistantStatus: vi.fn(), searchWithAssistant: vi.fn(), compareWithAssistant: vi.fn() }));
vi.mock('../services/altimmoAdvisorService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getAdvisorStatus: vi.fn(), getAdvisorConversation: vi.fn(), resetAdvisorConversation: vi.fn(), cancelAdvisorTurn: vi.fn(), streamAdvisorTurn: vi.fn() };
});
vi.mock('next/link', () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.setConfig({ testTimeout: 15000 });

const HOUSE = { id: '64b0000000000000000000a1', title: 'Maison familiale Moungali', type: 'Maison', status: 'location', price: 200000, pricePeriod: 'month', bedrooms: 3, surface: 120, address: { city: 'Brazzaville', arrondissement: 'Moungali' }, amenities: [], lodging: false, image: 'https://example.test/m.png' };
const VILLA = { id: '64b0000000000000000000a2', title: 'Villa meublée Plateau', type: 'Villa', status: 'hebergement', price: 150000, pricePeriod: 'night', address: { city: 'Brazzaville' }, amenities: [], lodging: true, hotelId: null };
const STATUS = { available: true, mode: 'simulé', environment: 'development' };
const final = (overrides = {}) => ({
  status: 'success', reply: 'J’ai trouvé une annonce publiée qui correspond : la Maison familiale Moungali à 200 000 FCFA par mois.',
  criteria: 'location · Maison · Moungali, Brazzaville', cards: [{ listing: HOUSE }],
  fits: { [HOUSE.id]: { strengths: ['dans votre budget'], limits: [], toVerify: ['proximité d’une école'] } },
  comparison: null, metrics: { mode: 'simulé', narration: 'model' }, ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  useAuth.mockReturnValue({ user: { _id: 'u1' }, loading: false });
  assistant.getAssistantStatus.mockResolvedValue(true);
  advisor.getAdvisorStatus.mockResolvedValue(STATUS);
  advisor.getAdvisorConversation.mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }));
});

const sendMessage = async (text) => {
  fireEvent.change(await screen.findByLabelText('Votre message'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
};

test('29 · visiteur non connecté ou compte non autorisé : l’assistant existant, sans appel au conseiller interdit', async () => {
  useAuth.mockReturnValue({ user: null, loading: false });
  const { unmount } = render(<AltimmoAssistantGate />);
  expect(await screen.findByRole('button', { name: 'Rechercher' })).toBeInTheDocument();
  expect(advisor.getAdvisorStatus).not.toHaveBeenCalled();
  unmount();
  useAuth.mockReturnValue({ user: { _id: 'u2' }, loading: false });
  advisor.getAdvisorStatus.mockResolvedValue({ available: false });
  render(<AltimmoAssistantGate />);
  await waitFor(() => expect(advisor.getAdvisorStatus).toHaveBeenCalled());
  expect(await screen.findByRole('button', { name: 'Rechercher' })).toBeInTheDocument();
  expect(screen.queryByTestId('advisor-chat')).not.toBeInTheDocument();
});

test('29 · compte autorisé : conseiller affiché avec le mode actif, retour possible à la recherche guidée', async () => {
  render(<AltimmoAssistantGate />);
  expect(await screen.findByTestId('advisor-chat')).toBeInTheDocument();
  expect(screen.getByTestId('advisor-mode')).toHaveTextContent('Accès interne · Conseiller simulé (essais, sans DeepSeek)');
  fireEvent.click(screen.getByRole('button', { name: 'Utiliser la recherche guidée' }));
  expect(await screen.findByRole('button', { name: 'Rechercher' })).toBeInTheDocument();
});

test('21 · flux : fragments affichés puis réponse finale, critères retenus et cartes vers les fiches officielles', async () => {
  advisor.streamAdvisorTurn.mockImplementation(async ({ onEvent }) => {
    onEvent({ event: 'status', data: { label: 'Recherche dans les annonces publiées' } });
    onEvent({ event: 'delta', data: { text: 'J’ai trouvé ' } });
    onEvent({ event: 'facts', data: { cards: [{ listing: HOUSE }], fits: {} } });
    return final();
  });
  render(<AltimmoAdvisorChat status={STATUS} />);
  await sendMessage('Je cherche une maison à louer à Moungali.');
  expect(await screen.findByText(/la Maison familiale Moungali à 200 000 FCFA par mois/)).toBeInTheDocument();
  expect(screen.getByText('Réponse : simulé')).toBeInTheDocument();
  expect(screen.getByTestId('advisor-criteria')).toHaveTextContent('location · Maison · Moungali, Brazzaville');
  expect(screen.getByRole('link', { name: 'Voir la fiche' })).toHaveAttribute('href', expect.stringContaining(HOUSE.id));
  expect(screen.getByText('Prix (par mois) : 200 000 FCFA')).toBeInTheDocument();
  expect(screen.getByText('? proximité d’une école')).toBeInTheDocument();
  const call = advisor.streamAdvisorTurn.mock.calls[0][0];
  expect(call).toMatchObject({ message: 'Je cherche une maison à louer à Moungali.' });
  expect(call.conversationId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
});

test('réponse de secours : distinguée d’une réponse rédigée par le modèle ; texte retiré remplacé', async () => {
  advisor.streamAdvisorTurn.mockImplementation(async ({ onEvent }) => {
    onEvent({ event: 'delta', data: { text: 'Texte coupé par le garde' } });
    return final({ retract: true, reply: 'Réponse vérifiée du moteur Altimmo.', metrics: { mode: 'deepseek', narration: 'fallback' } });
  });
  render(<AltimmoAdvisorChat status={{ ...STATUS, mode: 'deepseek' }} />);
  await sendMessage('Brazzaville.');
  expect(await screen.findByText('Réponse vérifiée du moteur Altimmo.')).toBeInTheDocument();
  expect(screen.queryByText('Texte coupé par le garde')).not.toBeInTheDocument();
  expect(screen.getByText('Réponse : DeepSeek, réponse de secours vérifiée')).toBeInTheDocument();
});

test('14, 15 · hébergement : tarif par nuit et disponibilité explicitement non vérifiée', async () => {
  advisor.streamAdvisorTurn.mockResolvedValue(final({ cards: [{ listing: VILLA }], fits: {} }));
  render(<AltimmoAdvisorChat status={STATUS} />);
  await sendMessage('Un séjour de 3 nuits.');
  expect(await screen.findByText('Prix (par nuit) : 150 000 FCFA')).toBeInTheDocument();
  expect(screen.getByText('Hébergement annoncé')).toBeInTheDocument();
  expect(screen.getByText(/Disponibilités aux dates souhaitées non vérifiées/)).toBeInTheDocument();
});

test('cartes : une recherche sans résultat (compromis proposé) retire les annonces du tour précédent ; une question les garde', async () => {
  advisor.streamAdvisorTurn
    .mockResolvedValueOnce(final())
    .mockResolvedValueOnce(final({ status: 'needs_clarification', cards: [], reply: 'Quel budget maximum ?' }))
    .mockResolvedValueOnce(final({ status: 'alternative_proposed', cards: [], reply: 'Aucun séjour ne correspond ; une villa pourrait convenir.' }));
  render(<AltimmoAdvisorChat status={STATUS} />);
  await sendMessage('Maison à louer à Moungali.');
  expect(await screen.findAllByTestId('advisor-card')).toHaveLength(1);
  await sendMessage('Et avec une cour ?');
  await screen.findByText('Quel budget maximum ?');
  expect(screen.getAllByTestId('advisor-card')).toHaveLength(1);
  await sendMessage('Finalement pour un séjour.');
  await screen.findByText('Aucun séjour ne correspond ; une villa pourrait convenir.');
  expect(screen.queryAllByTestId('advisor-card')).toHaveLength(0);
});

test('22 · annulation : demande serveur puis interruption locale, message clair', async () => {
  advisor.streamAdvisorTurn.mockImplementation(({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' })));
  }));
  render(<AltimmoAdvisorChat status={STATUS} />);
  await sendMessage('Je cherche une villa.');
  fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
  expect(await screen.findByTestId('advisor-error-cancelled')).toHaveTextContent('Vos critères validés sont conservés');
  expect(advisor.cancelAdvisorTurn).toHaveBeenCalledWith(expect.any(String), advisor.streamAdvisorTurn.mock.calls[0][0].turnId);
});

test('23 · reprise : la conversation de l’onglet est relue côté serveur', async () => {
  window.sessionStorage.setItem('altimmo.advisor.conversation', 'conv-reprise-01');
  advisor.getAdvisorConversation.mockResolvedValue({ messages: [{ role: 'user', content: 'Maison à Moungali' }, { role: 'assistant', content: 'Voici la maison de Moungali.' }], criteria: 'Maison · Moungali', cards: [{ listing: HOUSE }] });
  render(<AltimmoAdvisorChat status={STATUS} />);
  expect(await screen.findByText('Voici la maison de Moungali.')).toBeInTheDocument();
  expect(advisor.getAdvisorConversation).toHaveBeenCalledWith('conv-reprise-01');
  expect(screen.getByTestId('advisor-criteria')).toHaveTextContent('Maison · Moungali');
});

test('24 · réinitialisation : conversation effacée côté serveur, nouvel identifiant', async () => {
  window.sessionStorage.setItem('altimmo.advisor.conversation', 'conv-reset-0001');
  advisor.getAdvisorConversation.mockResolvedValue({ messages: [{ role: 'assistant', content: 'Ancienne réponse' }], criteria: 'Maison', cards: [] });
  render(<AltimmoAdvisorChat status={STATUS} />);
  await screen.findByText('Ancienne réponse');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Nouvelle conversation' })); });
  expect(advisor.resetAdvisorConversation).toHaveBeenCalledWith('conv-reset-0001');
  expect(screen.queryByText('Ancienne réponse')).not.toBeInTheDocument();
  expect(window.sessionStorage.getItem('altimmo.advisor.conversation')).not.toBe('conv-reset-0001');
});

test('13 · comparaison : tableau IA-03 rendu à partir de la réponse du conseiller', async () => {
  const envelope = { status: 'success', items: [{ id: HOUSE.id, label: 'A', listing: { title: HOUSE.title }, advantages: [{ text: 'moins cher' }], disadvantages: [], unknowns: [] }, { id: 'b2', label: 'B', listing: { title: 'Appartement Bacongo' }, advantages: [], disadvantages: [{ text: 'plus petit' }], unknowns: [] }], grid: { rows: [{ group: 'prix', key: 'price', label: 'Prix', values: [{ display: '200 000 FCFA' }, { display: '150 000 FCFA' }] }] }, conclusion: { text: 'Choix selon votre priorité.' } };
  advisor.streamAdvisorTurn.mockResolvedValue(final({ status: 'comparison', cards: [], comparison: { items: [], envelope } }));
  render(<AltimmoAdvisorChat status={STATUS} />);
  await sendMessage('Compare les deux premiers.');
  expect(await screen.findByTestId('assistant-comparison')).toBeInTheDocument();
  expect(screen.getByText('Choix selon votre priorité.')).toBeInTheDocument();
});

test('erreurs : accès retiré, débit, réseau', async () => {
  const err = (status, code) => Object.assign(new Error('x'), { response: { status, data: { code } } });
  expect(advisor.classifyAdvisorError(err(403, 'ADVISOR_ACCESS_DENIED')).kind).toBe('disabled');
  expect(advisor.classifyAdvisorError(err(429)).kind).toBe('rate_limited');
  expect(advisor.classifyAdvisorError(new Error('offline')).kind).toBe('network');
  advisor.streamAdvisorTurn.mockRejectedValue(err(429));
  render(<AltimmoAdvisorChat status={STATUS} />);
  await sendMessage('Bonjour');
  expect(await screen.findByTestId('advisor-error-rate_limited')).toBeInTheDocument();
});

test('transport SSE : découpage par blocs, fragments répartis entre paquets, erreur de tour propagée', async () => {
  const real = await vi.importActual('../services/altimmoAdvisorService');
  const seen = [];
  const parser = real.createSseParser((e) => seen.push(e));
  parser.push('event: delta\ndata: {"text":"Bon');
  parser.push('jour"}\n\nevent: final\ndata: {"reply":"ok"}\n\n');
  expect(seen).toEqual([{ event: 'delta', data: { text: 'Bonjour' } }, { event: 'final', data: { reply: 'ok' } }]);
  const body = (text) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(text)); c.close(); } }), { status: 200 });
  const fetchImpl = vi.fn(async () => body('event: status\ndata: {"label":"x"}\n\nevent: final\ndata: {"reply":"Fin","cards":[]}\n\n'));
  window.localStorage.setItem('token', 'jeton-test');
  await expect(real.streamAdvisorTurn({ conversationId: 'conv-test-0001', turnId: 't1', message: 'Bonjour', fetchImpl })).resolves.toMatchObject({ reply: 'Fin' });
  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toMatch(/\/altimmo\/advisor\/conversations\/conv-test-0001\/turns$/);
  expect(init.headers).toMatchObject({ Accept: 'text/event-stream', Authorization: 'Bearer jeton-test' });
  const cancelled = vi.fn(async () => body('event: error\ndata: {"code":"ADVISOR_TURN_CANCELLED","message":"Demande annulée."}\n\n'));
  await expect(real.streamAdvisorTurn({ conversationId: 'conv-test-0001', turnId: 't2', message: 'x', fetchImpl: cancelled })).rejects.toMatchObject({ response: { status: 499 } });
});
