// P0 SUPPORT-INBOX — la boîte de support (/conversations/staff-inbox,
// événement `new-staff-message`) n'est chargée que pour un agent Altitude
// Vision : PlatformOperator actif détenant `platform.support.read`. Un membre
// d'organisation (Admin, Collaborateur) charge sa messagerie directe, jamais
// la boîte de support, quel que soit son rôle.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import ConversationsScreen from '../ConversationsScreen';
import api from '../../../services/api';
import { getMyOperatorStatus } from '../../../services/platformTenantService';

const mockUser = { _id: 'user-me', role: 'Admin' };

jest.mock('../../../components/ui/EmptyState', () => 'EmptyState');
jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback) => require('react').useEffect(callback, [callback]) }));
jest.mock('../../../services/api', () => ({ get: jest.fn() }));
jest.mock('../../../services/platformTenantService', () => ({ getMyOperatorStatus: jest.fn() }));
jest.mock('../../../services/socketService', () => ({
  connectSocket: jest.fn(() => Promise.resolve({ on: jest.fn(), off: jest.fn(), connected: true })),
  getSocket: jest.fn(() => ({ connected: true })),
}));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: require('../../../theme/colors').colors }),
}));

const navigation = { navigate: jest.fn() };
const requestedUrls = () => api.get.mock.calls.map(([url]) => url);

describe('ConversationsScreen — boîte de support réservée aux agents Altitude Vision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: { data: { conversations: [] } } });
  });

  test.each(['Admin', 'Collaborateur'])('un membre d’organisation (%s) ne charge jamais la boîte de support', async (role) => {
    mockUser.role = role;
    getMyOperatorStatus.mockResolvedValue(null);
    render(<ConversationsScreen navigation={navigation} />);
    await waitFor(() => expect(requestedUrls()).toContain('/conversations'));
    expect(requestedUrls()).toContain('/conversations/my-inbox');
    expect(requestedUrls()).not.toContain('/conversations/staff-inbox');
  });

  test('un opérateur sans platform.support.read ne charge pas la boîte de support', async () => {
    mockUser.role = 'Client';
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: ['platform.commercial.manage'] });
    render(<ConversationsScreen navigation={navigation} />);
    await waitFor(() => expect(requestedUrls()).toContain('/conversations/my-inbox'));
    expect(requestedUrls()).not.toContain('/conversations/staff-inbox');
  });

  test('un opérateur suspendu ne charge pas la boîte de support', async () => {
    mockUser.role = 'Client';
    getMyOperatorStatus.mockResolvedValue({ status: 'suspended', capabilities: ['platform.support.read'] });
    render(<ConversationsScreen navigation={navigation} />);
    await waitFor(() => expect(requestedUrls()).toContain('/conversations/my-inbox'));
    expect(requestedUrls()).not.toContain('/conversations/staff-inbox');
  });

  test('un agent actif platform.support.read charge la boîte de support', async () => {
    mockUser.role = 'Client';
    getMyOperatorStatus.mockResolvedValue({ status: 'active', capabilities: ['platform.support.read'] });
    render(<ConversationsScreen navigation={navigation} />);
    await waitFor(() => expect(requestedUrls()).toContain('/conversations/staff-inbox'));
    expect(await screen.findByText('Boîte staff')).toBeTruthy();
  });
});
