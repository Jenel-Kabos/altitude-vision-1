jest.mock('../models/Conversation', () => ({ findById: jest.fn() }));
jest.mock('../services/messagingAuthorizationService', () => ({
  evaluateConversationWriteState: jest.fn(),
  hasSupportCapability: jest.fn(),
  SUPPORT_READ: 'platform.support.read',
}));

const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const { evaluateConversationWriteState, hasSupportCapability } = require('../services/messagingAuthorizationService');
const { canAccessConversation, canWriteConversation } = require('../socket');

const conversationId = new mongoose.Types.ObjectId().toString();
const userId = new mongoose.Types.ObjectId();

const mockConversation = (conversation) => {
  const lean = jest.fn().mockResolvedValue(conversation);
  const select = jest.fn(() => ({ lean }));
  Conversation.findById.mockReturnValue({ select });
};

describe('Socket conversation authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  test('refuse un identifiant invalide sans requête MongoDB', async () => {
    await expect(canAccessConversation({ _id: userId, role: 'Client' }, 'abc')).resolves.toBe(false);
    expect(Conversation.findById).not.toHaveBeenCalled();
  });

  test('autorise uniquement un participant de la conversation ordinaire', async () => {
    mockConversation({ participants: [userId], isStaffInbox: false });
    await expect(canAccessConversation({ _id: userId, role: 'Client' }, conversationId)).resolves.toBe(true);

    mockConversation({ participants: [new mongoose.Types.ObjectId()], isStaffInbox: false });
    await expect(canAccessConversation({ _id: userId, role: 'Client' }, conversationId)).resolves.toBe(false);
  });

  // P0 SUPPORT-INBOX — la boîte de support appartient exclusivement à Altitude
  // Vision : ni le rôle ni le tenant de la conversation n'ouvrent l'accès.
  test('refuse tout membre d’organisation sur la boîte de support, même sur son propre tenant', async () => {
    const tenantA = new mongoose.Types.ObjectId();
    hasSupportCapability.mockResolvedValue(false);
    for (const role of ['Admin', 'Collaborateur', 'CommunityManager']) {
      mockConversation({ participants: [], isStaffInbox: true, tenant: tenantA });
      await expect(canAccessConversation({ _id: userId, role }, conversationId, tenantA)).resolves.toBe(false);
      mockConversation({ participants: [], isStaffInbox: true, tenant: null });
      await expect(canAccessConversation({ _id: userId, role }, conversationId, tenantA)).resolves.toBe(false);
    }
  });

  test('autorise un agent support (platform.support.read revalidée) quel que soit le tenant de provenance', async () => {
    hasSupportCapability.mockResolvedValue(true);
    mockConversation({ participants: [], isStaffInbox: true, tenant: new mongoose.Types.ObjectId() });
    await expect(canAccessConversation({ _id: userId, role: 'Client' }, conversationId)).resolves.toBe(true);
    expect(hasSupportCapability).toHaveBeenCalledWith(expect.objectContaining({ _id: userId }), 'platform.support.read');
  });

  test('le prospect participant conserve l’accès à sa conversation de support', async () => {
    hasSupportCapability.mockResolvedValue(false);
    mockConversation({ participants: [userId], isStaffInbox: true, tenant: null });
    await expect(canAccessConversation({ _id: userId, role: 'Client' }, conversationId)).resolves.toBe(true);
  });

  test('un utilisateur multi-tenant dans le contexte A ne rejoint pas une conversation B même s’il est participant', async () => {
    const tenantA = new mongoose.Types.ObjectId();
    const tenantB = new mongoose.Types.ObjectId();
    mockConversation({ participants: [userId], isStaffInbox: false, tenant: tenantB });
    await expect(canAccessConversation({ _id: userId, role: 'Client' }, conversationId, tenantA)).resolves.toBe(false);
  });

  test('revalide la capacité d’écriture pour typing et refuse une conversation devenue read-only', async () => {
    mockConversation({ _id: conversationId, participants: [userId], isStaffInbox: false });
    evaluateConversationWriteState.mockResolvedValue({ writable: false, code: 'CONTACT_AUTHORIZATION_REQUIRED' });
    await expect(canWriteConversation({ _id: userId, role: 'Client' }, conversationId)).resolves.toBe(false);
    expect(evaluateConversationWriteState).toHaveBeenCalled();
  });
});
