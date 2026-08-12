import React from 'react';
import { Button, Text, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockApi = {
  deleteToken: jest.fn(),
  getToken: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
};
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: mockApi,
  saveToken: jest.fn(),
  getToken: (...args) => mockApi.getToken(...args),
  deleteToken: (...args) => mockApi.deleteToken(...args),
  setSessionInvalidatedHandler: jest.fn(),
}));
jest.mock('../../services/socketService', () => ({
  disconnectSocket: jest.fn(),
}));
jest.mock('../../services/notificationsService', () => ({
  enregistrerNotifications: jest.fn(),
  dissocierNotifications: jest.fn(),
}));
jest.mock('../../services/cacheService', () => ({ cache: { clear: jest.fn() } }));

import { disconnectSocket as mockDisconnectSocket } from '../../services/socketService';
import {
  dissocierNotifications as mockUnregisterPush,
  enregistrerNotifications as mockRegisterPush,
} from '../../services/notificationsService';
import { AuthProvider, restoreStoredSession, useAuth } from '../AuthContext';
import { cache as mockCache } from '../../services/cacheService';

const mockDeleteToken = mockApi.deleteToken;
const mockGetToken = mockApi.getToken;

function Harness() {
  const auth = useAuth();
  return (
    <View>
      <Text testID="state">{auth.loading ? 'loading' : auth.user?._id || 'anonymous'}</Text>
      <Button title="logout" onPress={auth.logout} />
    </View>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteToken.mockResolvedValue();
    mockRegisterPush.mockResolvedValue();
    mockUnregisterPush.mockResolvedValue();
  });

  test('termine anonyme si aucun token ne doit être restauré', async () => {
    mockGetToken.mockResolvedValue(null);
    const screen = render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  test('restaure et valide la session depuis Secure Store', async () => {
    const getStoredToken = jest.fn().mockResolvedValue('stored-token');
    const removeStoredToken = jest.fn();
    const apiClient = {
      get: jest.fn().mockResolvedValue({
        data: { data: { user: { _id: 'user-a', role: 'Client' } } },
      }),
    };
    await expect(restoreStoredSession({
      getStoredToken,
      removeStoredToken,
      apiClient,
    })).resolves.toEqual({
      token: 'stored-token',
      user: { _id: 'user-a', role: 'Client' },
    });
    expect(apiClient.get).toHaveBeenCalledWith('/users/me', {
      headers: { Authorization: 'Bearer stored-token' },
    });
    expect(removeStoredToken).not.toHaveBeenCalled();
  });

  test('supprime un token invalide', async () => {
    mockGetToken.mockResolvedValue('invalid-token');
    mockApi.get.mockRejectedValue(new Error('unauthorized'));
    const screen = render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));
    expect(mockDeleteToken).toHaveBeenCalled();
  });

  test('logout dissocie le push, supprime le token et coupe Socket', async () => {
    mockGetToken.mockResolvedValue(null);
    const screen = render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));
    await act(async () => fireEvent.press(screen.getByText('logout')));
    expect(mockUnregisterPush).toHaveBeenCalled();
    expect(mockDeleteToken).toHaveBeenCalled();
    expect(mockDisconnectSocket).toHaveBeenCalled();
    expect(mockCache.clear).toHaveBeenCalled();
  });
});
