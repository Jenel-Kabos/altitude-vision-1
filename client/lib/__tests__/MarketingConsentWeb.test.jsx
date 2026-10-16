// MARKETING-CONSENT-1 — web : cases d'inscription jamais précochées,
// panneau de préférences enregistré immédiatement, désinscription par lien
// uniquement après confirmation explicite, textes publics cohérents.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import MarketingConsentCheckboxes from '../components/MarketingConsentCheckboxes';
import MarketingPreferencesPanel from '../components/MarketingPreferencesPanel';
import MarketingUnsubscribePage from '../pages/MarketingUnsubscribePage';
import SupprimerMonCompte from '../pages/SupprimerMonCompte';
import * as service from '../services/marketingPreferencesService';

vi.mock('next/link', () => ({ default: ({ children, href }) => <a href={href}>{children}</a> }));
vi.mock('../services/marketingPreferencesService', () => ({
  getMarketingPreferences: vi.fn(), updateMarketingPreferences: vi.fn(), unsubscribeWithToken: vi.fn(),
}));

const prefs = (email, push) => ({ channels: { email: { granted: email, status: email ? 'granted' : 'unknown' }, push: { granted: push, status: push ? 'granted' : 'unknown' } } });

beforeEach(() => vi.clearAllMocks());

test('les cases de consentement ne sont jamais précochées et restent distinctes par canal', () => {
  const onChange = vi.fn();
  render(<MarketingConsentCheckboxes value={{ email: false, push: false }} onChange={onChange} />);
  const boxes = screen.getAllByRole('checkbox');
  expect(boxes).toHaveLength(2);
  boxes.forEach((box) => expect(box).not.toBeChecked());
  fireEvent.click(boxes[0]);
  expect(onChange).toHaveBeenCalledWith({ email: true, push: false });
});

test('le panneau de préférences reflète le serveur et enregistre un canal à la fois', async () => {
  service.getMarketingPreferences.mockResolvedValue(prefs(false, false));
  service.updateMarketingPreferences.mockResolvedValue(prefs(false, true));
  render(<MarketingPreferencesPanel />);
  const push = await screen.findByRole('switch', { name: 'Notifications promotionnelles' });
  expect(push).not.toBeChecked();
  fireEvent.click(push);
  await waitFor(() => expect(service.updateMarketingPreferences).toHaveBeenCalledWith({ push: true }));
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Notifications promotionnelles' })).toBeChecked());
  expect(screen.getByText(/restent toujours envoyés/)).toBeInTheDocument();
});

test('la désinscription n\'a lieu qu\'après confirmation explicite', async () => {
  service.unsubscribeWithToken.mockResolvedValue({ status: 'success' });
  render(<MarketingUnsubscribePage token="abc.def" />);
  expect(service.unsubscribeWithToken).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /confirmer ma désinscription/i }));
  await waitFor(() => expect(service.unsubscribeWithToken).toHaveBeenCalledWith('abc.def'));
  expect(await screen.findByRole('status')).toHaveTextContent(/désinscription est enregistrée/);
});

test('un lien sans jeton est signalé comme invalide, sans appel serveur', () => {
  render(<MarketingUnsubscribePage token="" />);
  expect(screen.getByRole('alert')).toHaveTextContent(/invalide/);
  expect(service.unsubscribeWithToken).not.toHaveBeenCalled();
});

test('la page publique de suppression décrit les effets marketing et les données conservées', () => {
  render(<SupprimerMonCompte />);
  expect(screen.getByText(/Consentements marketing/)).toBeInTheDocument();
  expect(screen.getByText(/Fiche de relation client \(CRM\)/)).toBeInTheDocument();
  expect(screen.getByText(/Contrat d'hébergement propriétaire \(PDF\)/)).toBeInTheDocument();
});
