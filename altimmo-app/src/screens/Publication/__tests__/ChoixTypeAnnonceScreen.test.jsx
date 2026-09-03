import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import ChoixTypeAnnonceScreen from '../ChoixTypeAnnonceScreen';

const mockGetStatus = jest.fn();
jest.mock('../../../services/platformTenantService', () => ({
  getFirstOrganizationOnboardingStatus: (...args) => mockGetStatus(...args),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@expo/vector-icons', () => {
  const RN = require('react-native');
  const ReactActual = require('react');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});

describe('ChoixTypeAnnonceScreen — parcours d\'entrée (mission §2)', () => {
  beforeEach(() => mockGetStatus.mockReset());
  test('affiche les 3 choix Vente/Location/Hébergement (jamais un formulaire unique)', () => {
    render(<ChoixTypeAnnonceScreen navigation={{ navigate: jest.fn() }} />);
    expect(screen.getByText('Vendre un bien')).toBeTruthy();
    expect(screen.getByText('Mettre un bien en location')).toBeTruthy();
    expect(screen.getByText('Proposer un hébergement')).toBeTruthy();
  });

  test('sélectionner "Vendre un bien" ouvre AddSaleProperty', () => {
    const navigate = jest.fn();
    render(<ChoixTypeAnnonceScreen navigation={{ navigate }} />);
    fireEvent.press(screen.getByText('Vendre un bien'));
    expect(navigate).toHaveBeenCalledWith('AddSaleProperty');
  });

  test('sélectionner "Mettre un bien en location" ouvre AddRentalProperty', () => {
    const navigate = jest.fn();
    render(<ChoixTypeAnnonceScreen navigation={{ navigate }} />);
    fireEvent.press(screen.getByText('Mettre un bien en location'));
    expect(navigate).toHaveBeenCalledWith('AddRentalProperty');
  });

  test('Proprietaire déjà onboardé ouvre directement le parcours hôtel', async () => {
    mockGetStatus.mockResolvedValue('ALREADY_ONBOARDED');
    const navigate = jest.fn();
    render(<ChoixTypeAnnonceScreen navigation={{ navigate }} />);
    fireEvent.press(screen.getByText('Proposer un hébergement'));
    expect(screen.getByText('Logement meublé')).toBeTruthy();
    expect(screen.getByText('Établissement hôtelier')).toBeTruthy();
    fireEvent.press(screen.getByText('Établissement hôtelier'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('AddAccommodation', { publicationKind: 'hotel_establishment' }));
  });

  test('MOB-01 — NO_APPLICATION ouvre la demande avant le wizard', async () => {
    mockGetStatus.mockResolvedValue('NO_APPLICATION');
    const navigate = jest.fn();
    render(<ChoixTypeAnnonceScreen navigation={{ navigate }} />);
    fireEvent.press(screen.getByText('Proposer un hébergement'));
    fireEvent.press(screen.getByText('Établissement hôtelier'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('FirstOrganizationOnboarding', {
      publicationKind: 'hotel_establishment', initialStatus: 'NO_APPLICATION',
    }));
  });

  test.each([
    'DRAFT', 'PENDING_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'REJECTED',
    'REVIEW_REQUIRED', 'AMBIGUOUS', 'FORBIDDEN',
  ])('%s ouvre uniquement son écran applicant sécurisé', async (state) => {
    mockGetStatus.mockResolvedValue(state);
    const navigate = jest.fn();
    render(<ChoixTypeAnnonceScreen navigation={{ navigate }} />);
    fireEvent.press(screen.getByText('Proposer un hébergement'));
    fireEvent.press(screen.getByText('Établissement hôtelier'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('FirstOrganizationOnboarding', {
      publicationKind: 'hotel_establishment', initialStatus: state,
    }));
    expect(navigate).not.toHaveBeenCalledWith('AddAccommodation', expect.anything());
  });

  test('un statut inconnu échoue fermé', async () => {
    mockGetStatus.mockResolvedValue('UNEXPECTED');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const navigate = jest.fn();
    render(<ChoixTypeAnnonceScreen navigation={{ navigate }} />);
    fireEvent.press(screen.getByText('Proposer un hébergement'));
    fireEvent.press(screen.getByText('Établissement hôtelier'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Vérification impossible', expect.any(String)));
    expect(navigate).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
