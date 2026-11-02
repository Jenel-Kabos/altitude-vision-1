"use client";

// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — choix du parcours sur /immobilier/assistant.
// Le conseiller conversationnel n'est affiché que si le serveur confirme l'accès du compte connecté ;
// tous les autres visiteurs gardent l'assistant de recherche existant, sans changement. Ce choix
// d'affichage n'est pas une protection : chaque route du conseiller vérifie l'accès côté serveur.
import React, { useEffect, useState } from 'react';
import AltimmoAssistant from './AltimmoAssistant';
import AltimmoAdvisorChat from './AltimmoAdvisorChat';
import AssistantPublicDiscovery from './AssistantPublicDiscovery';
import { useAuth } from '../../context/AuthContext';
import { getAdvisorStatus } from '../../services/altimmoAdvisorService';
import { getAssistantStatus } from '../../services/altimmoAssistantService';

export default function AltimmoAssistantGate({ initialFilters = null }) {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState(null);
  const [classicEnabled, setClassicEnabled] = useState(null);
  const [classic, setClassic] = useState(false);

  useEffect(() => {
    let alive = true;
    if (loading) return undefined;
    getAssistantStatus().then((value) => { if (alive) setClassicEnabled(value); }).catch(() => { if (alive) setClassicEnabled(false); });
    if (!user) { setStatus({ available: false }); return () => { alive = false; }; }
    getAdvisorStatus().then((value) => { if (alive) setStatus(value); }).catch(() => {}); // getAdvisorStatus ne rejette pas : garde de forme
    return () => { alive = false; };
  }, [user, loading]);

  if (status?.available && !classic) return <AltimmoAdvisorChat status={status} onUseClassic={() => setClassic(true)} />;
  if (classicEnabled) return <AltimmoAssistant initialFilters={initialFilters} />;
  return <AssistantPublicDiscovery />;
}
