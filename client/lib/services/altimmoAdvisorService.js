import api from './api';

// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — conseiller conversationnel Altimmo (comptes internes autorisés).
// L'accès est décidé par le serveur à chaque requête ; l'interface ne fait qu'afficher ce qu'il autorise.
// Les tours sont reçus en flux SSE (fetch + ReadableStream) ; la mémoire de conversation reste côté serveur.

const ADVISOR = '/altimmo/advisor';
const EVENTS = new Set(['status', 'delta', 'facts', 'final', 'error']);

/** `{ available: false }` pour toute erreur, compte non autorisé ou visiteur non connecté. */
export const getAdvisorStatus = async () => {
  try {
    const response = await api.get(`${ADVISOR}/status`);
    const data = response.data?.data;
    return data?.available === true ? data : { available: false };
  } catch {
    return { available: false };
  }
};

export const getAdvisorConversation = async (conversationId) => (await api.get(`${ADVISOR}/conversations/${encodeURIComponent(conversationId)}`)).data?.data;
export const resetAdvisorConversation = async (conversationId) => { await api.delete(`${ADVISOR}/conversations/${encodeURIComponent(conversationId)}`); };
export const cancelAdvisorTurn = async (conversationId, turnId) => {
  try { await api.delete(`${ADVISOR}/conversations/${encodeURIComponent(conversationId)}/turns/${encodeURIComponent(turnId)}`); } catch { /* tour déjà terminé */ }
};

/** Découpe un flux SSE en événements `{ event, data }` (événements fermés, données JSON sur une ligne). */
export function createSseParser(onEvent) {
  let buffer = '';
  const flush = (block) => {
    const event = /^event: (.+)$/m.exec(block)?.[1];
    const raw = /^data: (.+)$/m.exec(block)?.[1];
    if (!EVENTS.has(event) || raw === undefined) return;
    try { onEvent({ event, data: JSON.parse(raw) }); } catch { /* bloc illisible ignoré */ }
  };
  return {
    push(text) {
      buffer += text.replace(/\r\n/g, '\n');
      let index = buffer.indexOf('\n\n');
      while (index !== -1) { flush(buffer.slice(0, index)); buffer = buffer.slice(index + 2); index = buffer.indexOf('\n\n'); }
    },
    end() { if (buffer.trim()) flush(buffer); buffer = ''; },
  };
}

const advisorError = (status, code, message) => Object.assign(new Error(message || 'Le conseiller est indisponible.'), { response: { status, data: { code, message } } });

/**
 * Envoie un message et transmet les événements du tour à `onEvent`. Résout avec la réponse finale.
 * `signal` interrompt la lecture locale ; l'annulation serveur passe par `cancelAdvisorTurn`.
 */
export async function streamAdvisorTurn({ conversationId, turnId, message, onEvent = () => {}, signal, fetchImpl = globalThis.fetch }) {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
  const response = await fetchImpl(`${api.defaults.baseURL}${ADVISOR}/conversations/${encodeURIComponent(conversationId)}/turns`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ message, turnId }),
  });
  if (!response.ok) {
    let body = {};
    try { body = await response.json(); } catch { /* corps absent */ }
    throw advisorError(response.status, body.code, body.message);
  }
  let final = null; let failure = null;
  const parser = createSseParser(({ event, data }) => {
    if (event === 'final') final = data;
    if (event === 'error') failure = data;
    onEvent({ event, data });
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.end();
  if (failure) throw advisorError(failure.code === 'ADVISOR_TURN_CANCELLED' ? 499 : 503, failure.code, failure.message);
  if (!final) throw advisorError(503, 'ADVISOR_INCOMPLETE', 'La réponse du conseiller a été interrompue. Vos critères validés sont conservés.');
  return final;
}

/** Erreur → état d'interface. */
export function classifyAdvisorError(error) {
  if (error?.name === 'AbortError') return { kind: 'cancelled', message: 'Demande annulée. Vos critères validés sont conservés.' };
  const response = error?.response;
  if (!response) return { kind: 'network', message: 'Connexion impossible. Vérifiez votre réseau puis réessayez.' };
  const code = response.data?.code;
  if (code === 'ADVISOR_TURN_CANCELLED') return { kind: 'cancelled', message: 'Demande annulée. Vos critères validés sont conservés.' };
  if (response.status === 401) return { kind: 'auth', message: 'Votre session a expiré. Reconnectez-vous pour poursuivre.' };
  if (response.status === 403 || code === 'ADVISOR_DISABLED' || code === 'ADVISOR_ENVIRONMENT_NOT_ALLOWED') return { kind: 'disabled', message: 'Le conseiller n’est pas disponible pour ce compte. La recherche d’annonces reste accessible.' };
  if (response.status === 429) return { kind: 'rate_limited', message: 'Trop de messages en peu de temps. Réessayez dans une minute.' };
  return { kind: 'unavailable', message: response.data?.message || 'Le conseiller est momentanément indisponible. Réessayez.' };
}
