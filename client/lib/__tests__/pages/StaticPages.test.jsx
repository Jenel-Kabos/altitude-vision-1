import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a>,
}));
vi.mock('next/image', () => ({
  default: ({ src, alt, ...p }) => <img src={src} alt={alt} />,
}));

// motion.create doit être présent car NotFoundPage l'utilise : motion.create(Image)
vi.mock('framer-motion', () => {
  const Passthrough = ({ children, ...p }) => <div {...p}>{children}</div>;
  return {
    motion: {
      div:    Passthrough,
      h1:     ({ children, ...p }) => <h1 {...p}>{children}</h1>,
      h2:     ({ children, ...p }) => <h2 {...p}>{children}</h2>,
      p:      ({ children, ...p }) => <p {...p}>{children}</p>,
      create: (Component) => (props) => <Component {...props} />,
    },
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

import UnauthorizedPage from '../../pages/UnauthorizedPage';
import NotFoundPage     from '../../pages/NotFoundPage';

// ─────────────────────────────────────────────────────────────
describe('UnauthorizedPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche le titre "Accès Refusé"', () => {
    render(<UnauthorizedPage />);
    expect(screen.getByText('Accès Refusé')).toBeInTheDocument();
  });

  it('affiche le message explicatif', () => {
    render(<UnauthorizedPage />);
    // getByText avec regex fait une recherche partielle dans le contenu de l'élément
    expect(screen.getByText(/autorisations nécessaires/i)).toBeInTheDocument();
  });

  it('le bouton "Retour" appelle router.back()', async () => {
    render(<UnauthorizedPage />);
    await userEvent.click(screen.getByRole('button', { name: /Retour/i }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('le bouton "Accueil" redirige vers "/"', async () => {
    render(<UnauthorizedPage />);
    await userEvent.click(screen.getByRole('button', { name: /Accueil/i }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});

// ─────────────────────────────────────────────────────────────
describe('NotFoundPage', () => {
  it('affiche le code d\'erreur 404', () => {
    render(<NotFoundPage />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('affiche le message "introuvable"', () => {
    render(<NotFoundPage />);
    expect(screen.getByText(/introuvable/i)).toBeInTheDocument();
  });

  it('affiche un lien "Retour à l\'accueil" pointant vers "/"', () => {
    render(<NotFoundPage />);
    const link = screen.getByRole('link', { name: /Retour à l'accueil/i });
    expect(link).toHaveAttribute('href', '/');
  });

  it('affiche les raccourcis vers les 3 pôles', () => {
    render(<NotFoundPage />);
    expect(screen.getByRole('link', { name: /Altimmo/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mila Events/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Altcom/i })).toBeInTheDocument();
  });

  it('le lien Altimmo pointe vers /immobilier', () => {
    render(<NotFoundPage />);
    expect(screen.getByRole('link', { name: /Altimmo/i })).toHaveAttribute('href', '/immobilier');
  });
});
