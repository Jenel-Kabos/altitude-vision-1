import api from './api';

export const getNotifications = (page = 1, filter = 'all') =>
  api.get('/notifications', { params: { page, filter } }).then((r) => r.data?.data);

export const getUnreadCount = () =>
  api.get('/notifications/count').then((r) => r.data?.data?.count ?? 0);

export const markRead = (id) =>
  api.patch(`/notifications/${id}/read`).then((r) => r.data?.data?.notification);

export const markAllRead = () =>
  api.patch('/notifications/read-all').then((r) => r.data?.data?.updated);

export const deleteNotification = (id) =>
  api.delete(`/notifications/${id}`);

export const clearRead = () =>
  api.delete('/notifications');
