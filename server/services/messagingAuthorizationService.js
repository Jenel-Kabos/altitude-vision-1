// server/services/messagingAuthorizationService.js
// HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — extraction verbatim de
// `assertConversationAccess` (auparavant définie uniquement dans
// `conversationController.js`, sans export) vers un service partagé, pour
// que `messageController.js::getMessages` puisse la réutiliser sans créer
// un edge controller→controller (catégorie de dette déjà suivie par le
// checker d'architecture canonique). Aucune ligne de logique modifiée par
// rapport à la version originale — voir
// HOTFIX_MESSAGING_MESSAGE_READ_AUTHORITY1_EXISTING_CONTRACT.md pour la
// preuve que ce contrat (isStaff ALL_STAFF, tenant-résolu-ou-non-attribué,
// OU participant réel) est déjà celui utilisé identiquement par 4 fonctions
// indépendantes de `conversationController.js` — jamais une politique
// inventée pour ce hotfix.
const { ALL_STAFF } = require('../utils/roles');
const { assertResourceTenantOrUnattributed } = require('./platformTenant/tenantResourceAttributionService');

const activeTenantId = (req) => req.platformTenant?._id;

/**
 * Autorité Messaging canonique sur une conversation précise : tenant résolu
 * (si l'appelant en a un) ET (staff OU participant réel). Lève une erreur
 * nommée `ConversationAccessError` (statusCode 403) si aucune des deux
 * conditions n'est remplie — jamais un accès élargi, jamais une nouvelle
 * condition ajoutée par rapport au comportement historique.
 */
async function assertConversationAccess(req, conversation) {
  if (activeTenantId(req)) {
    await assertResourceTenantOrUnattributed({ resourceType: 'Conversation', resource: conversation, tenantId: activeTenantId(req) });
  }
  const isStaff = ALL_STAFF.includes(req.user.role);
  const isParticipant = (conversation.participants || []).some((participant) =>
    String(participant?._id || participant) === String(req.user.id));
  if (!isStaff && !isParticipant) {
    const error = new Error('Accès refusé');
    error.name = 'ConversationAccessError';
    error.statusCode = 403;
    throw error;
  }
}

module.exports = { assertConversationAccess };
