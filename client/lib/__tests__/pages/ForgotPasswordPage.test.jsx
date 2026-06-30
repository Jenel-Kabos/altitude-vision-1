import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockApiPost } = vi.hoisted(() => ({ mockApiPost: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }));
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ children, ...p }) => <div {...p}>{children}</div>,
    button: ({ children, ...p }) => <button {...p}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('../../services/api', () => ({ default: { post: mockApiPost } }));

import ForgotPasswordPage from '../../pages/ForgotPasswordPage';

// ─────────────────────────────────────────────────────────────
describe('ForgotPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche le titre et le champ email', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText('Mot de passe oublié')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('votre@email.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Envoyer le lien/i })).toBeInTheDocument();
  });

  it('affiche un lien "Retour à la connexion"', () => {
    render(<ForgotPasswordPage />);
    const links = screen.getAllByRole('link', { name: /Retour à la connexion/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/login');
  });

  it('affiche une erreur si l\'email est vide à la soumission', async () => {
    render(<ForgotPasswordPage />);
    // fireEvent.submit contourne la validation HTML5 (required) de jsdom pour tester le handler
    fireEvent.submit(document.querySelector('form'));
    expect(await screen.findByText(/Veuillez saisir votre adresse email/i)).toBeInTheDocument();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('affiche "Email envoyé !" après succès API', async () => {
    mockApiPost.mockResolvedValue({});
    render(<ForgotPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText('votre@email.com'), 'user@test.com');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer le lien/i }));
    await waitFor(() => expect(screen.getByText('Email envoyé !')).toBeInTheDocument());
    expect(screen.getByText(/user@test\.com/)).toBeInTheDocument();
  });

  it('affiche le message d\'erreur retourné par l\'API', async () => {
    mockApiPost.mockRejectedValue({
      response: { data: { message: 'Aucun compte avec cet email.' } },
    });
    render(<ForgotPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText('votre@email.com'), 'inconnu@test.com');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer le lien/i }));
    await waitFor(() => expect(screen.getByText('Aucun compte avec cet email.')).toBeInTheDocument());
  });

  it('"Renvoyer un email" réinitialise le formulaire', async () => {
    mockApiPost.mockResolvedValue({});
    render(<ForgotPasswordPage />);
    await userEvent.type(screen.getByPlaceholderText('votre@email.com'), 'user@test.com');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer le lien/i }));
    await screen.findByText('Email envoyé !');
    await userEvent.click(screen.getByRole('button', { name: /Renvoyer un email/i }));
    expect(screen.getByPlaceholderText('votre@email.com')).toBeInTheDocument();
    expect(screen.queryByText('Email envoyé !')).not.toBeInTheDocument();
  });
});
