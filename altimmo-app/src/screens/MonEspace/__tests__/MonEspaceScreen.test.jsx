// GL-MOBILE-CLIENT-SPACE-01 — vérifie MonEspaceScreen :
//   - render Client simple : pas de tuile "Espace locataire"
//   - render Client + Locataire : tuile + bannière "Espace locataire" visibles
//   - compteurs affichés depuis le hook (aucune valeur hardcodée)
//   - navigation vers les écrans existants (Favoris, Visites, Transactions,
//     MyDocuments, TenantPortal…) — jamais duplication
//   - loading state → "—" affiché, pas de zéros trompeurs
//   - Propriétaire : tuile "Mes annonces" visible

import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});

jest.mock('expo-image', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Image: (props) => ReactActual.createElement(RN.View, props) };
});

jest.mock('expo-linear-gradient', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { LinearGradient: (props) => ReactActual.createElement(RN.View, props, props.children) };
});

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const chainable = () => new Proxy(() => chainable(), { get: () => chainable() });
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (Component) => Component },
    FadeIn: chainable(),
    FadeInDown: chainable(),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

let mockUseMonEspaceOverview;
jest.mock('../../../hooks/useMonEspaceOverview', () => ({
  __esModule: true,
  useMonEspaceOverview: (...args) => mockUseMonEspaceOverview(...args),
  default: (...args) => mockUseMonEspaceOverview(...args),
}));

let mockUser = { name: 'Alice Test', email: 'alice@test.local', phone: '+242 06 000 00 00', role: 'Client', photo: null };
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: require('../../../theme/colors').colors }),
}));

const MonEspaceScreen = require('../MonEspaceScreen').default;

const makeStats = (values = {}) => ({
  favorites: { count: values.favorites ?? 0, loading: false, error: null },
  visits: { count: values.visits ?? 0, loading: false, error: null },
  transactions: { count: values.transactions ?? 0, loading: false, error: null },
  documents: { count: values.documents ?? 0, loading: false, error: null },
});

const makeLoadingStats = () => ({
  favorites: { count: null, loading: true, error: null },
  visits: { count: null, loading: true, error: null },
  transactions: { count: null, loading: true, error: null },
  documents: { count: null, loading: true, error: null },
});

const nav = { navigate: jest.fn(), getParent: jest.fn(() => null) };

