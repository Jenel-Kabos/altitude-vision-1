const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Envoie une notification push via l'API Expo.
 * Ne lance jamais d'exception — les erreurs push ne doivent pas bloquer l'envoi de message.
 *
 * @param {string} pushToken  Token Expo de l'appareil (ex: ExponentPushToken[xxx])
 * @param {string} title      Titre de la notification
 * @param {string} body       Corps de la notification
 * @param {object} data       Données supplémentaires (ex: { conversationId, type })
 */
async function sendExpoPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken) return;

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        data,
        sound: 'default',
      }),
    });

    const result = await response.json();

    if (result.data?.status === 'error') {
      console.error('❌ [ExpoPush] Erreur livraison:', result.data.message);
    } else {
      console.log(`✅ [ExpoPush] Notification envoyée à ${pushToken.slice(-8)}`);
    }
  } catch (err) {
    console.error('❌ [ExpoPush] Échec réseau:', err.message);
  }
}

module.exports = { sendExpoPushNotification };
