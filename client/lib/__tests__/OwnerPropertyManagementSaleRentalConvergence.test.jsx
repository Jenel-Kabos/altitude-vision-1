import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OwnerPropertyManagement from '../pages/dashboard/OwnerPropertyManagement';
import { getMyProperties } from '../services/propertyService';
import { createFullSaleProperty } from '../services/salePropertyService';
import { createFullRentalProperty } from '../services/rentalPropertyService';

// UX-OWNER-2 — le formulaire Owner "Ajouter un bien" converge désormais avec
// Admin : un choix explicite Vente/Location, puis SalePropertyForm.jsx/
// RentalPropertyForm.jsx (mode="owner") — mêmes composants, mêmes sections,
// mêmes services (`salePropertyService`/`rentalPropertyService`, désormais
// autorisés pour Proprietaire côté backend, voir server/controllers/
// salePropertyController.js et rentalPropertyController.js). Le champ
// `agencyCommission` (Admin-only) doit rester absent en mode owner.

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'OWNER-1', id: 'OWNER-1', role: 'Proprietaire', name: 'Owner Test' },
    loading: false,
  }),
}));

vi.mock('../services/propertyService', () => ({
  getMyProperties: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  getPropertyById: vi.fn(),
}));

vi.mock('../services/salePropertyService', () => ({
  createFullSaleProperty: vi.fn(),
  updateFullSaleProperty: vi.fn(),
}));

vi.mock('../services/rentalPropertyService', () => ({
  createFullRentalProperty: vi.fn(),
  updateFullRentalProperty: vi.fn(),
}));

vi.mock('../services/gestionLocativeService', () => ({
  getMyRentalManagement: vi.fn().mockResolvedValue([]),
  requestRentalAction: vi.fn(),
}));

vi.mock('../services/propertyAssetService', () => ({
  getPortfolioDashboard: vi.fn().mockResolvedValue({
    totalBiens: 0, valeurTotale: 0, valeurParType: {}, rentabiliteMoyenne: null,
    biensVacants: 0, biensOccupes: 0, coutEntretienTotal: 0,
  }),
  getPropertyLifecycle: vi.fn(),
  transitionPropertyAsset: vi.fn(),
  getPropertyValuation: vi.fn(),
  getPropertyMaintenanceLogbook: vi.fn(),
  getPropertyAlerts: vi.fn(),
}));

vi.mock('../services/visiteService', () => ({
  getOwnerVisitesUnreadCount: vi.fn().mockResolvedValue(0),
}));

describe('OwnerPropertyManagement — convergence Vente/Location avec Admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyProperties.mockResolvedValue([]);
  });

  test('« Ajouter un bien » propose un choix Vente/Location avant tout formulaire', async () => {
    render(<OwnerPropertyManagement />);
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter un bien/i }));
    expect(await screen.findByRole('button', { name: /Vente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Location/i })).toBeInTheDocument();
  });

  test('choisir Vente ouvre SalePropertyForm SANS le champ Commission d\'agence (Admin-only)', async () => {
    render(<OwnerPropertyManagement />);
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter un bien/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Vente/i }));

    expect(await screen.findByText('Situation juridique')).toBeInTheDocument();
    expect(screen.queryByLabelText("Commission d'agence")).not.toBeInTheDocument();
  });

  test('choisir Location ouvre RentalPropertyForm', async () => {
    render(<OwnerPropertyManagement />);
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter un bien/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Location/i }));

    expect(await screen.findByText('Conditions du bail')).toBeInTheDocument();
  });

  test('une soumission Vente réussie appelle createFullSaleProperty (même service qu\'Admin)', async () => {
    createFullSaleProperty.mockResolvedValue({ property: { _id: 'P1' }, sale: {} });
    render(<OwnerPropertyManagement />);
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter un bien/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Vente/i }));

    fireEvent.change(await screen.findByLabelText("Titre de l'annonce"), { target: { value: 'Villa Owner Test' } });
    fireEvent.change(screen.getByLabelText('Description de l\'annonce'), { target: { value: 'Belle villa.' } });
    fireEvent.change(screen.getByLabelText('Prix de vente'), { target: { value: '50000000' } });
    fireEvent.change(screen.getByLabelText('Surface en m²'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Arrondissement'), { target: { value: 'Bacongo' } });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });

    fireEvent.click(screen.getByText("Enregistrer l'annonce"));

    await waitFor(() => expect(createFullSaleProperty).toHaveBeenCalledTimes(1));
    const sentFormData = createFullSaleProperty.mock.calls[0][0];
    expect(sentFormData.has('agencyCommission')).toBe(false);
  });

  test('une soumission Location réussie appelle createFullRentalProperty (même service qu\'Admin)', async () => {
    createFullRentalProperty.mockResolvedValue({ property: { _id: 'P2' }, rental: {} });
    render(<OwnerPropertyManagement />);
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter un bien/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Location/i }));

    fireEvent.change(await screen.findByLabelText("Titre de l'annonce"), { target: { value: 'Appart Owner Test' } });
    fireEvent.change(screen.getByLabelText('Description de l\'annonce'), { target: { value: 'Bel appartement.' } });
    fireEvent.change(screen.getByLabelText('Loyer mensuel'), { target: { value: '150000' } });
    fireEvent.change(screen.getByLabelText('Surface en m²'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Arrondissement'), { target: { value: 'Bacongo' } });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });

    fireEvent.click(screen.getByText("Enregistrer l'annonce"));

    await waitFor(() => expect(createFullRentalProperty).toHaveBeenCalledTimes(1));
  });
});
