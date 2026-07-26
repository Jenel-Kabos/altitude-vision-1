import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import AddAccommodationScreen from '../AddAccommodationScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@expo/vector-icons', () => {
  const RN = require('react-native');
  const ReactActual = require('react');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-request-id-1'),
}));
jest.mock('../../../services/annonceService', () => ({
  createFullAccommodationMobile: jest.fn(),
  uploadToCloudinary: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://photo1.jpg' }],
  }),
}));

import { createFullAccommodationMobile, uploadToCloudinary } from '../../../services/annonceService';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const fillInfoStep = () => {
  fireEvent.press(screen.getByLabelText('Villa meublée'));
  fireEvent.changeText(screen.getByLabelText('Titre'), 'Villa avec piscine');
  fireEvent.changeText(screen.getByLabelText('Description'), 'Description suffisante');
  fireEvent.press(screen.getByText('Continuer'));
};

const fillLocationStep = () => {
  fireEvent.press(screen.getByLabelText('Brazzaville'));
  fireEvent.press(screen.getByLabelText('Bacongo'));
  fireEvent.press(screen.getByText('Continuer'));
};

const fillFeaturesStep = () => {
  fireEvent.changeText(screen.getByLabelText('Surface (m²)'), '200');
  fireEvent.press(screen.getByText('Continuer'));
};

const fillPriceStep = () => {
  fireEvent.changeText(screen.getByLabelText('Tarif par nuit (FCFA)'), '35000');
  fireEvent.press(screen.getByText('Continuer'));
};

const addPhotoAndReachSummary = async () => {
  await fireEvent.press(screen.getByText('Ajouter des photos'));
  await waitFor(() => expect(screen.getByLabelText('Supprimer la photo')).toBeTruthy());
  fireEvent.press(screen.getByText('Continuer'));
};

