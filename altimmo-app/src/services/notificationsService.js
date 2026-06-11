import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import api from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const enregistrerNotifications = async (userId) => {
  if (!Device.isDevice) return null;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const token = await Notifications.getExpoPushTokenAsync();

  try {
    await api.patch('/users/push-token', {
      pushToken: token.data,
      userId,
    });
  } catch (e) {
    console.warn('Push token save failed:', e.message);
  }

  return token.data;
};

export const programmerNotificationLocale = async (titre, corps, delaySeconds = 1) => {
  await Notifications.scheduleNotificationAsync({
    content: { title: titre, body: corps, sound: true },
    trigger: { seconds: delaySeconds },
  });
};
