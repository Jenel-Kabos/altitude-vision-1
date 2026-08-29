import React from 'react';
import { FlatList } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import VisitesScreen from '../VisitesScreen';
import api from '../../../services/api';
import { cache } from '../../../services/cacheService';

jest.mock('../../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));

jest.mock('@react-navigation/native', () => {
  const ReactActual = require('react');
  return { useFocusEffect: (callback) => ReactActual.useEffect(callback, [callback]) };
});

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: require('../../../theme/colors').colors }),
}));

let mockUser = { _id: 'dual-user', role: 'Proprietaire' };
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('../../../services/socketService', () => ({
  connectSocket: jest.fn(() => Promise.resolve({ on: jest.fn(), off: jest.fn() })),
}));

jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View };
});

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (Component) => Component },
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: (factory) => factory(),
    withSpring: (value) => value,
    withTiming: (value) => value,
  };
});

const clientVisit = {
  _id: 'client-confirmed', status: 'confirmee', displayStatus: 'Confirmée',
  scheduledStartAt: '2099-08-30T09:00:00.000Z',
  property: { title: 'Villa demandée par le client' },
};
const ownerVisit = {
  _id: 'owner-confirmed', status: 'confirmee', displayStatus: 'Confirmée',
  scheduledStartAt: '2099-09-01T10:00:00.000Z',
  property: { title: 'Appartement appartenant au propriétaire' },
};
const pastVisit = {
  _id: 'client-completed', status: 'terminee', displayStatus: 'Terminée',
  scheduledStartAt: '2025-01-02T08:00:00.000Z',
  property: { title: 'Visite client terminée' },
};
const response = (visites) => ({ data: { data: { visites } } });
const navigation = { canGoBack: () => false };

describe('VisitesScreen — contrat dual-role', () => {
  let clientVisits;
  let ownerVisits;

  beforeEach(() => {
    jest.clearAllMocks();
    cache.clear();
    mockUser = { _id: 'dual-user', role: 'Proprietaire' };
    clientVisits = [clientVisit];
    ownerVisits = [ownerVisit];
    api.get.mockImplementation((endpoint) => Promise.resolve(
      response(endpoint === '/visites/owner' ? ownerVisits : clientVisits),
    ));
  });

  test('un compte dual ouvre Mes demandes et charge /visites/my par défaut', async () => {
    render(<VisitesScreen navigation={navigation} />);

    expect(await screen.findByText('Mes demandes')).toBeTruthy();
    expect(screen.getByText('Mes biens')).toBeTruthy();
    expect(await screen.findByText('Villa demandée par le client')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/visites/my');
  });

  test('le contexte Mes biens charge exclusivement /visites/owner', async () => {
    render(<VisitesScreen navigation={navigation} />);
    await screen.findByText('Villa demandée par le client');
    fireEvent.press(screen.getByLabelText('Afficher mes biens'));

    expect(await screen.findByText('Appartement appartenant au propriétaire')).toBeTruthy();
    expect(screen.queryByText('Villa demandée par le client')).toBeNull();
    expect(api.get).toHaveBeenLastCalledWith('/visites/owner');
  });

  test('revenir à Mes demandes recharge /visites/my sans mélanger les listes', async () => {
    render(<VisitesScreen navigation={navigation} />);
    await screen.findByText('Villa demandée par le client');
    fireEvent.press(screen.getByLabelText('Afficher mes biens'));
    await screen.findByText('Appartement appartenant au propriétaire');
    fireEvent.press(screen.getByLabelText('Afficher mes demandes'));

    expect(await screen.findByText('Villa demandée par le client')).toBeTruthy();
    expect(screen.queryByText('Appartement appartenant au propriétaire')).toBeNull();
    expect(api.get).toHaveBeenLastCalledWith('/visites/my');
  });

  test('un Client conserve une vue unique alimentée par /visites/my', async () => {
    mockUser = { _id: 'client-user', role: 'Client' };
    render(<VisitesScreen navigation={navigation} />);

    expect(await screen.findByText('Villa demandée par le client')).toBeTruthy();
    expect(screen.getByText('Mes demandes de visite')).toBeTruthy();
    expect(screen.queryByText('Mes biens')).toBeNull();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/visites/my');
  });

  test('un accès explicite au contexte propriétaire ouvre /visites/owner', async () => {
    render(<VisitesScreen navigation={navigation} route={{ params: { visitContext: 'owner' } }} />);

    expect(await screen.findByText('Appartement appartenant au propriétaire')).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/visites/owner');
  });

  test('l’état vide client explique comment créer une demande', async () => {
    clientVisits = [];
    render(<VisitesScreen navigation={navigation} />);

    expect(await screen.findByText('Aucune visite à venir')).toBeTruthy();
    expect(screen.getByText('Demandez une visite depuis une annonce.')).toBeTruthy();
  });

  test('l’état vide propriétaire décrit les demandes reçues', async () => {
    ownerVisits = [];
    render(<VisitesScreen navigation={navigation} route={{ params: { visitContext: 'owner' } }} />);

    expect(await screen.findByText('Aucune demande de visite à venir')).toBeTruthy();
    expect(screen.queryByText('Demandez une visite depuis une annonce.')).toBeNull();
  });

  test('les onglets À venir et Passées conservent leur classification', async () => {
    clientVisits = [clientVisit, pastVisit];
    render(<VisitesScreen navigation={navigation} />);
    await screen.findByText('Villa demandée par le client');
    expect(screen.queryByText('Visite client terminée')).toBeNull();
    fireEvent.press(screen.getByLabelText('Voir les visites passées'));

    expect(await screen.findByText('Visite client terminée')).toBeTruthy();
    expect(screen.queryByText('Villa demandée par le client')).toBeNull();
  });

  test('le pull-to-refresh recharge uniquement le contexte actif', async () => {
    const view = render(<VisitesScreen navigation={navigation} route={{ params: { visitContext: 'owner' } }} />);
    await screen.findByText('Appartement appartenant au propriétaire');
    api.get.mockClear();
    await act(async () => {
      view.UNSAFE_getByType(FlatList).props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    expect(api.get).toHaveBeenCalledWith('/visites/owner');
  });

  test('un paramètre owner est ignoré pour un compte Client', async () => {
    mockUser = { _id: 'client-user', role: 'Client' };
    render(<VisitesScreen navigation={navigation} route={{ params: { visitContext: 'owner' } }} />);

    expect(await screen.findByText('Villa demandée par le client')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/visites/my');
    expect(api.get).not.toHaveBeenCalledWith('/visites/owner');
  });
});
