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
  health: { level: 'conforme', checks: [] },
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

  test('affiche le badge de santé et le détail des alertes', async () => {
    getDossier.mockResolvedValue(baseDossier({
      health: { level: 'critique', checks: [{ key: 'paiement_en_retard', level: 'critique', label: '1 échéance en retard' }] },
    }));
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    expect(await screen.findByText(/Critique/)).toBeInTheDocument();
    expect(screen.getByText(/1 échéance en retard/)).toBeInTheDocument();
  });

  test('une action connue devient un lien vers la page qui porte le workflow réel', async () => {
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    const link = await screen.findByRole('link', { name: 'Générer une quittance' });
    expect(link).toHaveAttribute('href', '/dashboard/gestion-locative/documents?contratId=C1');
  });

  test('une clé d\'action inconnue ne produit jamais de bouton mort', async () => {
    getDossier.mockResolvedValue(baseDossier({ actions: [{ key: 'action_future_inconnue', label: 'Futur' }] }));
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    await screen.findByText('Bail — Villa Test');
    expect(screen.queryByText('Futur')).not.toBeInTheDocument();
  });

  // GL-UX-1 — Phase 7 : la section 'contrat' (cycleVie/caution/chaîne de
  // renouvellement) et 'avenants' (champsModifies) reçoivent un rendu riche
  // dédié — ces données existaient déjà dans l'API (GL-LIFE-1) mais
  // restaient invisibles jusqu'à ce sprint.
  test('affiche le cycle de vie et le statut de caution dans la section contrat', async () => {
    getDossier.mockResolvedValue(baseDossier({
      sections: [
        { key: 'contrat', label: 'Contrat', items: [{ id: 'C1', label: 'Version actuelle — actif', date: '2027-01-01', meta: { cycleVie: 'preavis', caution: { statut: 'bloquee', montantRetenu: 50000 } } }] },
      ],
    }));
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    expect(await screen.findByText('Préavis')).toBeInTheDocument();
    expect(screen.getByText(/Caution : Bloquée/)).toBeInTheDocument();
    expect(screen.getByText(/retenu 50 000 FCFA/)).toBeInTheDocument();
  });

  test('la chaîne de renouvellement ouvre le contrat lié dans un nouveau dossier', async () => {
    getDossier.mockImplementation((domain, entityId) => Promise.resolve(baseDossier({
      entityId,
      sections: entityId === 'C1'
        ? [{ key: 'contrat', label: 'Contrat', items: [{ id: 'C1', label: 'V1', meta: { renouvelePar: { contratId: 'C2', statut: 'actif' } } }] }]
        : [{ key: 'contrat', label: 'Contrat', items: [{ id: 'C2', label: 'V2', meta: {} }] }],
    })));
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    fireEvent.click(await screen.findByText(/Contrat suivant/));
    await waitFor(() => expect(getDossier).toHaveBeenCalledWith('gestion_locative', 'C2'));
    expect(await screen.findAllByText('Bail — Villa Test')).toHaveLength(2); // le dossier ouvrant + le dossier lié
  });

  test('un avenant affiche le détail avant/après des champs modifiés', async () => {
    getDossier.mockResolvedValue(baseDossier({
      sections: [
        { key: 'avenants', label: 'Avenants & renouvellements', items: [{ id: 'A1', label: 'Avenant — loyer', date: '2027-02-01', meta: { motif: 'Révision annuelle', champsModifies: [{ champ: 'montantLoyer', avant: 300000, apres: 320000 }] } }] },
      ],
    }));
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={() => {}} />);
    expect(await screen.findByText('Révision annuelle')).toBeInTheDocument();
    expect(screen.getByText(/300000 → 320000/)).toBeInTheDocument();
  });

  test('le bouton fermer appelle onClose', async () => {
    const onClose = vi.fn();
    render(<DossierPanel domain="gestion_locative" entityId="C1" onClose={onClose} />);
    await screen.findByText('Bail — Villa Test');
    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(onClose).toHaveBeenCalled();
  });
});

// GL-ASSET-UX-1 — Phase 7 : le dossier "bien" (domain='bien', GL-ASSET-1)
// reçoit lui aussi un rendu riche pour 'maintenance'/'transactions' — ces
// données existaient déjà dans l'enveloppe API (GL-ASSET-1), seul leur
// affichage était générique jusqu'ici.
describe('DossierPanel — domaine "bien" (GL-ASSET-1/GL-ASSET-UX-1)', () => {
  beforeEach(() => vi.clearAllMocks());

  test('affiche le coût, l\'entreprise et la garantie d\'une intervention de maintenance', async () => {
    getDossier.mockResolvedValue(baseDossier({
      domain: 'bien', entityId: 'P1',
      sections: [
        { key: 'maintenance', label: "Carnet d'entretien", items: [{ id: 'T1', label: 'plomberie — normale', date: '2027-01-01', meta: { status: 'resolu', actualCost: 50000, entrepriseIntervenante: 'Plomberie Congo', garantieJusquau: '2028-01-01' } }] },
      ],
    }));
    render(<DossierPanel domain="bien" entityId="P1" onClose={() => {}} />);
    expect(await screen.findByText(/Résolu/)).toBeInTheDocument();
    expect(screen.getByText(/50 000 FCFA/)).toBeInTheDocument();
    expect(screen.getByText(/Plomberie Congo/)).toBeInTheDocument();
    expect(screen.getByText(/Garantie jusqu'au/)).toBeInTheDocument();
  });

  test('affiche le montant d\'une transaction', async () => {
    getDossier.mockResolvedValue(baseDossier({
      domain: 'bien', entityId: 'P1',
      sections: [
        { key: 'transactions', label: 'Ventes / Transactions', items: [{ id: 'TX1', label: 'vente — Réussie', date: '2027-02-01', meta: { finalAmount: 50000000, status: 'Réussie' } }] },
      ],
    }));
    render(<DossierPanel domain="bien" entityId="P1" onClose={() => {}} />);
    expect(await screen.findByText(/50 000 000 FCFA/)).toBeInTheDocument();
  });
});
