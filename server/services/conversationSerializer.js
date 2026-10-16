const PRIVATE_PARTICIPANT_FIELDS = new Set(['email', 'phone', 'password', 'token', 'refreshToken', 'googleId']);

function safeParticipant(value) {
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value.toObject ? value.toObject() : value).filter(([key]) => !PRIVATE_PARTICIPANT_FIELDS.has(key)));
}

function serializeConversation(value, writeState) {
  const data = value?.toObject ? value.toObject() : { ...value };
  data.participants = (data.participants || []).map(safeParticipant);
  if (writeState) data.writeState = writeState;
  return data;
}

module.exports = { serializeConversation };
