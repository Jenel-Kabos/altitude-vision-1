import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.hoisted permet de déclarer des variables accessibles dans les factories vi.mock hoistées
const { mockPush, mockReplace, mockLogin, mockApiPost } = vi.hoisted(() => ({
  mockPush:    vi.fn(),
  mockReplace: vi.fn(),
  mockLogin:   vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
vi.mock('next/link',       () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }));
vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('framer-motion',   () => ({
  motion: { div: ({ children, ...p }) => <div {...p}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, login: mockLogin, logout: vi.fn() }),
}));
vi.mock('../../services/api.js', () => ({
  default: { post: mockApiPost },
}));

import LoginPage from '../../pages/LoginPage';

// ─────────────────────────────────────────────────────────────
describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche le titre et les champs du formulaire', () => {
    render(<LoginPage />);
    expect(screen.getByText('Connectez-vous')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Adresse Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument();
  });

  it('affiche un lien vers la page d\'inscription', () => {
    render(<LoginPage />);
    expect(screen.getByRole('link', { name: /Inscrivez-vous/i })).toHaveAttribute('href', '/register');
  });

  it('affiche un lien "Mot de passe oublié"', () => {
    render(<LoginPage />);
    expect(screen.getByRole('link', { name: /Mot de passe oublié/i })).toHaveAttribute('href', '/forgot-password');
  });

  it('désactive le bouton et affiche "Connexion..." pendant le chargement', async () => {
    mockApiPost.mockImplementation(() => new Promise(() => {}));
    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText('Adresse Email'), 'test@test.com');
    await userEvent.type(screen.getByPlaceholderText('Mot de passe'), 'motdepasse');
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }));
    expect(screen.getByRole('button', { name: /Connexion\.\.\./i })).toBeDisabled();
  });

  it('affiche le message d\'erreur retourné par l\'API', async () => {
    mockApiPost.mockRejectedValue({
      response: { data: { message: 'Email ou mot de passe incorrect.' } },
    });
    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText('Adresse Email'), 'wrong@test.com');
    await userEvent.type(screen.getByPlaceholderText('Mot de passe'), 'mauvais');
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }));
    await waitFor(() => {
      expect(screen.getByText('Email ou mot de passe incorrect.')).toBeInTheDocument();
    });
  });

  it('appelle auth.login() et redirige vers "/" pour un Client', async () => {
    mockApiPost.mockResolvedValue({
      data: { token: 'jwt-token', data: { user: { _id: '1', role: 'Client', email: 'test@test.com' } } },
    });
    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText('Adresse Email'), 'test@test.com');
    await userEvent.type(screen.getByPlaceholderText('Mot de passe'), 'motdepasse1');
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({ role: 'Client' }), 'jwt-token');
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('redirige vers /dashboard pour un Admin', async () => {
    mockApiPost.mockResolvedValue({
      data: { token: 'jwt-token', data: { user: { _id: '2', role: 'Admin', email: 'admin@test.com' } } },
    });
    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText('Adresse Email'), 'admin@test.com');
    await userEvent.type(screen.getByPlaceholderText('Mot de passe'), 'adminpass1');
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
  });
});
