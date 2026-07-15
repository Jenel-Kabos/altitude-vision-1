"use client";

import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const POLLING_INTERVAL_MS = 60_000;
const EMPTY_BADGES = { conversations: 0, internalMails: 0, litiges: 0, contacts: 0, visites: 0, moderation: 0, estimations: 0 };

export function useDashboardBadges(isAuthenticated) {
  const [badges, setBadges] = useState(EMPTY_BADGES);

  const refreshAllBadges = useCallback(async () => {
    if (!isAuthenticated || document.visibilityState === 'hidden') return;

    const responses = await Promise.allSettled([
      api.get('/conversations/count/unread'),
      api.get('/internal-mails/count/unread'),
      api.get('/litiges/unread-count'),
      api.get('/contact/unread-count'),
      api.get('/visites/unread-count'),
      api.get('/properties/status/pending-count'),
      api.get('/estimation/unread-count'),
    ]);

    setBadges({
      conversations: responses[0].status === 'fulfilled' ? responses[0].value.data?.data?.unreadCount ?? 0 : 0,
      internalMails: responses[1].status === 'fulfilled' ? responses[1].value.data?.data?.unreadCount ?? 0 : 0,
      litiges: responses[2].status === 'fulfilled' ? responses[2].value.data?.data?.unreadCount ?? 0 : 0,
      contacts: responses[3].status === 'fulfilled' ? responses[3].value.data?.data?.unreadCount ?? 0 : 0,
      visites: responses[4].status === 'fulfilled' ? responses[4].value.data?.data?.unreadCount ?? 0 : 0,
      moderation: responses[5].status === 'fulfilled' ? responses[5].value.data?.data?.unreadCount ?? 0 : 0,
      estimations: responses[6].status === 'fulfilled' ? responses[6].value.data?.data?.unreadCount ?? 0 : 0,
    });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setBadges(EMPTY_BADGES);
      return undefined;
    }

    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refreshAllBadges(); };
    const onRefreshRequested = () => refreshAllBadges();
    refreshAllBadges();
    const intervalId = window.setInterval(refreshAllBadges, POLLING_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('altitude:dashboard-badges:refresh', onRefreshRequested);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('altitude:dashboard-badges:refresh', onRefreshRequested);
    };
  }, [isAuthenticated, refreshAllBadges]);

  return { badges, refreshAllBadges };
}
