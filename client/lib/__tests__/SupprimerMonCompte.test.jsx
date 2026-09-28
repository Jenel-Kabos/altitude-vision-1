// GOOGLE-PLAY-P0-1 — vérifie que la page publique /supprimer-mon-compte
// respecte les contraintes du sprint : H1 présent, procédure documentée,
// contact support visible, ABSENCE de formulaire de suppression non
// authentifié.
import { render, screen } from '@testing-library/react';
import SupprimerMonCompte from '../pages/SupprimerMonCompte';

describe('SupprimerMonCompte (page publique)', () => {
  beforeEach(() => { render(<SupprimerMonCompte />); });

  test('affiche un H1 clair "Supprimer mon compte Altimmo"', () => {
    expect(screen.getByRole('heading', { level: 1, name: /supprimer mon compte altimmo/i })).toBeInTheDocument();
  });

  test('documente le parcours dans l\'application', () => {
    expect(screen.getByText(/depuis l'application mobile altimmo/i)).toBeInTheDocument();
    // "Profil" est dans un <strong> imbriqué : on cherche le node "Profil"
    // séparément et le libellé du bouton "Supprimer mon compte".
    expect(screen.getAllByText(/profil/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/supprimer mon compte/i).length).toBeGreaterThan(0);
  });

  test('affiche le contact support@altitudevision.agency', () => {
    const links = screen.getAllByText('support@altitudevision.agency');
    expect(links.length).toBeGreaterThan(0);
    const mailto = document.querySelector('a[href^="mailto:support@altitudevision.agency"]');
    expect(mailto).toBeTruthy();
  });

  test('ne contient AUCUN formulaire de suppression non authentifié', () => {
    // Aucune balise input de type email/password destinée à supprimer un
    // compte, aucun bouton "Supprimer" activé sur cette page publique.
    expect(document.querySelector('form')).toBeNull();
    expect(document.querySelector('input[type="email"]')).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull();
  });

  test('mentionne le cas particulier du dernier administrateur', () => {
    expect(screen.getByText(/dernier administrateur/i)).toBeInTheDocument();
    expect(screen.getByText(/transférez d'abord l'administration/i)).toBeInTheDocument();
  });

  test("mentionne l'anonymisation des données conservées", () => {
    expect(screen.getByText(/anonymisé ou conservé/i)).toBeInTheDocument();
    expect(screen.getByText(/messages échangés/i)).toBeInTheDocument();
    expect(screen.getByText(/transactions, contrats/i)).toBeInTheDocument();
  });
});
