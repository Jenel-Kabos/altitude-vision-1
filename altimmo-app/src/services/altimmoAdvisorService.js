// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — conseiller conversationnel Altimmo (mobile, comptes internes autorisés).
// Même contrat que client/lib/services/altimmoAdvisorService.js. Transport : le `fetch` de React Native ne
// fournit pas de flux lisible ; les événements SSE sont donc lus au fil de `XMLHttpRequest.onprogress`
// (texte reçu cumulatif). Si la plateforme ne livre la réponse qu'à la fin, les mêmes événements sont
// traités à `onload` : seul l'affichage progressif est perdu, jamais la réponse.
import api, { getToken } from './api';

const ADVISOR = '/altimmo/advisor';
const EVENTS = new Set(['status', 'delta', 'facts', 'final', 'error']);

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

/** Découpe un flux SSE en événements `{ event, data }`. */
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
const abortError = () => Object.assign(new Error('Demande annulée.'), { name: 'AbortError' });

/** Envoie un message ; `onEvent` reçoit les événements du tour ; résout avec la réponse finale. */
export async function sendAdvisorTurn({ conversationId, turnId, message, onEvent = () => {}, signal, XHR = globalThis.XMLHttpRequest }) {
  const token = await getToken();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const xhr = new XHR();
    let seen = 0; let final = null; let failure = null; let settled = false;
    const parser = createSseParser(({ event, data }) => {
      if (event === 'final') final = data;
      if (event === 'error') failure = data;
      onEvent({ event, data });
    });
    const consume = () => {
      const text = typeof xhr.responseText === 'string' ? xhr.responseText : '';
      if (text.length > seen) { parser.push(text.slice(seen)); seen = text.length; }
    };
    const finish = (fn, value) => { if (settled) return; settled = true; signal?.removeEventListener?.('abort', onAbort); fn(value); };
    const onAbort = () => { xhr.abort(); finish(reject, abortError()); };
    signal?.addEventListener?.('abort', onAbort);
    xhr.open('POST', `${api.defaults.baseURL}${ADVISOR}/conversations/${encodeURIComponent(conversationId)}/turns`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onprogress = () => { if (xhr.status >= 200 && xhr.status < 300) consume(); };
    xhr.onerror = () => finish(reject, Object.assign(new Error('Connexion interrompue.'), { response: undefined }));
    xhr.ontimeout = xhr.onerror;
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let body = {};
        try { body = JSON.parse(xhr.responseText || '{}'); } catch { /* corps absent */ }
        finish(reject, advisorError(xhr.status, body.code, body.message));
        return;
      }
      consume(); parser.end();
      if (failure) finish(reject, advisorError(failure.code === 'ADVISOR_TURN_CANCELLED' ? 499 : 503, failure.code, failure.message));
      else if (!final) finish(reject, advisorError(503, 'ADVISOR_INCOMPLETE', 'La réponse du conseiller a été interrompue. Vos critères validés sont conservés.'));
      else finish(resolve, final);
    };
    xhr.send(JSON.stringify({ message, turnId }));
  });
}

export function classifyAdvisorError(error) {
  if (error?.name === 'AbortError') return { kind: 'cancelled', message: 'Demande annulée. Vos critères validés sont conservés.' };
  const response = error?.response;
  if (!response) return { kind: 'network', message: 'Connexion interrompue. Vos critères validés sont conservés ; réessayez.' };
  const code = response.data?.code;
  if (code === 'ADVISOR_TURN_CANCELLED') return { kind: 'cancelled', message: 'Demande annulée. Vos critères validés sont conservés.' };
  if (response.status === 401) return { kind: 'auth', message: 'Votre session a expiré. Reconnectez-vous pour poursuivre.' };
  if (response.status === 403 || code === 'ADVISOR_DISABLED' || code === 'ADVISOR_ENVIRONMENT_NOT_ALLOWED') return { kind: 'disabled', message: 'Le conseiller n’est pas disponible pour ce compte. La recherche d’annonces reste accessible.' };
  if (response.status === 429) return { kind: 'rate_limited', message: 'Trop de messages en peu de temps. Réessayez dans une minute.' };
  return { kind: 'unavailable', message: response.data?.message || 'Le conseiller est momentanément indisponible. Réessayez.' };
}
