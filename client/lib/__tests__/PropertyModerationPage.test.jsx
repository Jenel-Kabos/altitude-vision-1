import { render, screen, fireEvent } from '@testing-library/react';
import PropertyModerationPage from '../pages/dashboard/PropertyModerationPage';
import api from '../services/api';

// HOTFIX-MODERATION-PROPERTY-SUBMITTER-CONTACT-1 — bloc "Soumis par" dans
// "Voir les détails" : nom/email/téléphone/rôle du vrai soumissionnaire
// (owner), déjà renvoyés par GET /properties/status/pending (voir
// server/__tests__/propertyRoutes.test.js), + bouton WhatsApp avec numéro
// normalisé et message prérempli.
vi.mock('@/lib/utils/toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

const basePendingProperty = (overrides = {}) => ({
  _id: 'PROP-1',
  title: 'Villa à Bacongo',
  description: 'Belle villa avec jardin.',
  type: 'Villa',
  status: 'vente',
  price: 50000000,
  pole: 'Altimmo',
  images: [],
  amenities: [],
  address: { city: 'Brazzaville' },
  createdAt: '2026-08-21T15:42:00.000Z',
  owner: {
    _id: 'USER-1', name: 'Jean Moukala', email: 'jean.moukala@example.test',
    phone: '+242 06 123 4567', role: 'Proprietaire', photo: '',
  },
  ...overrides,
});

describe('PropertyModerationPage — bloc "Soumis par"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function openDetails(property = basePendingProperty()) {
    api.get.mockResolvedValue({ data: { data: { properties: [property] } } });
    render(<PropertyModerationPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Voir les détails/i }));
  }

  test('affiche le nom du soumissionnaire', async () => {
    await openDetails();
    expect(await screen.findByText('Soumis par')).toBeInTheDocument();
    expect(screen.getByText('Jean Moukala')).toBeInTheDocument();
  });

  test('affiche l\'email du soumissionnaire', async () => {
    await openDetails();
    expect(await screen.findByText('jean.moukala@example.test')).toBeInTheDocument();
  });

  test('affiche le téléphone du soumissionnaire', async () => {
    await openDetails();
    expect(await screen.findByText('+242 06 123 4567')).toBeInTheDocument();
  });

  test('affiche le rôle traduit en label humain', async () => {
    await openDetails();
    expect(await screen.findByText('Propriétaire')).toBeInTheDocument();
  });

  test('affiche la date de soumission formatée en français', async () => {
    await openDetails();
    expect(await screen.findByText(/Soumis le 21 août 2026/)).toBeInTheDocument();
  });

  test('le bouton WhatsApp est visible et actif avec un numéro valide, URL wa.me correcte', async () => {
    await openDetails();
    const link = await screen.findByRole('link', { name: /Contacter Jean Moukala sur WhatsApp/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('https://wa.me/242061234567?text='));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('le message prérempli contient le titre de l\'annonce, correctement encodé', async () => {
    await openDetails();
    const link = await screen.findByRole('link', { name: /Contacter Jean Moukala sur WhatsApp/i });
    const href = link.getAttribute('href');
    const decoded = decodeURIComponent(href.split('?text=')[1]);
    expect(decoded).toContain('Villa à Bacongo');
    expect(decoded).toContain('Bonjour');
  });

  test('sans téléphone : le bouton WhatsApp est désactivé, jamais un lien actif', async () => {
    await openDetails(basePendingProperty({ owner: { _id: 'USER-2', name: 'Sans Téléphone', email: 'x@example.test', phone: '', role: 'Client' } }));
    expect(await screen.findByText('Numéro non renseigné')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Contacter.*WhatsApp/i })).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Contacter sur WhatsApp/i });
    expect(button).toBeDisabled();
  });

  test('numéro invalide : le bouton WhatsApp reste désactivé (jamais wa.me/undefined)', async () => {
    await openDetails(basePendingProperty({ owner: { _id: 'USER-3', name: 'Numéro Invalide', email: 'x@example.test', phone: '12', role: 'Client' } }));
    expect(screen.queryByRole('link', { name: /WhatsApp/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contacter sur WhatsApp/i })).toBeDisabled();
  });

  test('email absent : affiche un message explicite, jamais "undefined"', async () => {
    await openDetails(basePendingProperty({ owner: { _id: 'USER-4', name: 'Sans Email', email: '', phone: '+242061234567', role: 'Client' } }));
    expect(await screen.findByText('Email non renseigné')).toBeInTheDocument();
  });
});
