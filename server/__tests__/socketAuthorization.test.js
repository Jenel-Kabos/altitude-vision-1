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

  test('autorise le staff, mais pas un autre client, dans la boîte partagée', async () => {
    mockConversation({ participants: [], isStaffInbox: true });
    await expect(canAccessConversation({ _id: userId, role: 'Collaborateur' }, conversationId)).resolves.toBe(true);

    mockConversation({ participants: [], isStaffInbox: true });
    await expect(canAccessConversation({ _id: userId, role: 'Client' }, conversationId)).resolves.toBe(false);
  });
});
