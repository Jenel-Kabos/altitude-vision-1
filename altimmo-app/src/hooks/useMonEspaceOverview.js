// GL-MOBILE-CLIENT-SPACE-01
// Agrège les indicateurs personnels du dashboard "Mon espace" à partir
// des APIs BACKEND réelles déjà utilisées ailleurs dans l'app. AUCUNE
// valeur hardcodée : chaque compteur provient d'un appel HTTP dédié.
//
// Sources canoniques (toutes existantes) :
//   - Favoris        : GET /likes/my-favorites?type=Property
//   - Visites        : GET /visites/my                (via VisitesScreen)
//   - Transactions   : GET /transactions/my           (getMyTransactions)
//   - Documents      : getPersonalDocuments()         (rental+accom+hotel)
//   - Statut locataire : GET /tenant-portal/link-status (getTenantLinkStatus)
//
// Chaque source est isolée dans un Promise.allSettled : une API en panne
// ne casse jamais les autres compteurs. Les erreurs individuelles sont
// exposées sous stats.<key>.error pour permettre à l'UI de dégrader.
//
// N'ajoute aucun nouveau endpoint backend.

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { getMyTransactions } from '../services/transactionService';
import { getPersonalDocuments } from '../services/personalDocumentService';
import { getTenantLinkStatus } from '../services/tenantPortalService';

const emptyMetric = () => ({ count: null, loading: true, error: null });

async function loadFavoritesCount() {
  const res = await api.get('/likes/my-favorites?type=Property');
  const list = res.data?.data?.favorites?.properties || [];
  return Array.isArray(list) ? list.length : 0;
}

async function loadVisitsCount() {
  const res = await api.get('/visites/my');
  const list = res.data?.data?.visites || [];
  return Array.isArray(list) ? list.length : 0;
}

async function loadTransactionsCount() {
  const list = await getMyTransactions();
  return Array.isArray(list) ? list.length : 0;
}

async function loadDocumentsCount() {
  const result = await getPersonalDocuments();
  const list = result?.documents || [];
  return list.length;
}

async function loadTenantLink() {
  // Peut renvoyer 404/501/etc. si le back a désactivé le portail : la
  // couche `getTenantLinkStatus` renvoie déjà le payload backend.
  const res = await getTenantLinkStatus();
  return res?.data?.data ?? res?.data ?? res ?? null;
}

export function useMonEspaceOverview() {
  const [stats, setStats] = useState({
    favorites: emptyMetric(),
    visits: emptyMetric(),
    transactions: emptyMetric(),
    documents: emptyMetric(),
  });
  const [tenantLink, setTenantLink] = useState({ loading: true, linked: false, data: null, error: null });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [favRes, visRes, txRes, docRes, tenantRes] = await Promise.allSettled([
      loadFavoritesCount(),
      loadVisitsCount(),
      loadTransactionsCount(),
      loadDocumentsCount(),
      loadTenantLink(),
    ]);

    const settleMetric = (settled) => settled.status === 'fulfilled'
      ? { count: settled.value ?? 0, loading: false, error: null }
      : { count: null, loading: false, error: settled.reason?.message || 'error' };

    setStats({
      favorites: settleMetric(favRes),
      visits: settleMetric(visRes),
      transactions: settleMetric(txRes),
      documents: settleMetric(docRes),
    });

    if (tenantRes.status === 'fulfilled') {
      const value = tenantRes.value || {};
      setTenantLink({
        loading: false,
        linked: Boolean(value.linked),
        data: value,
        error: null,
      });
    } else {
      // 404/route absente → utilisateur non-locataire : linked=false.
      setTenantLink({ loading: false, linked: false, data: null, error: tenantRes.reason?.message || null });
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  return { stats, tenantLink, refresh, refreshing };
}

export default useMonEspaceOverview;
