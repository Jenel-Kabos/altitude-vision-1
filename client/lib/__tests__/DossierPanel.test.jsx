import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import DossierPanel from '../components/dashboard/DossierPanel';
import { getDossier } from '../services/dossierService';
import { previewRentalDocument } from '../services/gestionLocativeService';

// DOC-EVO-1 — moteur générique de dossier : un seul composant pour tous les
// domaines, pilotable uniquement par l'enveloppe uniforme renvoyée par
// l'API (server/services/dossier/). Aucune logique métier ici.
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/dossierService', () => ({ getDossier: vi.fn() }));
vi.mock('../services/gestionLocativeService', () => ({ previewRentalDocument: vi.fn(), downloadRentalDocument: vi.fn() }));

const baseDossier = (overrides = {}) => ({
  domain: 'gestion_locative', entityId: 'C1', status: 'Actif',
  summary: { title: 'Bail — Villa Test', subtitle: 'Locataire : Paul Moke', badges: ['location', 'actif'], fields: {} },
  relatedLinks: [
    { label: 'Villa Test', domain: 'property', entityType: 'Property', entityId: 'P1' },
    { label: 'Alice Nkounkou', domain: 'proprietaire', entityType: 'Proprietaire', entityId: 'PR1' },
  ],
  sections: [
    { key: 'documents', label: 'Documents', items: [{ id: 'D1', label: 'Bail signé', date: '2027-01-01', previewUrl: '/api/rental-documents/D1/download' }] },
    { key: 'paiements', label: 'Paiements', items: [] },
  ],
  timeline: [
    { date: '2027-01-01T00:00:00.000Z', label: 'Bail créé', type: 'contrat' },
    { date: '2027-01-05T00:00:00.000Z', label: 'Paiement — Échéance 01/2027', type: 'paiement' },
  ],
  actions: [{ key: 'generate_quittance', label: 'Générer une quittance' }],
  ...overrides,
});

describe('DossierPanel — moteur générique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDossier.mockResolvedValue(baseDossier());
  });

  test('affiche le résumé, le statut et les sections non vides uniquement', async () => {
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    expect(await screen.findByText('Bail — Villa Test')).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.queryByText('Paiements')).not.toBeInTheDocument(); // section vide masquée
  });

  test('affiche la navigation croisée vers une route connue (Property)', async () => {
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    const link = await screen.findByRole('link', { name: /Villa Test/ });
    expect(link).toHaveAttribute('href', '/properties/edit/P1');
  });

  test('un relatedLink sans route connue reste un texte informatif, jamais un lien cassé', async () => {
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    await screen.findByText('Bail — Villa Test');
    expect(screen.getByText('Alice Nkounkou')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Alice Nkounkou/ })).not.toBeInTheDocument();
  });

  test('affiche la timeline triée', async () => {
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    const items = await screen.findAllByText(/Bail créé|Paiement —/);
    expect(items[0]).toHaveTextContent('Bail créé');
    expect(items[1]).toHaveTextContent('Paiement —');
  });

  test('"Ouvrir" un document prévisualise via le téléchargement sécurisé (jamais l’URL brute)', async () => {
    previewRentalDocument.mockResolvedValue();
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir' }));
    await waitFor(() => expect(previewRentalDocument).toHaveBeenCalledWith('D1', 'Bail signé'));
  });

  test('403 : message clair sans planter', async () => {
    getDossier.mockRejectedValue({ response: { status: 403 } });
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    expect(await screen.findByText('Accès refusé à ce dossier.')).toBeInTheDocument();
  });

  test('le bouton fermer appelle onClose', async () => {
    const onClose = vi.fn();
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={onClose} />);
    await screen.findByText('Bail — Villa Test');
    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(onClose).toHaveBeenCalled();
  });
});
