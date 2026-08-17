import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import ConversationsScreen from '../ConversationsScreen';
import api from '../../../services/api';
import { colors } from '../../../theme/colors';
import { colorsDark } from '../../../theme/colorsDark';

let mockActiveTheme = colors;

// ConversationsScreen importe EmptyState mais utilise en réalité un
// ListEmptyComponent inline — EmptyState n'est jamais rendu ici. On le mocke
// pour éviter la chaîne Button.jsx -> react-native-reanimated (nécessitant
// un environnement natif non disponible en test), sans toucher au code testé.
jest.mock('../../../components/ui/EmptyState', () => 'EmptyState');

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});

jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback) => require('react').useEffect(callback, [callback]) }));
jest.mock('../../../services/api', () => ({ get: jest.fn() }));
jest.mock('../../../services/socketService', () => ({
  connectSocket: jest.fn(() => Promise.resolve({ on: jest.fn(), off: jest.fn(), connected: true })),
  getSocket: jest.fn(() => ({ connected: true })),
}));
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'user-me', role: 'Client' } }),
}));
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: mockActiveTheme }),
}));

const flattenedStyle = (node) => StyleSheet.flatten(node.props.style);

const navigation = { navigate: jest.fn() };

describe.each([
  ['clair', colors],
  ['sombre', colorsDark],
])('ConversationsScreen — liste et badges de rôle (mandat UI-MOB-4 §10), thème %s', (_name, theme) => {
  beforeEach(() => {
    mockActiveTheme = theme;
    jest.clearAllMocks();
  });

  test('le badge de rôle "Prestataire" suit le thème actif, jamais figé sur le mauve clair (bug trouvé ce sprint)', async () => {
    api.get.mockResolvedValue({
      data: {
        data: {
          conversations: [{
            _id: 'conv-1',
            isStaffInbox: true,
            unreadCount: 0,
            updatedAt: '2026-08-15T09:00:00.000Z',
            lastMessage: 'Demande de devis plomberie',
            participants: [{ _id: 'prestataire-1', name: 'Jean Plombier', role: 'Prestataire' }],
          }],
        },
      },
    });

    render(<ConversationsScreen navigation={navigation} />);
    const badge = await screen.findByText('Prestataire');
    expect(flattenedStyle(badge).color).toBe(theme.purple);
  });

  test('le badge non-lu utilise onAccent sur fond gold, lisible dans les deux thèmes', async () => {
    api.get.mockResolvedValue({
      data: {
        data: {
          conversations: [{
            _id: 'conv-2',
            isStaffInbox: false,
            unreadCount: 3,
            updatedAt: '2026-08-15T09:00:00.000Z',
            lastMessage: 'Bonjour, une visite est-elle possible ?',
            participants: [{ _id: 'other-1', name: 'Marie Client' }],
          }],
        },
      },
    });

    render(<ConversationsScreen navigation={navigation} />);
    const unreadCount = await screen.findByText('3');
    expect(flattenedStyle(unreadCount).color).toBe(theme.onAccent);
  });

  test('état vide : affiche le CTA "Contacter l\'agence" pour un client sans conversation', async () => {
    api.get.mockResolvedValue({ data: { data: { conversations: [] } } });
    render(<ConversationsScreen navigation={navigation} />);
    await waitFor(() => expect(screen.getByText('Aucune conversation')).toBeTruthy());
    expect(screen.getByText("Contacter l'agence")).toBeTruthy();
  });
});
