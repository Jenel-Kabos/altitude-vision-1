import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import ChatScreen from '../ChatScreen';
import api from '../../../services/api';
import { getSocket, joinConversation, leaveConversation } from '../../../services/socketService';
import { colors } from '../../../theme/colors';
import { colorsDark } from '../../../theme/colorsDark';

let mockActiveTheme = colors;

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn() }),
  useAudioPlayerStatus: () => ({ playing: false }),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('../../../components/VideoPlayer', () => 'VideoPlayer');
jest.mock('../../../services/secureAttachmentService', () => ({ downloadSecureAttachment: jest.fn() }));
jest.mock('../../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../../services/socketService', () => ({
  getSocket: jest.fn(() => null),
  joinConversation: jest.fn(() => Promise.resolve()),
  leaveConversation: jest.fn(),
}));
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'user-me', name: 'Moi' } }),
}));
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: mockActiveTheme }),
}));

const flattenedStyle = (node) => StyleSheet.flatten(node.props.style);

const conversation = { _id: 'conv-1' };
const contact = { _id: 'contact-1', name: 'Ada Lovelace' };
const navigation = { setOptions: jest.fn(), goBack: jest.fn() };

describe.each([
  ['clair', colors],
  ['sombre', colorsDark],
])('ChatScreen — bulles de message et composer (mandat UI-MOB-4 §12-16), thème %s', (_name, theme) => {
  beforeEach(() => {
    mockActiveTheme = theme;
    jest.clearAllMocks();
    api.get.mockResolvedValue({
      data: {
        data: {
          messages: [
            { _id: 'm1', content: 'Bonjour, le bien est-il toujours disponible ?', sender: 'contact-1', createdAt: '2026-08-15T10:00:00.000Z' },
            { _id: 'm2', content: 'Oui, toujours disponible.', sender: 'user-me', createdAt: '2026-08-15T10:01:00.000Z' },
          ],
        },
      },
    });
  });

  test('les bulles envoyées et reçues utilisent des couples foreground/background distincts et lisibles', async () => {
    render(<ChatScreen route={{ params: { conversation, contact } }} navigation={navigation} />);

    const sentBubbleText = await screen.findByText('Oui, toujours disponible.');
    const receivedBubbleText = screen.getByText('Bonjour, le bien est-il toujours disponible ?');

    // Bulle envoyée : fond gold (toujours assez clair dans les deux thèmes),
    // texte onAccent (quasi-noir) — jamais blanc-sur-blanc ni noir-sur-noir.
    expect(flattenedStyle(sentBubbleText).color).toBe(theme.onAccent);
    // Bulle reçue : fond bgCard du thème actif, texte c.text du thème actif —
    // jamais figé sur le clair (bug de classe Chip.jsx).
    expect(flattenedStyle(receivedBubbleText).color).toBe(theme.text);
  });

  test('le bouton Envoyer utilise onAccent sur fond gold, jamais de blanc fixe (bug de classe UI-MOB-3)', async () => {
    render(<ChatScreen route={{ params: { conversation, contact } }} navigation={navigation} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    const sendIcon = screen.getByText('send');
    expect(sendIcon.props.color).toBe(theme.onAccent);
    expect(sendIcon.props.color).not.toBe('#FFFFFF');
  });

  test('rejoint la conversation Socket.IO au montage et la quitte au démontage', async () => {
    const { unmount } = render(<ChatScreen route={{ params: { conversation, contact } }} navigation={navigation} />);
    await waitFor(() => expect(joinConversation).toHaveBeenCalledWith('conv-1'));
    unmount();
    expect(leaveConversation).toHaveBeenCalledWith('conv-1');
  });
});

// POST-E2E-2 — un deep link générique (`altimmo://messages/:id`, hors tap de
// notification) ne fournit à cet écran qu'un identifiant brut (`route.params.id`,
// jamais l'objet `conversation` complet) : sans repli, TOUT deep link générique
// affichait "Conversation introuvable", même pour une conversation possédée par
// l'utilisateur — bug réel reproduit sur device durant ce sprint et corrigé par
// un chargement autonome via `GET /conversations/:id` (même endpoint authentifié
// que `loadChatParams`, cf. notificationsService.js).
describe('ChatScreen — repli deep link générique (route.params.id sans conversation)', () => {
  beforeEach(() => {
    mockActiveTheme = colors;
    jest.clearAllMocks();
  });

  test('charge la conversation via GET /conversations/:id quand seul un id brut est fourni', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/conversations/conv-99') {
        return Promise.resolve({
          data: { data: { conversation: { _id: 'conv-99', participants: [{ _id: 'contact-1', name: 'Ada Lovelace' }, { _id: 'user-me' }] } } },
        });
      }
      if (url === '/messages/conv-99') {
        return Promise.resolve({ data: { data: { messages: [] } } });
      }
      return Promise.resolve({ data: { data: {} } });
    });

    render(<ChatScreen route={{ params: { id: 'conv-99' } }} navigation={navigation} />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations/conv-99'));
    await waitFor(() => expect(joinConversation).toHaveBeenCalledWith('conv-99'));
  });

  test('affiche "Conversation introuvable" (jamais de crash ni de fuite) si l’API refuse ou ne trouve rien', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/conversations/conv-foreign') {
        return Promise.reject({ response: { status: 403, data: { message: 'Accès refusé' } } });
      }
      return Promise.resolve({ data: { data: {} } });
    });

    render(<ChatScreen route={{ params: { id: 'conv-foreign' } }} navigation={navigation} />);

    expect(await screen.findByText('Conversation introuvable')).toBeTruthy();
    expect(joinConversation).not.toHaveBeenCalled();
  });

  test('un `conversation` déjà fourni dans route.params (chemin notification) court-circuite le repli par id', async () => {
    api.get.mockResolvedValue({ data: { data: { messages: [] } } });

    render(<ChatScreen route={{ params: { conversation, contact, id: 'conv-1' } }} navigation={navigation} />);

    await waitFor(() => expect(joinConversation).toHaveBeenCalledWith('conv-1'));
    expect(api.get).not.toHaveBeenCalledWith('/conversations/conv-1');
  });
});
