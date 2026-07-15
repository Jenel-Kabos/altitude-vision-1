import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import api, { getToken } from './api';
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

// ─── Identification de l'utilisateur courant (décodage JWT local) ────────────
// Pas de vérification de signature ici : on lit juste le payload pour trouver
// "qui suis-je" côté client, la vérification d'authenticité reste au serveur.

export const getCurrentUserId = async () => {
  try {
    const token = await getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || payload._id || payload.sub;
  } catch {
    return null;
  }
};

// ─── Mapping type → écran de navigation ──────────────────────────────────────
// data.screen peut déjà être fourni par le serveur ; ce fallback couvre les push Expo
// qui n'ont pas de data.screen (push anciens, ou envoyés hors du nouveau système).

const TYPE_TO_SCREEN = {
  new_message: async (data) => {
    if (!data?.conversationId) return ['Messages', {}];
    try {
      const res = await api.get(`/conversations/${data.conversationId}`);
      const conversation = res.data?.data?.conversation;
      if (!conversation) return ['Messages', {}];
      const currentUserId = await getCurrentUserId();
      const contact = conversation.participants?.find(
        (p) => p._id?.toString() !== currentUserId
      ) || { name: 'Équipe Altitude Vision' };
      return ['Messages', {
        screen: 'Chat',
        params: { conversation, contact },
      }];
    } catch {
      return ['Messages', {}];
    }
  },
  new_staff_message: async (data) => {
    if (!data?.conversationId) return ['Messages', {}];
    try {
      const res = await api.get(`/conversations/${data.conversationId}`);
      const conversation = res.data?.data?.conversation;
      if (!conversation) return ['Messages', {}];
      return ['Messages', {
        screen: 'Chat',
        params: {
          conversation,
          contact: { name: 'Équipe Altitude Vision' },
        },
      }];
    } catch {
      return ['Messages', {}];
    }
  },
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
  bien_valide:            ()     => ['Annonces'],
  bien_rejete:            ()     => ['Profil'],
  visite_sur_mon_bien:    ()     => ['Visites'],
  message_staff: async (data) => {
    if (!data?.conversationId) return ['Messages', {}];
    try {
      const res = await api.get(`/conversations/${data.conversationId}`);
      const conversation = res.data?.data?.conversation;
      if (!conversation) return ['Messages', {}];
      return ['Messages', {
        screen: 'Chat',
        params: {
          conversation,
          contact: { name: 'Équipe Altitude Vision' },
        },
      }];
    } catch {
      return ['Messages', {}];
    }
  },
  paiement_confirme:      ()     => ['Visites'],
  paiement_echoue:        ()     => ['Visites'],
  nouveau_signalement:    ()     => ['Annonces'],
  visite_payee:           ()     => ['Visites'],
};

async function resolveNavigation(data = {}) {
  const { type, screen, params } = data;

  // Le resolver dédié au type est prioritaire — il peut enrichir les params
  // (ex: charger la conversation complète) avant de determiner l'écran.
  // Sans ça, `data.screen` (fixé par le serveur, ex: 'Chat') court-circuiterait
  // toujours ce resolver et repasserait des params insuffisants à ChatScreen.
  const resolver = TYPE_TO_SCREEN[type];
  if (resolver) {
    const result = await resolver(data);
    if (result) return result; // [screenName] ou [screenName, nestedParams]
  }

  // Fallback : screen explicite fourni par le serveur (types sans resolver dédié)
  if (screen) return [screen, params];

  return null;
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
  _responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
    const data = response.notification.request.content.data || {};
    const target = await resolveNavigation(data);
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
