import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockPush, mockLogin, mockApiPatch } = vi.hoisted(() => ({
  mockPush:     vi.fn(),
  mockLogin:    vi.fn(),
  mockApiPatch: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useParams:  () => ({ token: 'valid-token-abc123456789012345' }),
}));
vi.mock('next/link', () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }));
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ initial, animate, exit, variants, transition, whileHover, whileTap, children, ...p }) => <div {...p}>{children}</div>,
    button: ({ initial, animate, exit, variants, transition, whileHover, whileTap, children, ...p }) => <button {...p}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ login: mockLogin }) }));
vi.mock('../../services/api', () => ({ default: { patch: mockApiPatch } }));

import ResetPasswordPage from '../../pages/ResetPasswordPage';

// ─────────────────────────────────────────────────────────────
describe('ResetPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche le formulaire de réinitialisation', () => {
    render(<ResetPasswordPage />);
    // "Nouveau mot de passe" apparaît dans le h2 ET dans le label — on cible le heading
    expect(screen.getByRole('heading', { name: /Nouveau mot de passe/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Minimum 8 caractères')).toBeInTheDocument();
  });

  it('affiche une erreur si les mots de passe ne correspondent pas', async () => {
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText('Minimum 8 caractères'), 'Password123!');
    await userEvent.type(screen.getByPlaceholderText('Répétez le mot de passe'), 'AutreMot123!');
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer le mot de passe/i }));
    expect(await screen.findByText(/ne correspondent pas/i)).toBeInTheDocument();
    expect(mockApiPatch).not.toHaveBeenCalled();
  });

  it('affiche une erreur si le mot de passe est trop court', async () => {
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText('Minimum 8 caractères'), 'court');
    await userEvent.type(screen.getByPlaceholderText('Répétez le mot de passe'), 'court');
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer le mot de passe/i }));
    expect(await screen.findByText(/au moins 8 caractères/i)).toBeInTheDocument();
    expect(mockApiPatch).not.toHaveBeenCalled();
  });

  it('affiche le succès et connecte l\'utilisateur après réinitialisation', async () => {
    mockApiPatch.mockResolvedValue({
      data: { token: 'new-jwt', data: { user: { _id: '1', role: 'Client' } } },
    });
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText('Minimum 8 caractères'), 'Motdepasse123!');
    await userEvent.type(screen.getByPlaceholderText('Répétez le mot de passe'), 'Motdepasse123!');
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer le mot de passe/i }));
    await waitFor(() => expect(screen.getByText(/Mot de passe modifié/i)).toBeInTheDocument());
    expect(mockLogin).toHaveBeenCalled();
  });

  it('affiche l\'erreur retournée par l\'API', async () => {
    mockApiPatch.mockRejectedValue({
      response: { data: { message: 'Lien expiré.' } },
    });
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText('Minimum 8 caractères'), 'Motdepasse123!');
    await userEvent.type(screen.getByPlaceholderText('Répétez le mot de passe'), 'Motdepasse123!');
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer le mot de passe/i }));
    await waitFor(() => expect(screen.getByText(/Lien expiré/i)).toBeInTheDocument());
  });
});
