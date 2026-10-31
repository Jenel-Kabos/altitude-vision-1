// ALTIMMO-AI-INTEGRATION-02 — interface web de l'assistant branchée sur le contrat IA-03.
// Service simulé avec les réponses RÉELLES du moteur (jeu de référence partagé) ; aucun appel réseau.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fixtures from '../../../shared/altimmoAssistant/contractFixtures.json';
import AltimmoAssistant from '../components/assistant/AltimmoAssistant';
import AssistantEntryLink from '../components/assistant/AssistantEntryLink';
import { listingHref } from '../components/assistant/AssistantResults';
import * as service from '../services/altimmoAssistantService';

vi.mock('../services/altimmoAssistantService', () => ({
  getAssistantStatus: vi.fn(), searchWithAssistant: vi.fn(), compareWithAssistant: vi.fn(),
}));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));

const httpError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
vi.setConfig({ testTimeout: 15000 });

beforeEach(() => {
  vi.clearAllMocks();
  service.getAssistantStatus.mockResolvedValue(true);
});

const submit = async (text) => {
  if (text) fireEvent.change(await screen.findByLabelText('Décrivez votre recherche'), { target: { value: text } });
  fireEvent.click(await screen.findByRole('button', { name: 'Rechercher' }));
};

test('assistant désactivé : aucun formulaire, orientation vers les annonces, aucune recherche', async () => {
  service.getAssistantStatus.mockResolvedValue(false);
  render(<AltimmoAssistant />);
  expect(await screen.findByTestId('assistant-disabled')).toBeInTheDocument();
  expect(screen.getByText('L’assistant de recherche n’est pas encore disponible.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Voir les annonces' })).toHaveAttribute('href', '/immobilier/annonces');
  expect(screen.queryByRole('button', { name: 'Rechercher' })).not.toBeInTheDocument();
  expect(service.searchWithAssistant).not.toHaveBeenCalled();
});

test('chargement puis recherche : critères compris, cartes, liens vers les fiches officielles', async () => {
  let resolve;
  service.searchWithAssistant.mockReturnValue(new Promise((r) => { resolve = r; }));
  render(<AltimmoAssistant />);
  expect(screen.getByText('Chargement de l’assistant…')).toBeInTheDocument();
  fireEvent.change(await screen.findByLabelText('Projet'), { target: { value: 'location' } });
  fireEvent.change(screen.getByLabelText('Type de bien'), { target: { value: 'Maison' } });
  fireEvent.change(screen.getByLabelText('Ville'), { target: { value: 'Brazzaville' } });
  fireEvent.change(screen.getByLabelText('Arrondissement'), { target: { value: 'Moungali' } });
  fireEvent.change(screen.getByLabelText('Budget maximum (FCFA)'), { target: { value: '300 000' } });
  await submit('avec parking si possible');
  expect(screen.getByText('L’assistant recherche…')).toBeInTheDocument();
  expect(service.searchWithAssistant).toHaveBeenCalledWith({
    query: 'avec parking si possible',
    filters: { offerType: 'location', propertyType: 'Maison', city: 'Brazzaville', arrondissement: 'Moungali', maxPrice: '300000' },
  });
  resolve(fixtures.searchResults);
  const cards = await screen.findAllByTestId('assistant-result');
  expect(cards.length).toBe(fixtures.searchResults.data.rankedResults.length);
  const card = cards.find((element) => within(element).queryByText('AI02 Maison Moungali 3 chambres'));
  expect(within(card).getByText('Loyer indiqué : 200 000 FCFA')).toBeInTheDocument();
  expect(within(card).getByText('Critères satisfaits')).toBeInTheDocument();
  expect(within(card).getByText('✓ Parking confirmé.')).toBeInTheDocument();
  const id = fixtures.searchResults.data.rankedResults.find((item) => item.listing.title === 'AI02 Maison Moungali 3 chambres').listing.id;
  expect(within(card).getByRole('link', { name: 'Voir la fiche' })).toHaveAttribute('href', `/immobilier/property/${id}`);
  expect(within(card).getByRole('link', { name: 'Demander une visite' })).toHaveAttribute('href', `/immobilier/property/${id}`);
  expect(screen.getByRole('navigation', { name: 'Critères compris' })).toHaveTextContent('Souhaité : Parking');
  expect(document.body.textContent).not.toMatch(/score|confiance/i);
});

test('information manquante et proximité : sections « à vérifier » et « non vérifiable »', async () => {
  service.searchWithAssistant.mockResolvedValueOnce(fixtures.searchToVerify).mockResolvedValueOnce(fixtures.searchProximity);
  render(<AltimmoAssistant />);
  await submit('maison à louer à Moungali avec parking');
  expect(await screen.findByText('Biens dont certaines informations sont à vérifier')).toBeInTheDocument();
  expect(screen.getByText('? Parking')).toBeInTheDocument();
  await submit('Maison à louer à Moungali proche d’un marché');
  expect(await screen.findByText('Données non vérifiables')).toBeInTheDocument();
  expect(screen.getByText('Proche d’un marché (non vérifiable)')).toBeInTheDocument();
});

