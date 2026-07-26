import { useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Brouillon local simple par parcours de publication (Vente/Location/Hébergement).
// Limite assumée (mission §13) : les photos ne sont JAMAIS persistées — leur `uri`
// locale (cache Expo ImagePicker) n'est pas garantie valide après un redémarrage de
// l'app, les restaurer silencieusement romprait le formulaire sans erreur visible.
// Seuls les champs texte/scalaires du formulaire sont sauvegardés.
const DRAFT_KEYS = {
  vente: 'draft_annonce_vente',
  location: 'draft_annonce_location',
  hebergement: 'draft_annonce_hebergement',
};

export function useDraftAnnonce(flow) {
  const key = DRAFT_KEYS[flow];
  const saveTimer = useRef(null);

  const loadDraft = useCallback(async () => {
    if (!key) return null;
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [key]);

  const saveDraft = useCallback((form) => {
    if (!key) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(key, JSON.stringify(form)).catch(() => {});
    }, 500);
  }, [key]);

  const clearDraft = useCallback(async () => {
    if (!key) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await AsyncStorage.removeItem(key).catch(() => {});
  }, [key]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  return { loadDraft, saveDraft, clearDraft };
}
