import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentsPage from '../pages/dashboard/DocumentsPage';
import { getAllDocuments } from '../services/documentService';
import { getContrats } from '../services/gestionLocativeService';
import api from '../services/api';

// DOC-ARCH-1 — un seul Centre documentaire pour toute la plateforme :
// explorateur Pôle → Service, réutilisation intégrale de RentalDocumentsPage
// (Contrat.documents[]) pour Gestion locative, jamais de duplication.
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/documentService', () => ({
  getAllDocuments: vi.fn(), createDocument: vi.fn(), updateDocument: vi.fn(), deleteDocument: vi.fn(),
}));
vi.mock('../services/gestionLocativeService', () => ({ getContrats: vi.fn(), previewRentalDocument: vi.fn(), downloadRentalDocument: vi.fn() }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { data: { users: [] } } })) } }));
// DOC-EVO-1 — DossierPanel (moteur générique de dossier) est monté par
// DocumentsPage/FinancialDocumentsFolder pour la navigation croisée.
vi.mock('../services/dossierService', () => ({ getDossier: vi.fn(), searchDossiers: vi.fn().mockResolvedValue([]) }));
// DOC-ARCH-2 — dossiers Hébergements/Hôtellerie : projection FinancialDocument
// en plus de la liste générique Document (voir FinancialDocumentsFolder.jsx).
vi.mock('../services/hotelService', () => ({ getHotelsAdmin: vi.fn().mockResolvedValue({ hotels: [] }) }));
vi.mock('../services/hotelFinancialService', () => ({
  listHotelFinancialDocuments: vi.fn().mockResolvedValue({ documents: [] }),
  listAccommodationFinancialDocuments: vi.fn().mockResolvedValue({ documents: [] }),
  downloadInvoicePdf: vi.fn(),
}));

let push;
let searchParamsValue = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}));

describe('DocumentsPage — DOC-ARCH-1 — Centre documentaire unifié', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    push = vi.fn();
    searchParamsValue = '';
    getAllDocuments.mockResolvedValue([]);
    getContrats.mockResolvedValue([]);
  });

  test('racine (aucun pole) : affiche l’explorateur de pôles, pas de liste de documents', async () => {
    render(<DocumentsPage />);
    expect(await screen.findByRole('button', { name: 'Altimmo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Altcom' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mila Events' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Administration Altitude Vision' })).toBeInTheDocument();
    expect(getAllDocuments).not.toHaveBeenCalled();
  });

  test('cliquer sur un pôle navigue vers ?pole=... (jamais un écran séparé)', async () => {
    render(<DocumentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Altimmo' }));
    expect(push).toHaveBeenCalledWith('/dashboard/documents?pole=Altimmo');
  });

  test('pole=Altimmo (sans service) : affiche les services du pôle', async () => {
    searchParamsValue = 'pole=Altimmo';
    render(<DocumentsPage />);
    expect(await screen.findByRole('button', { name: 'Gestion locative' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Propriétaires' })).toBeInTheDocument();
    expect(getAllDocuments).not.toHaveBeenCalled();
  });

  test('pole=Altimmo&service=gestion_locative : réutilise RentalDocumentsPage (Contrat.documents[]), sans bouton "Nouveau document"', async () => {
    searchParamsValue = 'pole=Altimmo&service=gestion_locative';
    getContrats.mockResolvedValue([{
      _id: 'C1', bien: { title: 'Villa Test' },
      documents: [{ _id: 'D1', nom: 'Bail signé', type: 'bail', url: 'https://cdn.test/bail.pdf', dateGeneration: '2027-01-01' }],
    }]);
    render(<DocumentsPage />);
    expect(await screen.findByText('Bail signé')).toBeInTheDocument();
    expect(getContrats).toHaveBeenCalledWith({ type: 'location' });
    expect(screen.queryByRole('button', { name: /nouveau document/i })).not.toBeInTheDocument();
  });

  test('pole=Altimmo&service=proprietaires : liste générique Document, filtrée côté API par pole/service', async () => {
    searchParamsValue = 'pole=Altimmo&service=proprietaires';
    getAllDocuments.mockResolvedValue([
      { _id: 'D1', type: "Pièce d'identité", status: 'Accepté', refNom: 'Jean Test', docNumber: 1 },
    ]);
    render(<DocumentsPage />);
    await waitFor(() => expect(getAllDocuments).toHaveBeenCalledWith({ pole: 'Altimmo', service: 'proprietaires' }));
    expect(await screen.findByRole('button', { name: /nouveau document/i })).toBeInTheDocument();
  });

  test('service invalide dans l’URL retombe silencieusement au niveau pôle (pas de crash)', async () => {
    searchParamsValue = 'pole=Altimmo&service=inexistant';
    render(<DocumentsPage />);
    expect(await screen.findByRole('button', { name: 'Gestion locative' })).toBeInTheDocument();
  });

  // DOC-ARCH-2 — classement 100% automatique : les factures hôtelières
  // (FinancialDocument, jamais dupliquées dans Document) apparaissent sans
  // aucune saisie manuelle dans Altimmo → Hôtellerie.
  test('pole=Altimmo&service=hotellerie : affiche les factures FinancialDocument automatiquement', async () => {
    const { getHotelsAdmin } = await import('../services/hotelService');
    const { listHotelFinancialDocuments } = await import('../services/hotelFinancialService');
    getHotelsAdmin.mockResolvedValue({ hotels: [{ _id: 'H1', name: 'Hotel Test' }] });
    listHotelFinancialDocuments.mockResolvedValue({ documents: [{ id: 'FD1', documentNumber: 'INV-001', status: 'issued', totalMinor: 500000, currency: 'XAF', issueDate: '2027-01-01' }] });
    searchParamsValue = 'pole=Altimmo&service=hotellerie';
    render(<DocumentsPage />);
    expect(await screen.findByText('INV-001')).toBeInTheDocument();
    expect(listHotelFinancialDocuments).toHaveBeenCalledWith('H1', { limit: 100 });
  });

  test('pole=Altimmo&service=hebergements : affiche les factures FinancialDocument automatiquement', async () => {
    const { listAccommodationFinancialDocuments } = await import('../services/hotelFinancialService');
    listAccommodationFinancialDocuments.mockResolvedValue({ documents: [{ id: 'FD2', documentNumber: 'INV-002', status: 'issued', totalMinor: 250000, currency: 'XAF', issueDate: '2027-02-01' }] });
    searchParamsValue = 'pole=Altimmo&service=hebergements';
    render(<DocumentsPage />);
    expect(await screen.findByText('INV-002')).toBeInTheDocument();
  });
});
