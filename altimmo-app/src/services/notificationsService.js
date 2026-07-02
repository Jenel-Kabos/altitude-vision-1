import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import api from './api';
import { navigate } from './navigationService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Enregistrement du push token ────────────────────────────────────────────

export const enregistrerNotifications = async (userId) => {
  if (!Device.isDevice) return null;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const token = await Notifications.getExpoPushTokenAsync();

  try {
    await api.patch('/users/push-token', { pushToken: token.data, userId });
  } catch (e) {
    console.warn('Push token save failed:', e.message);
  }

  return token.data;
};

// ─── Notification locale programmée ──────────────────────────────────────────

export const programmerNotificationLocale = async (titre, corps, delaySeconds = 1) => {
  await Notifications.scheduleNotificationAsync({
    content: { title: titre, body: corps, sound: true },
    trigger: { seconds: delaySeconds },
  });
};

// ─── Mapping type → écran de navigation ──────────────────────────────────────
// data.screen peut déjà être fourni par le serveur ; ce fallback couvre les push Expo
// qui n'ont pas de data.screen (push anciens, ou envoyés hors du nouveau système).

const TYPE_TO_SCREEN = {
  new_message:           (data) => ['Messages', { screen: 'Chat', params: data }],
  new_staff_message:     (data) => ['Messages', { screen: 'Chat', params: data }],
  visite_new:            ()     => ['Visites'],
  visite_status:         ()     => ['Visites'],
  visite_cancelled:      ()     => ['Visites'],
  transaction_created:   ()     => ['Profil', { screen: 'Transactions' }],
  transaction_finalized: ()     => ['Profil', { screen: 'Transactions' }],
  payment_success:       ()     => ['Profil', { screen: 'Transactions' }],
  payment_failed:        ()     => ['Profil', { screen: 'Transactions' }],
  quote_received:        ()     => null,
  quote_status:          ()     => null,
  quote_response:        ()     => null,
  contrat_new:           ()     => null,
  contrat_updated:       ()     => null,
  loyer_paye:            ()     => null,
  loyer_en_retard:       ()     => null,
  account_verified:      ()     => ['Profil'],
  account_suspended:     ()     => ['Profil'],
};

function resolveNavigation(data = {}) {
  const { type, screen, params } = data;

  // Si le serveur a fourni un screen explicite, on l'utilise
  if (screen) return [screen, params];

  const resolver = TYPE_TO_SCREEN[type];
  if (!resolver) return null;

  const result = resolver(data);
  if (!result) return null;
  return result; // [screenName] ou [screenName, nestedParams]
}

// ─── Listeners à initialiser une seule fois au démarrage ─────────────────────

let _receiveListener  = null;
let _responseListener = null;

export function setupNotificationListeners() {
  // Évite les doublons si appelé plusieurs fois
  _receiveListener?.remove();
  _responseListener?.remove();

  // Notification reçue en premier plan — déjà affichée par setNotificationHandler
  // On peut en plus mettre à jour le badge de l'onglet Notifications
  _receiveListener = Notifications.addNotificationReceivedListener((_notif) => {
    // Le badge est géré par shouldSetBadge:true dans setNotificationHandler
    // On pourrait émettre un event local ici pour mettre à jour l'UI sans polling
  });

  // Tap sur la notification — navigation vers l'écran concerné
  _responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    const target = resolveNavigation(data);
    if (!target) return;

    const [screen, params] = target;
    if (params) {
      navigate(screen, params);
    } else {
      navigate(screen);
    }

    // Marque la notification comme lue côté serveur si on a son ID
    if (data.notificationId) {
      api.patch(`/notifications/${data.notificationId}/read`).catch(() => {});
    }
  });
}

export function removeNotificationListeners() {
  _receiveListener?.remove();
  _responseListener?.remove();
  _receiveListener  = null;
  _responseListener = null;
}