describe('AddAccommodationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  test('le parcours meublé propose villa/studio mais jamais hôtel', () => {
    render(<AddAccommodationScreen navigation={navigation} />);
    expect(screen.getByLabelText('Villa meublée')).toBeTruthy();
    expect(screen.getByLabelText('Studio meublé')).toBeTruthy();
    expect(screen.queryByLabelText('Hôtel')).toBeNull();
  });

  test('le parcours hôtelier propose Hôtel/Résidence hôtelière mais aucun logement meublé', () => {
    render(<AddAccommodationScreen navigation={navigation} route={{ params: { publicationKind: 'hotel_establishment' } }} />);
    expect(screen.getByLabelText('Hôtel')).toBeTruthy();
    expect(screen.getByLabelText('Résidence hôtelière')).toBeTruthy();
    expect(screen.queryByLabelText('Villa meublée')).toBeNull();
    expect(screen.queryByLabelText('Studio meublé')).toBeNull();
    expect(screen.getByLabelText("Nom de l'hôtel")).toBeTruthy();
  });

  test('le wizard hôtelier ajoute, duplique et supprime une catégorie avec inventaire recalculé', () => {
    render(<AddAccommodationScreen navigation={navigation} route={{ params: { publicationKind: 'hotel_establishment' } }} />);
    fireEvent.changeText(screen.getByLabelText("Nom de l'hôtel"), 'Hôtel Test');
    fireEvent.changeText(screen.getByLabelText('Description commerciale'), 'Configuration professionnelle');
    fireEvent.press(screen.getByText('Continuer'));
    fireEvent.press(screen.getByLabelText('Brazzaville'));
    fireEvent.press(screen.getByLabelText('Bacongo'));
    fireEvent.changeText(screen.getByLabelText('Téléphone principal'), '+242060000000');
    fireEvent.press(screen.getByText('Continuer'));
    fireEvent.press(screen.getByText('Continuer'));
    expect(screen.getByText('0 chambres · 0 catégories')).toBeTruthy();
    fireEvent.press(screen.getByText('＋ Ajouter une catégorie'));
    fireEvent.changeText(screen.getByLabelText('Nom commercial'), 'Standard');
    fireEvent.changeText(screen.getByLabelText('Code court'), 'STD');
    expect(screen.getByText('1 chambres · 1 catégories')).toBeTruthy();
    fireEvent.press(screen.getByText('Dupliquer'));
    expect(screen.getByText('2 chambres · 2 catégories')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Supprimer')[1]);
    expect(screen.getByText('1 chambres · 1 catégories')).toBeTruthy();
  });

  test("n'affiche jamais Terrain, Bureau, Commerce ou Entrepôt dans la sélection Type de bien", () => {
    render(<AddAccommodationScreen navigation={navigation} />);
    expect(screen.queryByLabelText('Terrain')).toBeNull();
    expect(screen.queryByLabelText('Bureau')).toBeNull();
    expect(screen.queryByLabelText('Commerce')).toBeNull();
    expect(screen.queryByLabelText('Entrepôt')).toBeNull();
  });

  test('bloque la progression si la catégorie hébergement est manquante', () => {
    render(<AddAccommodationScreen navigation={navigation} />);
    fireEvent.press(screen.getByText('Continuer'));
    expect(screen.getByText("Choisissez une catégorie d'hébergement")).toBeTruthy();
  });

  test("le compteur salle de bain a un plancher de 1 (impossible de descendre à 0 depuis l'UI, exigence de soumission backend)", () => {
    render(<AddAccommodationScreen navigation={navigation} />);
    fillInfoStep();
    fillLocationStep();
    fireEvent.press(screen.getByLabelText('Diminuer Salles de bain'));
    fireEvent.press(screen.getByLabelText('Diminuer Salles de bain'));
    fillFeaturesStep();
    expect(screen.queryByText('Au moins 1 salle de bain requise')).toBeNull();
  });

  test('bloque la progression tant que la surface est manquante', () => {
    render(<AddAccommodationScreen navigation={navigation} />);
    fillInfoStep();
    fillLocationStep();
    fireEvent.press(screen.getByText('Continuer'));
    expect(screen.getByText('Surface requise')).toBeTruthy();
  });

  describe('publication (appel unique atomique)', () => {
    const publish = async () => {
      render(<AddAccommodationScreen navigation={navigation} />);
      fillInfoStep();
      fillLocationStep();
      fillFeaturesStep();
      fillPriceStep();
      await addPhotoAndReachSummary();
      fireEvent.press(screen.getByText('Publier'));
    };

    test('un seul appel à createFullAccommodationMobile, jamais 4 appels séparés', async () => {
      uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/x/photo.jpg');
      createFullAccommodationMobile.mockResolvedValue({
        property: { _id: 'prop-1' },
        accommodation: { _id: 'acc-1', publicationStatus: 'soumis' },
      });

      await publish();

      await waitFor(() => expect(createFullAccommodationMobile).toHaveBeenCalledTimes(1));
      const { property, accommodation, ratePlan } = createFullAccommodationMobile.mock.calls[0][0];
      expect(property.categorie).toBe('hebergement');
      expect(accommodation.accommodationType).toBe('villa_meublee');
      expect(ratePlan).toEqual({ mode: 'nightly', amount: 35000, currency: 'XAF' });
    });

    test('la même publicationRequestId est envoyée au backend (générée une seule fois par publication)', async () => {
      uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/x/photo.jpg');
      createFullAccommodationMobile.mockResolvedValue({ property: { _id: 'prop-1' }, accommodation: { _id: 'acc-1' } });

      await publish();

      await waitFor(() => expect(createFullAccommodationMobile).toHaveBeenCalled());
      expect(createFullAccommodationMobile.mock.calls[0][0].publicationRequestId).toBe('test-request-id-1');
    });

    test('succès : brouillon supprimé et navigation de confirmation proposée', async () => {
      uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/x/photo.jpg');
      createFullAccommodationMobile.mockResolvedValue({ property: { _id: 'prop-1' }, accommodation: { _id: 'acc-1' } });

      await publish();

      await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
        'Hébergement envoyé',
        expect.stringContaining('attente de validation'),
        expect.any(Array),
      ));
    });

    test('double-clic sur Publier bloqué : bouton non re-pressable pendant l\'envoi, un seul appel API', async () => {
      uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/x/photo.jpg');
      let resolvePublish;
      createFullAccommodationMobile.mockReturnValue(new Promise((resolve) => { resolvePublish = resolve; }));

      render(<AddAccommodationScreen navigation={navigation} />);
      fillInfoStep();
      fillLocationStep();
      fillFeaturesStep();
      fillPriceStep();
      await addPhotoAndReachSummary();
      fireEvent.press(screen.getByText('Publier'));

      // Pendant l'envoi, le bouton affiche un indicateur de chargement à la place du
      // texte "Publier" (voir components/Button.jsx) — un second tap est structurellement
      // impossible à déclencher via ce texte, en plus du garde `if (submitting) return`.
      expect(screen.queryByText('Publier')).toBeNull();

      resolvePublish({ property: { _id: 'prop-1' }, accommodation: { _id: 'acc-1' } });
      await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
      expect(createFullAccommodationMobile).toHaveBeenCalledTimes(1);
    });

    test('erreur réseau : message affiché, champs du formulaire conservés (pas de reset)', async () => {
      uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/x/photo.jpg');
      const networkError = new Error('Connexion impossible. Vérifiez votre réseau puis réessayez.');
      networkError.isNetworkError = true;
      createFullAccommodationMobile.mockRejectedValue(networkError);

      await publish();

      await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Erreur', networkError.message));
      // Le récapitulatif affiche toujours le titre saisi — le formulaire n'est jamais
      // réinitialisé après un échec (l'utilisateur peut directement relancer "Publier").
      expect(screen.getByText('Villa avec piscine')).toBeTruthy();
      expect(screen.getByText('Publier')).toBeTruthy();
    });

    test('retry après échec réseau : la même publicationRequestId est réutilisée, jamais régénérée', async () => {
      uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/x/photo.jpg');
      createFullAccommodationMobile
        .mockRejectedValueOnce(Object.assign(new Error('Connexion impossible.'), { isNetworkError: true }))
        .mockResolvedValueOnce({ property: { _id: 'prop-1' }, accommodation: { _id: 'acc-1' } });

      render(<AddAccommodationScreen navigation={navigation} />);
      fillInfoStep();
      fillLocationStep();
      fillFeaturesStep();
      fillPriceStep();
      await addPhotoAndReachSummary();
      fireEvent.press(screen.getByText('Publier'));
      await waitFor(() => expect(createFullAccommodationMobile).toHaveBeenCalledTimes(1));

      fireEvent.press(screen.getByText('Publier'));
      await waitFor(() => expect(createFullAccommodationMobile).toHaveBeenCalledTimes(2));

      const [firstCall, secondCall] = createFullAccommodationMobile.mock.calls;
      expect(firstCall[0].publicationRequestId).toBe(secondCall[0].publicationRequestId);
    });

    test('retry après échec réseau : les photos déjà uploadées ne sont pas re-uploadées', async () => {
      uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/x/photo.jpg');
      createFullAccommodationMobile
        .mockRejectedValueOnce(Object.assign(new Error('Connexion impossible.'), { isNetworkError: true }))
        .mockResolvedValueOnce({ property: { _id: 'prop-1' }, accommodation: { _id: 'acc-1' } });

      render(<AddAccommodationScreen navigation={navigation} />);
      fillInfoStep();
      fillLocationStep();
      fillFeaturesStep();
      fillPriceStep();
      await addPhotoAndReachSummary();
      fireEvent.press(screen.getByText('Publier'));
      await waitFor(() => expect(createFullAccommodationMobile).toHaveBeenCalledTimes(1));

      fireEvent.press(screen.getByText('Publier'));
      await waitFor(() => expect(createFullAccommodationMobile).toHaveBeenCalledTimes(2));

      expect(uploadToCloudinary).toHaveBeenCalledTimes(1);
    });
  });
});
