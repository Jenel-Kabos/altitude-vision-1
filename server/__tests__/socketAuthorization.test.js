jest.mock('../models/Conversation', () => ({ findById: jest.fn() }));

const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const { canAccessConversation } = require('../socket');

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

  test('autorise le staff uniquement dans la boîte partagée de son tenant actif', async () => {
    const tenantA = new mongoose.Types.ObjectId();
    const tenantB = new mongoose.Types.ObjectId();
    mockConversation({ participants: [], isStaffInbox: true, tenant: tenantA });
    await expect(canAccessConversation({ _id: userId, role: 'Collaborateur' }, conversationId, tenantA)).resolves.toBe(true);

    mockConversation({ participants: [], isStaffInbox: true, tenant: tenantB });
    await expect(canAccessConversation({ _id: userId, role: 'Collaborateur' }, conversationId, tenantA)).resolves.toBe(false);

    mockConversation({ participants: [], isStaffInbox: true, tenant: tenantA });
    await expect(canAccessConversation({ _id: userId, role: 'Client' }, conversationId, tenantA)).resolves.toBe(false);
  });

  test('un utilisateur multi-tenant dans le contexte A ne rejoint pas une conversation B même s’il est participant', async () => {
    const tenantA = new mongoose.Types.ObjectId();
    const tenantB = new mongoose.Types.ObjectId();
    mockConversation({ participants: [userId], isStaffInbox: false, tenant: tenantB });
    await expect(canAccessConversation({ _id: userId, role: 'Client' }, conversationId, tenantA)).resolves.toBe(false);
  });
});
