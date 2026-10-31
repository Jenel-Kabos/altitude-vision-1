"use client";

// ALTIMMO-AI-INTEGRATION-02 — point d'entrée vers l'assistant, affiché uniquement lorsque le
// serveur confirme son activation : aucun lien vers un assistant indisponible.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAssistantStatus } from '../../services/altimmoAssistantService';

export default function AssistantEntryLink({ href, children, ...props }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    getAssistantStatus().then((value) => { if (active) setEnabled(value); }).catch(() => {}); // getAssistantStatus ne rejette pas : garde de forme
    return () => { active = false; };
  }, []);
  if (!enabled) return null;
  return <Link href={href} {...props}>{children}</Link>;
}
