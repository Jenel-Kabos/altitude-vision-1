import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import RentalDocumentsPage from '../pages/dashboard/RentalDocumentsPage';
import { getContrats, previewRentalDocument } from '../services/gestionLocativeService';
import { getAllDocuments } from '../services/documentService';

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/gestionLocativeService', () => ({ getContrats: vi.fn(), previewRentalDocument: vi.fn() }));
// DOC-ARCH-2 — RentalDocumentsPage fusionne désormais aussi les documents
// génériques (Document) classés automatiquement pole=Altimmo/service=
// gestion_locative (ex: pièces d'identité), sans jamais dupliquer leur
// stockage — voir server/controllers/locataireController.js/proprietaireController.js.
vi.mock('../services/documentService', () => ({ getAllDocuments: vi.fn() }));

let searchParamsValue = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}));

const contratAvecDocuments = (overrides = {}) => ({
  _id: 'C1', bien: { title: 'Villa Doc Test' },
  proprietaire: { nom: 'Nkounkou', prenom: 'Alice' },
  locataire: { nom: 'Moke', prenom: 'Paul' },
  documents: [
    { _id: 'D1', nom: 'Bail signé', type: 'bail', url: 'https://cdn.test/bail.pdf', dateGeneration: '2027-01-01' },
    { _id: 'D2', nom: 'Quittance Janvier 2027', type: 'quittance', url: 'https://cdn.test/quittance.pdf', dateGeneration: '2027-01-31' },
  ],
  ...overrides,
});

describe('RentalDocumentsPage — Sprint GL-UX1 — TEST DATA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsValue = '';
    getContrats.mockResolvedValue([contratAvecDocuments()]);
    getAllDocuments.mockResolvedValue([]);
  });

  test('agrège les documents de tous les contrats sans nouvel appel réseau dédié', async () => {
    render(<RentalDocumentsPage />);
    expect(await screen.findByText('Bail signé')).toBeInTheDocument();
    expect(screen.getByText('Quittance Janvier 2027')).toBeInTheDocument();
    expect(getContrats).toHaveBeenCalledWith({ type: 'location' });
  });

  test('filtre par type de document', async () => {
    render(<RentalDocumentsPage />);
    await screen.findByText('Bail signé');
    fireEvent.click(screen.getByRole('button', { name: 'Quittance' }));
    expect(screen.queryByText('Bail signé')).not.toBeInTheDocument();
    expect(screen.getByText('Quittance Janvier 2027')).toBeInTheDocument();
  });

  test('recherche par bien/propriétaire/locataire', async () => {
    render(<RentalDocumentsPage />);
    await screen.findByText('Bail signé');
    fireEvent.change(screen.getByPlaceholderText(/Bien, propriétaire, locataire/), { target: { value: 'Introuvable' } });
    expect(screen.queryByText('Bail signé')).not.toBeInTheDocument();
    expect(screen.getByText('Aucun document')).toBeInTheDocument();
  });

  test('filtre sur un contrat précis via ?contratId', async () => {
    searchParamsValue = 'contratId=C2';
    getContrats.mockResolvedValue([
      contratAvecDocuments({ _id: 'C1' }),
      contratAvecDocuments({ _id: 'C2', documents: [{ _id: 'D3', nom: 'Bail C2', type: 'bail', url: 'https://cdn.test/c2.pdf', dateGeneration: '2027-02-01' }] }),
    ]);
    render(<RentalDocumentsPage />);
    expect(await screen.findByText('Bail C2')).toBeInTheDocument();
    expect(screen.queryByText('Bail signé')).not.toBeInTheDocument();
  });

  test('un document sans URL ne propose pas de lien cassé', async () => {
    getContrats.mockResolvedValue([contratAvecDocuments({ documents: [{ _id: 'D4', nom: 'Doc sans URL', type: 'bail', dateGeneration: '2027-01-01' }] })]);
    render(<RentalDocumentsPage />);
    await screen.findByText('Doc sans URL');
    expect(screen.getByText('Indisponible')).toBeInTheDocument();
  });

  test('état vide géré', async () => {
    getContrats.mockResolvedValue([]);
    render(<RentalDocumentsPage />);
    expect(await screen.findByText('Aucun document')).toBeInTheDocument();
  });

  // DOC-EVO-1 (évolution 8) — l'ouverture passe par le même téléchargement
  // sécurisé, mais prévisualisée (nouvel onglet) plutôt que forcée en
  // enregistrement fichier ; jamais un lien direct vers l'URL Cloudinary.
  test('"Ouvrir" prévisualise le document sécurisé (identifiant du document)', async () => {
    previewRentalDocument.mockResolvedValue();
    render(<RentalDocumentsPage />);
    // Tri par date décroissante : la quittance (31/01) précède le bail (01/01).
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ouvrir' }))[0]);
    await waitFor(() => expect(previewRentalDocument).toHaveBeenCalledWith('D2'));
  });

  test('un refus serveur (403) affiche un message clair sans planter la page', async () => {
    previewRentalDocument.mockRejectedValue({ response: { status: 403 } });
    render(<RentalDocumentsPage />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ouvrir' }))[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Accès refusé à ce document.'));
  });

  // DOC-ARCH-2 — pièce d'identité classée automatiquement (Document, pas
  // Contrat.documents[]) : fusionnée dans la même vue, sans duplication.
  test('fusionne les pièces d’identité classées automatiquement (Document pole=Altimmo/service=gestion_locative)', async () => {
    getAllDocuments.mockResolvedValue([
      { _id: 'PD1', refType: 'Locataire', refNom: 'Paul Moke', notes: "Pièce d'identité — Paul Moke", content: 'https://cdn.test/cni.pdf', issueDate: '2027-03-01' },
    ]);
    render(<RentalDocumentsPage />);
    expect(await screen.findByText("Pièce d'identité — Paul Moke")).toBeInTheDocument();
    expect(getAllDocuments).toHaveBeenCalledWith({ pole: 'Altimmo', service: 'gestion_locative' });
    const link = screen.getByRole('link', { name: 'Ouvrir' });
    expect(link).toHaveAttribute('href', 'https://cdn.test/cni.pdf');
  });

  test('la pièce d’identité générique est exclue quand on filtre sur un contrat précis (?contratId)', async () => {
    searchParamsValue = 'contratId=C1';
    getAllDocuments.mockResolvedValue([{ _id: 'PD1', refType: 'Locataire', refNom: 'Paul Moke', notes: "Pièce d'identité — Paul Moke", content: 'https://cdn.test/cni.pdf', issueDate: '2027-03-01' }]);
    render(<RentalDocumentsPage />);
    await screen.findByText('Bail signé');
    expect(screen.queryByText("Pièce d'identité — Paul Moke")).not.toBeInTheDocument();
  });
});
