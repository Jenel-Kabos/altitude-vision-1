"use client";

// INBOX-PRO-1 — Composant critique de sécurité/isolation. Rend le corps
// HTML d'un email dans une iframe `srcDoc` sandboxée : le CSS/JS de
// l'email ne peut JAMAIS atteindre le DOM du dashboard, et le dashboard ne
// peut jamais casser la mise en forme de l'email. Défense en profondeur :
// DOMPurify sanitize AVANT injection (bloque script/on*/javascript:) ET le
// sandbox iframe (aucun script exécuté, même si un vecteur passait la
// sanitization) ET aucune capacité `allow-same-origin`/`allow-scripts`
// n'est jamais accordée.
//
// Fallback texte : si aucun HTML valide n'est disponible (mail interne en
// texte brut, ou email dont seule la version texte a été conservée), le
// texte brut est affiché échappé (jamais interprété comme HTML) — jamais
// "[object Object]"/"undefined"/HTML brut non rendu.
import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 4000; // borne large : une newsletter peut être longue (mandat §45), la page hôte reste scrollable normalement au-delà.

// Feuille de style injectée à l'intérieur de l'iframe uniquement — n'a
// aucun effet sur le dashboard. Neutralise les débordements classiques
// des emails professionnels (images surdimensionnées, tableaux larges)
// sans jamais forcer une largeur qui casserait un tableau de facture
// volontairement large (mandat §16 : scroll horizontal LOCAL, jamais
// une page dashboard élargie).
const BASE_STYLE = `
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'DM Sans', sans-serif;
    font-size: 14px; line-height: 1.6; color: #1f2937;
    padding: 16px; box-sizing: border-box; overflow-x: auto; word-wrap: break-word;
  }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  a { color: #2563eb; }
  * { box-sizing: border-box; }
`;

// Config DOMPurify dédiée aux emails : le profil HTML par défaut de
// DOMPurify exclut déjà script/iframe/object/embed/form et neutralise les
// attributs on*/href="javascript:" — FORBID_TAGS/FORBID_ATTR ci-dessous
// sont une déclaration explicite en défense en profondeur (mandat §13),
// pas un changement de comportement par rapport au défaut. `<style>` reste
// AUTORISÉ : contrairement à un rendu direct dans le DOM du dashboard, il
// est ici confiné à l'intérieur du <head> de l'iframe sandboxée — aucune
// règle CSS ne peut jamais atteindre le dashboard (c'est précisément ce
// que l'isolation iframe garantit), donc l'interdire perdrait de la
// fidélité de rendu (newsletters, mise en forme responsive) sans gain de
// sécurité réel.
const SANITIZE_CONFIG = {
  // `<style>` n'est pas dans la liste par défaut de DOMPurify — l'ajouter
  // explicitement ici (ADD_TAGS) est sûr uniquement parce que ce contenu
  // est ensuite injecté dans une iframe sandboxée dédiée, jamais dans le
  // DOM du dashboard.
  ADD_TAGS: ['style'],
  // Sans `FORCE_BODY`, DOMPurify traite un `<style>` en tête de fragment
  // comme un élément de `<head>` et le retire silencieusement même avec
  // `ADD_TAGS` — `FORCE_BODY` force l'interprétation "fragment de body",
  // cohérente avec la façon dont ce contenu est injecté ci-dessous.
  FORCE_BODY: true,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'formaction'],
  ALLOW_DATA_ATTR: false,
};

function sanitizeEmailHtml(rawHtml) {
  // Toute balise <a> reçoit target="_blank" + rel sécurisé : l'iframe est
  // sandboxée sans `allow-top-navigation`, donc un clic ne doit jamais
  // rester piégé dans l'iframe — il doit ouvrir un nouvel onglet (le
  // sandbox autorise cela via `allow-popups`, voir plus bas).
  const hook = (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  };
  DOMPurify.addHook('afterSanitizeAttributes', hook);
  try {
    return DOMPurify.sanitize(rawHtml || '', SANITIZE_CONFIG);
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes', hook);
  }
}

/**
 * @param {string} html - corps HTML original de l'email (non fiable, non sanitizé).
 * @param {string} text - corps texte brut (fallback si `html` absent/invalide).
 */
export default function SafeHtmlEmailViewer({ html, text }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(MIN_HEIGHT);

  const hasHtml = typeof html === 'string' && html.trim().length > 0;
  const safeHtml = hasHtml ? sanitizeEmailHtml(html) : '';
  // Un HTML "sanitizé jusqu'à vide" (ex: uniquement un <script> malveillant
  // sans aucun contenu visible) doit retomber sur le texte — jamais un
  // cadre vide sans explication (mandat §42).
  const hasRenderableHtml = safeHtml.replace(/<[^>]*>/g, '').trim().length > 0
    || /<img|<table|<br|<hr/i.test(safeHtml);

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${BASE_STYLE}</style></head><body>${safeHtml}</body></html>`;

  useEffect(() => {
    if (!hasRenderableHtml) return undefined;
    const iframe = iframeRef.current;
    if (!iframe) return undefined;
    const handleLoad = () => {
      try {
        const doc = iframe.contentWindow?.document;
        const measured = doc?.documentElement?.scrollHeight || doc?.body?.scrollHeight || MIN_HEIGHT;
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, measured + 4)));
      } catch {
        setHeight(MIN_HEIGHT);
      }
    };
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [hasRenderableHtml, srcDoc]);

  if (!hasRenderableHtml) {
    // Fallback texte : jamais interprété comme HTML, jamais
    // "[object Object]"/"undefined" affiché brut.
    const safeText = typeof text === 'string' && text.trim().length > 0
      ? text
      : '(Ce message ne contient aucun contenu affichable.)';
    return (
      <pre
        className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-700"
        data-testid="email-text-fallback"
      >
        {safeText}
      </pre>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title="Contenu de l'email"
      srcDoc={srcDoc}
      // Aucun `allow-scripts`, aucun `allow-same-origin` : le contenu ne
      // peut jamais exécuter de JS ni accéder au parent. `allow-popups`
      // permet uniquement l'ouverture de liens dans un nouvel onglet.
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      style={{ width: '100%', height, border: 'none', display: 'block' }}
      data-testid="email-html-frame"
    />
  );
}
