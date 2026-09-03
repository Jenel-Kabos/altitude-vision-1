import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FirstOrganizationOnboardingScreen from '../FirstOrganizationOnboardingScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../components/ui/Button', () => {
  const { Pressable, Text } = require('react-native');
  return function MockButton({ label, onPress, disabled, loading }) {
    return <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress}><Text>{label}</Text></Pressable>;
  };
});

const mockCreate = jest.fn();
const mockGetMine = jest.fn();
const mockStatus = jest.fn();
const mockUpdate = jest.fn();
const mockUpload = jest.fn();
const mockDelete = jest.fn();
const mockSubmit = jest.fn();
const mockOpen = jest.fn();
const mockRefreshUser = jest.fn();
const mockPick = jest.fn();
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...args) => mockPick(...args) }));
jest.mock('../../../services/platformTenantService', () => ({
  createTenantApplication: (...args) => mockCreate(...args),
  getMyTenantApplication: (...args) => mockGetMine(...args),
  getFirstOrganizationOnboardingStatus: (...args) => mockStatus(...args),
  updateTenantApplication: (...args) => mockUpdate(...args),
  uploadTenantApplicationDocument: (...args) => mockUpload(...args),
  deleteTenantApplicationDocument: (...args) => mockDelete(...args),
  submitTenantApplication: (...args) => mockSubmit(...args),
  openTenantApplicationDocument: (...args) => mockOpen(...args),
}));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ refreshUser: mockRefreshUser }) }));

