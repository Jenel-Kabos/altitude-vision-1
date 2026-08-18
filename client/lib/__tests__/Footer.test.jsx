import { render, screen } from '@testing-library/react';
import Footer from '../components/layout/Footer';

// UI-WEB-FOOTER-1 — verrouille les données réelles (routes/coordonnées/
// réseaux sociaux) du nouveau footer sombre. Pas de snapshot massif :
// uniquement les liens/contacts qui doivent rester réels, jamais fictifs.

describe('Footer — liens et coordonnées réels', () => {
  test('les 4 pôles pointent vers les vraies routes existantes', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: /Altimmo/ })).toHaveAttribute('href', '/immobilier');
    expect(screen.getByRole('link', { name: /Mila Events/ })).toHaveAttribute('href', '/evenementiel');
    expect(screen.getByRole('link', { name: /Altcom/ })).toHaveAttribute('href', '/communication');
    expect(screen.getByRole('link', { name: /Ma Commission/ })).toHaveAttribute('href', '/trouve-ta-commission');
  });

  test('la colonne Informations inclut Confidentialité (route réelle jusqu’ici jamais liée) et jamais un lien FAQ (route inexistante)', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/politique-confidentialite');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute('href', '/mentions-legales');
    expect(screen.queryByRole('link', { name: /FAQ/i })).not.toBeInTheDocument();
  });

  test('aucun lien factice (href="#") n\'est présent', () => {
    render(<Footer />);
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'));
    expect(hrefs.every((h) => h && h !== '#')).toBe(true);
  });

  test('réseaux sociaux réels uniquement — Facebook/Instagram/WhatsApp, jamais de LinkedIn fictif', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: /Facebook/ })).toHaveAttribute('href', expect.stringContaining('facebook.com'));
    expect(screen.getByRole('link', { name: /Instagram/ })).toHaveAttribute('href', expect.stringContaining('instagram.com'));
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('wa.me'));
    expect(screen.queryByRole('link', { name: /LinkedIn/i })).not.toBeInTheDocument();
  });

  test('coordonnées de contact réelles (email et téléphone cliquables)', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'contact@altitudevision.agency' })).toHaveAttribute('href', 'mailto:contact@altitudevision.agency');
    expect(screen.getByRole('link', { name: '+242 06 800 21 51' })).toHaveAttribute('href', 'tel:+242068002151');
    expect(screen.getByText(/Rue Mfoa n°24/)).toBeInTheDocument();
  });

  test('aucun formulaire newsletter (aucun backend newsletter n’existe dans le projet)', () => {
    render(<Footer />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/restez informé/i)).not.toBeInTheDocument();
  });

  test('copyright et wordmark présents', () => {
    render(<Footer />);
    expect(screen.getByText(/Tous droits réservés/)).toBeInTheDocument();
    expect(screen.getByLabelText('Accueil Altitude-Vision')).toBeInTheDocument();
  });
});
