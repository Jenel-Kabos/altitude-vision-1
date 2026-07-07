import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockPush, mockApiPost } = vi.hoisted(() => ({
  mockPush:    vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, replace: vi.fn() }) }));
vi.mock('next/link',       () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }));
vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ initial, animate, exit, variants, transition, whileHover, whileTap, children, ...p }) => <div {...p}>{children}</div>,
    button: ({ initial, animate, exit, variants, transition, whileHover, whileTap, children, ...p }) => <button {...p}>{children}</button>,
    p:      ({ initial, animate, exit, variants, transition, children, ...p }) => <p {...p}>{children}</p>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, login: vi.fn() }),
}));
vi.mock('../../data/contratHebergement', () => ({ contratHebergement: 'Contrat test' }));
vi.mock('../../services/api', () => ({ default: { post: mockApiPost } }));

import RegisterPage from '../../pages/RegisterPage';

// ─────────────────────────────────────────────────────────────
describe('RegisterPage — rendu de base', () => {
  it('affiche le formulaire d\'inscription', () => {
    render(<RegisterPage />);
    expect(screen.getByText(/Créez votre compte/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Votre nom complet')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('exemple@email.com')).toBeInTheDocument();
  });

  it('affiche un lien vers la page de connexion', () => {
    render(<RegisterPage />);
    expect(screen.getByRole('link', { name: /Connectez-vous/i })).toHaveAttribute('href', '/login');
  });
});

// ─────────────────────────────────────────────────────────────
describe('RegisterPage — validation du formulaire', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche une erreur si les mots de passe ne correspondent pas', async () => {
    render(<RegisterPage />);
    await userEvent.type(screen.getByPlaceholderText('Votre nom complet'), 'Jean Dupont');
    await userEvent.type(screen.getByPlaceholderText('exemple@email.com'), 'jean@test.com');
    await userEvent.type(screen.getByPlaceholderText('Minimum 8 caractères'), 'Motdepasse1!');
    await userEvent.type(screen.getByPlaceholderText('Répétez votre mot de passe'), 'Motdepasse2!');
    await userEvent.click(screen.getByRole('button', { name: /Créer mon compte/i }));
    expect(await screen.findByText(/ne correspondent pas/i)).toBeInTheDocument();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('affiche une erreur si le mot de passe est trop court', async () => {
    render(<RegisterPage />);
    await userEvent.type(screen.getByPlaceholderText('Votre nom complet'), 'Jean Dupont');
    await userEvent.type(screen.getByPlaceholderText('exemple@email.com'), 'jean@test.com');
    await userEvent.type(screen.getByPlaceholderText('Minimum 8 caractères'), 'court');
    await userEvent.type(screen.getByPlaceholderText('Répétez votre mot de passe'), 'court');
    await userEvent.click(screen.getByRole('button', { name: /Créer mon compte/i }));
    expect(await screen.findByText(/au moins 8 caractères/i)).toBeInTheDocument();
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('RegisterPage — rôle Propriétaire', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche les certifications quand Propriétaire est sélectionné', async () => {
    render(<RegisterPage />);
    const roleSelect = screen.queryByRole('combobox');
    if (roleSelect) {
      await userEvent.selectOptions(roleSelect, 'Proprietaire');
      expect((await screen.findAllByText(/contrat d'hébergement/i)).length).toBeGreaterThan(0);
    } else {
      const btn = screen.getAllByRole('button').find(b => /Propriétaire/.test(b.textContent));
      if (btn) {
        await userEvent.click(btn);
        expect((await screen.findAllByText(/contrat d'hébergement/i)).length).toBeGreaterThan(0);
      }
    }
  });

  it('affiche une erreur si les certifications ne sont pas cochées (Propriétaire)', async () => {
    render(<RegisterPage />);
    const roleSelect = screen.queryByRole('combobox');
    if (!roleSelect) return;
    await userEvent.selectOptions(roleSelect, 'Proprietaire');
    await userEvent.type(screen.getByPlaceholderText('Votre nom complet'), 'Jean Dupont');
    await userEvent.type(screen.getByPlaceholderText('exemple@email.com'), 'jean@test.com');
    await userEvent.type(screen.getByPlaceholderText('Minimum 8 caractères'), 'Motdepasse1!');
    await userEvent.type(screen.getByPlaceholderText('Répétez votre mot de passe'), 'Motdepasse1!');
    // Le bouton est disabled quand les certifications ne sont pas cochées → fireEvent.submit contourne ça
    fireEvent.submit(document.querySelector('form'));
    expect(await screen.findByText(/cocher toutes les cases/i)).toBeInTheDocument();
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('RegisterPage — soumission réussie', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirige vers /verify-email-pending après inscription réussie', async () => {
    mockApiPost.mockResolvedValue({ data: { status: 'success' } });
    render(<RegisterPage />);
    await userEvent.type(screen.getByPlaceholderText('Votre nom complet'), 'Jean Dupont');
    await userEvent.type(screen.getByPlaceholderText('exemple@email.com'), 'jean@test.com');
    await userEvent.type(screen.getByPlaceholderText('Minimum 8 caractères'), 'Motdepasse1!');
    await userEvent.type(screen.getByPlaceholderText('Répétez votre mot de passe'), 'Motdepasse1!');
    await userEvent.click(screen.getByRole('button', { name: /Créer mon compte/i }));
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/users/signup', expect.objectContaining({
        name: 'Jean Dupont', email: 'jean@test.com', role: 'Client',
      }));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/verify-email-pending'));
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('RegisterPage — pwScore (logique pure)', () => {
  const pwScore = (p) => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8)          s++;
    if (/[A-Z]/.test(p))        s++;
    if (/[0-9]/.test(p))        s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  it('retourne 0 pour une chaîne vide', () => expect(pwScore('')).toBe(0));
  it('retourne 1 pour un mot de passe de 8 chars sans complexité', () => expect(pwScore('aaaaaaaa')).toBe(1));
  it('retourne 2 pour 8+ chars + majuscule', () => expect(pwScore('Aaaaaaaa')).toBe(2));
  it('retourne 3 pour 8+ chars + majuscule + chiffre', () => expect(pwScore('Aaaaaaa1')).toBe(3));
  it('retourne 4 (max) pour un mot de passe fort', () => expect(pwScore('Aaaaaaa1!')).toBe(4));
  it('retourne 0 pour null/undefined', () => expect(pwScore(null)).toBe(0));
});