describe('FirstOrganizationOnboardingScreen', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('FORM-01/02/03 — crée un DRAFT sans identité ni tenant client', async () => {
    mockStatus.mockResolvedValue('NO_APPLICATION');
    mockCreate.mockResolvedValue({ id: 'app-1', status: 'DRAFT', documents: [] });
    render(<FirstOrganizationOnboardingScreen navigation={{ replace: jest.fn(), goBack: jest.fn() }} route={{ params: { initialStatus: 'NO_APPLICATION' } }} />);
    fireEvent.press(await screen.findByText('Commencer ma demande'));
    fireEvent.changeText(screen.getByLabelText('Nom de l’organisation'), 'Groupe Panorama');
    fireEvent.press(screen.getByText('Créer mon dossier'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('applicant');
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('tenantId');
  });

  test('un timeout permet un retry idempotent sans double appui en vol', async () => {
    mockStatus.mockResolvedValue('NO_APPLICATION');
    mockCreate.mockRejectedValueOnce({ normalized: { message: 'La requête a expiré.' } });
    render(<FirstOrganizationOnboardingScreen navigation={{ replace: jest.fn(), goBack: jest.fn() }} route={{ params: { initialStatus: 'NO_APPLICATION' } }} />);
    fireEvent.press(await screen.findByText('Commencer ma demande'));
    fireEvent.changeText(screen.getByLabelText('Nom de l’organisation'), 'Groupe Retry');
    fireEvent.press(screen.getByText('Créer mon dossier'));
    await waitFor(() => expect(screen.getByText('La requête a expiré.')).toBeTruthy());
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['PENDING_REVIEW', 'Demande en cours de vérification'],
    ['REVIEW_REQUIRED', 'Vérification nécessaire'],
    ['AMBIGUOUS', 'Vérification nécessaire'],
    ['FORBIDDEN', 'Accès non autorisé'],
  ])('affiche sans contournement l’état %s', async (state, title) => {
    mockStatus.mockResolvedValue(state);
    mockGetMine.mockResolvedValue({ id: 'app-1', organizationName: 'Panorama', documents: [] });
    render(<FirstOrganizationOnboardingScreen navigation={{ replace: jest.fn(), goBack: jest.fn() }} route={{ params: { initialStatus: state } }} />);
    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.queryByText('Continuer vers la création de l’hôtel')).toBeNull();
  });

  test('REJECTED affiche le motif applicant-safe et ne propose aucune resoumission', async () => {
    mockStatus.mockResolvedValue('REJECTED');
    mockGetMine.mockResolvedValue({
      id: 'app-1', status: 'REJECTED', organizationName: 'Panorama',
      rejectionReason: 'Les justificatifs ne permettent pas de vérifier l’activité.', documents: [],
    });
    render(<FirstOrganizationOnboardingScreen navigation={{ replace: jest.fn(), goBack: jest.fn() }} route={{ params: { initialStatus: 'REJECTED' } }} />);
    expect(await screen.findByText('Les justificatifs ne permettent pas de vérifier l’activité.')).toBeTruthy();
    expect(screen.queryByText('Renvoyer ma demande')).toBeNull();
  });

  test('REJECTED historique sans motif utilise un fallback sûr', async () => {
    mockStatus.mockResolvedValue('REJECTED');
    mockGetMine.mockResolvedValue({ id: 'app-1', status: 'REJECTED', organizationName: 'Panorama', documents: [] });
    render(<FirstOrganizationOnboardingScreen navigation={{ replace: jest.fn(), goBack: jest.fn() }} route={{ params: { initialStatus: 'REJECTED' } }} />);
    expect(await screen.findByText(/Votre demande n’a pas été approuvée/)).toBeTruthy();
  });

  test('ALREADY_ONBOARDED rafraîchit le contexte et ouvre le wizard sans tenantId', async () => {
    mockStatus.mockResolvedValue('ALREADY_ONBOARDED');
    const replace = jest.fn();
    render(<FirstOrganizationOnboardingScreen navigation={{ replace, goBack: jest.fn() }} route={{ params: { initialStatus: 'ALREADY_ONBOARDED' } }} />);
    fireEvent.press(await screen.findByText('Continuer vers la création de l’hôtel'));
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith('AddAccommodation', { publicationKind: 'hotel_establishment' });
    expect(replace.mock.calls[0][1]).not.toHaveProperty('tenantId');
  });

  test('un DRAFT accepte PDF et soumet par l’endpoint dossier sans provisionnement', async () => {
    const draft = {
      id: 'app-1', organizationName: 'Panorama', status: 'DRAFT', documents: [],
    };
    mockStatus.mockResolvedValue('DRAFT');
    mockGetMine.mockResolvedValue(draft);
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///doc.pdf', name: 'preuve.pdf', mimeType: 'application/pdf', size: 1024 }] });
    mockUpload.mockResolvedValue({ id: 'doc-1' });
    mockSubmit.mockResolvedValue({ ...draft, status: 'SUBMITTED' });
    render(<FirstOrganizationOnboardingScreen navigation={{ replace: jest.fn(), goBack: jest.fn() }} route={{ params: { initialStatus: 'DRAFT' } }} />);
    fireEvent.press(await screen.findAllByText('Ajouter un justificatif').then((items) => items[0]));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith('app-1', 'responsible_person_identity', expect.objectContaining({ mimeType: 'application/pdf' })));
    fireEvent.press(screen.getByText('Soumettre ma demande'));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith('app-1'));
    expect(await screen.findByText('Demande en cours de vérification')).toBeTruthy();
  });

  test('un complément ne rouvre que les champs et catégories demandés', async () => {
    const application = {
      id: 'app-2', organizationName: 'Panorama', status: 'ADDITIONAL_INFO_REQUIRED', documents: [],
      reopenedFields: ['businessDeclaration'],
      additionalInfo: { reason: 'Précisez votre activité.', requestedDocumentCategories: ['establishment_context'] },
    };
    mockStatus.mockResolvedValue('ADDITIONAL_INFO_REQUIRED');
    mockGetMine.mockResolvedValue(application);
    render(<FirstOrganizationOnboardingScreen navigation={{ replace: jest.fn(), goBack: jest.fn() }} route={{ params: { initialStatus: 'ADDITIONAL_INFO_REQUIRED' } }} />);
    expect(await screen.findByText('Précisez votre activité.')).toBeTruthy();
    expect(screen.getByLabelText('Nom de l’organisation').props.editable).toBe(false);
    expect(screen.getByLabelText('Présentation de l’activité').props.editable).toBe(true);
    expect(screen.getAllByText('Ajouter un justificatif')).toHaveLength(1);
    expect(screen.getByText('Renvoyer ma demande')).toBeTruthy();
  });
});