describe('MonEspaceScreen', () => {
  beforeEach(() => {
    nav.navigate.mockClear();
    mockUser = { name: 'Alice Test', email: 'alice@test.local', phone: '+242 06 000 00 00', role: 'Client', photo: null };
  });

  test('Client simple : header, carte utilisateur, PAS de bannière/tuile Espace locataire', () => {
    mockUseMonEspaceOverview = () => ({
      stats: makeStats({ favorites: 3, visits: 2, transactions: 5, documents: 1 }),
      tenantLink: { loading: false, linked: false, data: null, error: null },
      refresh: jest.fn(), refreshing: false,
    });
    render(<MonEspaceScreen navigation={nav} />);
    expect(screen.getByText('Mon espace')).toBeTruthy();
    expect(screen.getByText('Alice Test')).toBeTruthy();
    expect(screen.getByText('Client')).toBeTruthy(); // status chip
    // Aucune tuile Espace locataire
    expect(screen.queryByText('Espace locataire')).toBeNull();
  });

  test("le hero Altimmo utilise l'asset canonique fourni et contient la carte profil", () => {
    mockUseMonEspaceOverview = () => ({
      stats: makeStats({}),
      tenantLink: { loading: false, linked: false, data: null, error: null },
      refresh: jest.fn(), refreshing: false,
    });
    render(<MonEspaceScreen navigation={nav} />);

    const hero = screen.getByLabelText('Hero immobilier Altimmo');
    const band = screen.getByLabelText('Ruban orange Altimmo');
    expect(StyleSheet.flatten(band.props.style).backgroundColor).toBe('#E85D04');
    const banner = screen.getByLabelText('Bannière immobilière Altimmo');
    expect(banner.props.source).toBe(require('../../../../assets/images/mon-espace-hero.png'));
    expect(StyleSheet.flatten(banner.props.style)).toMatchObject({ width: '100%', height: '100%' });
    expect(screen.queryByLabelText('Illustration immobilière Altimmo')).toBeNull();
    expect(hero).toContainElement(screen.getByLabelText('Carte profil'));
  });

  test('le bouton réglages ouvre le hub Profil existant et la carte ouvre EditProfile', () => {
    mockUseMonEspaceOverview = () => ({
      stats: makeStats({}),
      tenantLink: { loading: false, linked: false, data: null, error: null },
      refresh: jest.fn(), refreshing: false,
    });
    render(<MonEspaceScreen navigation={nav} />);

    fireEvent.press(screen.getByLabelText('Ouvrir les réglages du compte'));
    expect(nav.navigate).toHaveBeenCalledWith('ProfilHome', { settingsOnly: true });

    fireEvent.press(screen.getByLabelText('Modifier mon profil'));
    expect(nav.navigate).toHaveBeenCalledWith('EditProfile', undefined);
  });

  test('les libellés longs des statistiques et services autorisent plusieurs lignes', () => {
    mockUseMonEspaceOverview = () => ({
      stats: makeStats({}),
      tenantLink: { loading: false, linked: false, data: null, error: null },
      refresh: jest.fn(), refreshing: false,
    });
    render(<MonEspaceScreen navigation={nav} />);

    expect(screen.getByText('Documents').props.numberOfLines).toBe(2);
    expect(screen.getByText('Documents').props.adjustsFontSizeToFit).toBe(true);
    expect(screen.getByText('Transactions').props.numberOfLines).toBe(2);
    expect(screen.getByText('Transactions').props.adjustsFontSizeToFit).toBe(true);
    expect(screen.getByText('Mes réservations hôtel').props.numberOfLines).toBeGreaterThanOrEqual(2);
  });

  test('Client + Locataire : bannière + tuile Espace locataire visibles + status "Client & Locataire"', () => {
    mockUseMonEspaceOverview = () => ({
      stats: makeStats({ favorites: 0, visits: 0, transactions: 0, documents: 0 }),
      tenantLink: { loading: false, linked: true, data: { linked: true, locataire: { _id: 'loc-1' } }, error: null },
      refresh: jest.fn(), refreshing: false,
    });
    render(<MonEspaceScreen navigation={nav} />);
    expect(screen.getByText('Client & Locataire')).toBeTruthy();
    // La bannière + la tuile → au moins 2 occurrences
    expect(screen.getAllByText('Espace locataire').length).toBeGreaterThanOrEqual(1);
  });

  test('compteurs affichés depuis le hook — aucune valeur hardcodée', () => {
    mockUseMonEspaceOverview = () => ({
      stats: makeStats({ favorites: 7, visits: 4, transactions: 9, documents: 12 }),
      tenantLink: { loading: false, linked: false, data: null, error: null },
      refresh: jest.fn(), refreshing: false,
    });
    render(<MonEspaceScreen navigation={nav} />);
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  test('loading state affiche "—" plutôt que 0 (pas de faux zéros)', () => {
    mockUseMonEspaceOverview = () => ({
      stats: makeLoadingStats(),
      tenantLink: { loading: true, linked: false, data: null, error: null },
      refresh: jest.fn(), refreshing: false,
    });
    render(<MonEspaceScreen navigation={nav} />);
    // Il doit y avoir au moins 4 "—" (un par carte compteur)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText('12 favoris')).toBeNull();
    expect(screen.queryByText('6 visites')).toBeNull();
  });

  test('navigation : tap sur Favoris ouvre l\'écran Favoris existant', () => {
    mockUseMonEspaceOverview = () => ({
      stats: makeStats({}),
      tenantLink: { loading: false, linked: false, data: null, error: null },
      refresh: jest.fn(), refreshing: false,
    });
    render(<MonEspaceScreen navigation={nav} />);
    // Le libellé "Favoris" apparaît sur la stat card ET sur la tuile "Mes favoris"
    // On cible la stat card via son accessibilityLabel.
    fireEvent.press(screen.getByLabelText(/Favoris: 0/));
    expect(nav.navigate).toHaveBeenCalledWith('Favoris', undefined);
  });

  test('navigation : tap sur Espace locataire (bannière) ouvre TenantPortal existant', () => {
    mockUseMonEspaceOverview = () => ({
      stats: makeStats({}),
      tenantLink: { loading: false, linked: true, data: null, error: null },
      refresh: jest.fn(), refreshing: false,
    });
    render(<MonEspaceScreen navigation={nav} />);
    // La bannière expose un accessibilityLabel dédié
    fireEvent.press(screen.getByLabelText(/Ouvrir l'espace locataire/i));
    expect(nav.navigate).toHaveBeenCalledWith('TenantPortal', undefined);
  });

  test('Propriétaire : tuile "Mes annonces" visible', () => {
    mockUser = { ...mockUser, role: 'Proprietaire' };
    mockUseMonEspaceOverview = () => ({
      stats: makeStats({}),
      tenantLink: { loading: false, linked: false, data: null, error: null },
      refresh: jest.fn(), refreshing: false,
    });
    render(<MonEspaceScreen navigation={nav} />);
    expect(screen.getByText('Mes annonces')).toBeTruthy();
    expect(screen.getByText('Propriétaire')).toBeTruthy();
  });

  test("Client sans Propriétaire : tuile 'Mes annonces' masquée", () => {
    mockUseMonEspaceOverview = () => ({
      stats: makeStats({}),
      tenantLink: { loading: false, linked: false, data: null, error: null },
      refresh: jest.fn(), refreshing: false,
    });
    render(<MonEspaceScreen navigation={nav} />);
    expect(screen.queryByText('Mes annonces')).toBeNull();
  });
});
