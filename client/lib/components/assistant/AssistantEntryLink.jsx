"use client";

// ALTIMMO-AI-INTEGRATION-02 — point d'entrée vers l'assistant, affiché uniquement lorsque le
// serveur confirme son activation : aucun lien vers un assistant indisponible.
// AI-INTEGRATION-01 (DeepSeek) : également affiché pour un compte connecté que le serveur autorise au conseiller.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAssistantStatus } from '../../services/altimmoAssistantService';
import { getAdvisorStatus } from '../../services/altimmoAdvisorService';

const hasSession = () => { try { return Boolean(window.localStorage.getItem('token')); } catch { return false; } };

export default function AssistantEntryLink({ href, children, ...props }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    getAssistantStatus().then(async (value) => {
      // Sans session, aucun appel au conseiller (pas de 401, pas de déconnexion automatique).
      const advisor = !value && hasSession() ? (await getAdvisorStatus()).available === true : false;
      if (active) setEnabled(value || advisor);
    }).catch(() => {}); // les services d'état ne rejettent pas : garde de forme
    return () => { active = false; };
  }, []);
  if (!enabled) return null;
  return <Link href={href} {...props}>{children}</Link>;
}