test('aucun résultat exact et critères incomplets', async () => {
  service.searchWithAssistant.mockResolvedValueOnce(fixtures.searchEmpty).mockResolvedValueOnce(fixtures.searchIncomplete);
  render(<AltimmoAssistant />);
  await submit('Villa 6 chambres avec piscine à Poto-Poto');
  expect(await screen.findByText('Aucune annonce ne correspond exactement à tous vos critères.')).toBeInTheDocument();
  expect(screen.queryAllByTestId('assistant-result')).toHaveLength(0);
  await submit('Brazzaville');
  expect(await screen.findByText('Critères incomplets')).toBeInTheDocument();
  expect(screen.getByText(fixtures.searchIncomplete.data.clarificationQuestions[0])).toBeInTheDocument();
});

test('formulaire vide : aucun appel, message de critères manquants', async () => {
  render(<AltimmoAssistant />);
  await submit();
  expect(await screen.findByTestId('assistant-error-incomplete')).toBeInTheDocument();
  expect(service.searchWithAssistant).not.toHaveBeenCalled();
});

test('comparaison de deux biens : tableau, avantages et limites', async () => {
  service.searchWithAssistant.mockResolvedValue(fixtures.searchResults);
  service.compareWithAssistant.mockResolvedValue(fixtures.compareSelected);
  render(<AltimmoAssistant />);
  await submit('maison à louer à Moungali');
  const boxes = await screen.findAllByRole('checkbox', { name: 'Comparer' });
  fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Comparer les 2 biens sélectionnés' }));
  const panel = await screen.findByTestId('assistant-comparison');
  expect(service.compareWithAssistant).toHaveBeenCalledWith({ propertyIds: expect.arrayContaining([expect.stringMatching(/^[0-9a-f]{24}$/)]), query: 'maison à louer à Moungali' });
  expect(within(panel).getByRole('table')).toBeInTheDocument();
  expect(within(panel).getAllByText('Avantages').length).toBe(2);
  expect(within(panel).getByText(/1 bien\(s\) sélectionné\(s\) ne sont plus publiés/)).toBeInTheDocument();
});

test('hôtel : page établissement et avertissement sur les dates', async () => {
  service.searchWithAssistant.mockResolvedValue(fixtures.searchHotel);
  render(<AltimmoAssistant />);
  await submit('hôtel à Brazzaville');
  const card = (await screen.findAllByTestId('assistant-result'))[0];
  const hotelId = fixtures.searchHotel.data.rankedResults[0]?.listing.hotel || fixtures.searchHotel.data.rankedCandidatesToVerify[0].listing.hotel;
  expect(within(card).getByRole('link', { name: 'Vérifier les dates et réserver' })).toHaveAttribute('href', `/immobilier/hotels/${hotelId}`);
  expect(within(card).getByText(/confirmées uniquement lors de la réservation/)).toBeInTheDocument();
});

test.each([
  [httpError(503, fixtures.disabled), 'assistant-disabled'],
  [httpError(429, fixtures.rateLimited), 'assistant-error-rate_limited'],
  [httpError(500, { code: 'ALTIMMO_ASSISTANT_UNAVAILABLE' }), 'assistant-error-unavailable'],
  [Object.assign(new Error('Network Error'), { request: {} }), 'assistant-error-network'],
])('erreur %#', async (error, testId) => {
  service.searchWithAssistant.mockRejectedValue(error);
  render(<AltimmoAssistant />);
  await submit('maison à louer à Moungali');
  expect(await screen.findByTestId(testId)).toBeInTheDocument();
});

test('requêtes répétées : un seul envoi pendant la recherche', async () => {
  service.searchWithAssistant.mockReturnValue(new Promise(() => {}));
  render(<AltimmoAssistant />);
  await submit('maison à louer à Moungali');
  fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
  fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
  expect(service.searchWithAssistant).toHaveBeenCalledTimes(1);
});

test('« Affiner avec l’assistant » : filtres repris, valeurs inconnues du moteur écartées', async () => {
  service.searchWithAssistant.mockResolvedValue(fixtures.searchResults);
  render(<AltimmoAssistant initialFilters={{ offerType: 'location', city: 'Dolisie', arrondissement: 'Centre-ville', maxPrice: '300000' }} />);
  await waitFor(() => expect(service.searchWithAssistant).toHaveBeenCalledWith({ filters: { offerType: 'location', city: 'Dolisie', maxPrice: '300000' } }));
});

test('lien d’entrée affiché seulement si l’assistant est activé', async () => {
  service.getAssistantStatus.mockResolvedValueOnce(false);
  const { unmount } = render(<AssistantEntryLink href="/immobilier/assistant">Affiner avec l’assistant</AssistantEntryLink>);
  await waitFor(() => expect(service.getAssistantStatus).toHaveBeenCalled());
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  unmount();
  service.getAssistantStatus.mockResolvedValueOnce(true);
  render(<AssistantEntryLink href="/immobilier/assistant">Affiner avec l’assistant</AssistantEntryLink>);
  expect(await screen.findByRole('link', { name: 'Affiner avec l’assistant' })).toHaveAttribute('href', '/immobilier/assistant');
});

test('liens : fiche d’annonce ou page d’établissement selon le registre de navigation', () => {
  expect(listingHref({ id: 'abc', hotelId: null })).toBe('/immobilier/property/abc');
  expect(listingHref({ id: 'abc', hotelId: 'h1' })).toBe('/immobilier/hotels/h1');
});
