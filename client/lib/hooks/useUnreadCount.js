import { useState, useEffect } from 'react';
import { getTotalUnreadCount } from '../services/unreadCountService';

const REFRESH_INTERVAL = 30_000;

// Suspend le polling quand l'onglet est invisible pour économiser des requêtes
const useUnreadCount = (isAuthenticated = false) => {
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!isAuthenticated) {
            setUnreadCount(0);
            return;
        }

        const load = async () => {
            if (document.visibilityState === 'hidden') return;
            try { setUnreadCount(await getTotalUnreadCount()); }
            catch { setUnreadCount(0); }
        };

        load();
        const id = setInterval(load, REFRESH_INTERVAL);
        document.addEventListener('visibilitychange', load);

        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', load);
        };
    }, [isAuthenticated]);

    return unreadCount;
};

export default useUnreadCount;
