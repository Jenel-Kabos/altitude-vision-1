import * as StoreReview from 'expo-store-review';
import * as SecureStore from 'expo-secure-store';

const SESSIONS_KEY  = 'app_sessions_count';
const REVIEWED_KEY  = 'app_store_reviewed';
const THRESHOLD     = 5; // demander après la 5e session

export const incrementSession = async () => {
  try {
    const reviewed = await SecureStore.getItemAsync(REVIEWED_KEY);
    if (reviewed) return; // ne plus jamais demander une fois fait

    const raw = await SecureStore.getItemAsync(SESSIONS_KEY);
    const count = parseInt(raw || '0', 10) + 1;
    await SecureStore.setItemAsync(SESSIONS_KEY, String(count));

    if (count >= THRESHOLD && await StoreReview.hasAction()) {
      await StoreReview.requestReview();
      await SecureStore.setItemAsync(REVIEWED_KEY, '1');
    }
  } catch {
    // silencieux — ne jamais bloquer l'app pour ça
  }
};

export const requestReviewManual = async () => {
  try {
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
      await SecureStore.setItemAsync(REVIEWED_KEY, '1');
    }
  } catch { /* silencieux */ }
};
