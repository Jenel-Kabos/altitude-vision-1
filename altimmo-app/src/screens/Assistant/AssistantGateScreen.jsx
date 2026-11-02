// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — écran « Assistant » : conseiller conversationnel pour les seuls comptes
// que le serveur déclare autorisés ; tous les autres utilisateurs gardent l'assistant de recherche existant.
// Ce choix d'affichage n'est pas une protection : chaque route du conseiller vérifie l'accès côté serveur.
import React, { useEffect, useState } from 'react';
import AssistantScreen from './AssistantScreen';
import AdvisorScreen from './AdvisorScreen';
import { useAuth } from '../../context/AuthContext';
import { getAdvisorStatus } from '../../services/altimmoAdvisorService';

export default function AssistantGateScreen(props) {
  const { user, loading } = useAuth() || {};
  const [status, setStatus] = useState(null);
  const [classic, setClassic] = useState(false);

  useEffect(() => {
    let alive = true;
    if (loading) return undefined;
    if (!user) { setStatus({ available: false }); return undefined; }
    getAdvisorStatus().then((value) => { if (alive) setStatus(value); }).catch(() => {}); // getAdvisorStatus ne rejette pas : garde de forme
    return () => { alive = false; };
  }, [user, loading]);

  if (status?.available && !classic) return <AdvisorScreen {...props} status={status} onUseClassic={() => setClassic(true)} />;
  return <AssistantScreen {...props} />;
}
