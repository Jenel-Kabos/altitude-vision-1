'use strict';
// Mémoire de session en RAM, transactionnelle : un tour travaille sur un brouillon
// qui n'est appliqué qu'au commit. Aucune persistance disque ou base de données.
const { createConversationState } = require('./conversationState');

const ID = /^[A-Za-z0-9_-]{1,128}$/;
let tokens = 0;

// INTEGRATION-01 : `ownerOf(id)` regroupe les conversations d'un même compte ; au-delà de `maxPerOwner`, la plus
// ancienne conversation de CE compte est retirée (un compte ne peut jamais évincer celles des autres).
function createSessionStore({ maxMessages = 16, maxChars = 12000, maxSessions = 200, maxPerOwner = Infinity, ownerOf = null, ttlMs = 30 * 60_000, draftTtlMs = 3 * 60_000, now = Date.now } = {}) {
  const sessions = new Map();
  const validateId = (id) => { if (typeof id !== 'string' || !ID.test(id)) throw new Error('Identifiant de session invalide.'); };
  const expired = (session) => now() - session.updatedAt > ttlMs;
  const load = (id, create = false) => {
    validateId(id);
    let session = sessions.get(id);
    if (session && expired(session)) { sessions.delete(id); session = null; }
    if (!session && create) {
      if (ownerOf) {
        const owner = ownerOf(id);
        const mine = [...sessions.values()].filter((item) => ownerOf(item.id) === owner).sort((a, b) => a.updatedAt - b.updatedAt);
        while (mine.length >= maxPerOwner) sessions.delete(mine.shift().id);
      }
      if (sessions.size >= maxSessions) {
        const oldest = [...sessions.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
        sessions.delete(oldest.id);
      }
      session = { id, messages: [], state: createConversationState(), updatedAt: now(), draft: null };
      sessions.set(id, session);
    }
    return session || null;
  };
  const trim = (session) => {
    const total = () => session.messages.reduce((sum, item) => sum + item.content.length, 0);
    while (session.messages.length > maxMessages || (session.messages.length > 1 && total() > maxChars)) session.messages.shift();
  };
  const clean = (text) => {
    const content = typeof text === 'string' ? text.trim() : '';
    if (!content) throw new Error('Message vide ou invalide.');
    return content.slice(0, maxChars);
  };

  return {
    get(id) {
      const session = load(id);
      return session ? structuredClone({ id: session.id, messages: session.messages, state: session.state, updatedAt: session.updatedAt }) : null;
    },
    beginTurn(id) {
      const session = load(id, true);
      tokens += 1;
      session.draft = { token: tokens, startedAt: now() };
      return { id, token: tokens, messages: structuredClone(session.messages), state: structuredClone(session.state) };
    },
    commitTurn(id, draft, { user, assistant } = {}) {
      const session = load(id);
      if (!session || !session.draft || !draft || session.draft.token !== draft.token) throw new Error('Brouillon de tour périmé ou inconnu.');
      const entries = [{ role: 'user', content: clean(user) }, { role: 'assistant', content: clean(assistant) }];
      session.state = structuredClone(draft.state);
      session.messages.push(...entries);
      session.draft = null; session.updatedAt = now(); trim(session);
      return structuredClone(session.state);
    },
    abortTurn(id, token) {
      const session = sessions.get(id);
      if (session?.draft && (token === undefined || session.draft.token === token)) session.draft = null;
    },
    reset(id) { validateId(id); return sessions.delete(id); },
    size() { return sessions.size; },
    pendingDrafts() { return [...sessions.values()].filter((session) => session.draft).length; },
    sweep() {
      let removed = 0;
      for (const [id, session] of sessions) {
        if (expired(session)) { sessions.delete(id); removed += 1; continue; }
        if (session.draft && now() - session.draft.startedAt > draftTtlMs) { session.draft = null; removed += 1; }
      }
      return removed;
    },
  };
}

module.exports = { createSessionStore };
