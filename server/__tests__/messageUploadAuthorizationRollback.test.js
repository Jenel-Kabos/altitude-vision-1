const mockUploadedAsset = {
  assetClass: 'PRIVATE_DOCUMENT', provider: 'cloudinary', deliveryType: 'authenticated',
  publicId: 'private/conversation/test', resourceType: 'raw', purpose: 'conversation',
};
const mockUploadPrivateAsset = jest.fn().mockResolvedValue(mockUploadedAsset);
const mockDeletePrivateAsset = jest.fn().mockResolvedValue({ result: 'ok' });
const mockAssertConversationWritable = jest.fn()
  .mockResolvedValueOnce({ writable: true })
  .mockRejectedValueOnce(Object.assign(new Error('révoquée'), { code: 'CONTACT_AUTHORIZATION_REQUIRED', statusCode: 403 }));

jest.mock('../services/storage/secureStorageService', () => ({
  uploadPrivateAsset: (...args) => mockUploadPrivateAsset(...args),
  deletePrivateAsset: (...args) => mockDeletePrivateAsset(...args),
  readPrivateAsset: jest.fn(),
}));
jest.mock('../services/messagingAuthorizationService', () => ({
  assertConversationAccess: jest.fn().mockResolvedValue(),
  assertConversationWritable: (...args) => mockAssertConversationWritable(...args),
}));
jest.mock('../models/Conversation', () => ({ findById: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../models/Message', () => ({ create: jest.fn() }));
jest.mock('../socket', () => ({ getIO: jest.fn(), emitConversationEvent: jest.fn() }));
jest.mock('../services/notificationService', () => ({ notify: jest.fn(), notifyStaff: jest.fn() }));

const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message');
const { sendMessage } = require('../controllers/messageController');

test('supprime l’asset privé si l’autorisation est révoquée pendant l’upload', async () => {
  const conversation = { _id: 'conv-1', participants: ['client-1', 'owner-1'], isStaffInbox: false, tenant: null };
  Conversation.findById.mockResolvedValue(conversation);
  User.findById.mockResolvedValue({ _id: 'owner-1' });
  const req = {
    user: { id: 'client-1', _id: 'client-1', role: 'Client' },
    body: { conversationId: 'conv-1', content: 'Pièce jointe' },
    files: [{ buffer: Buffer.from('pdf'), mimetype: 'application/pdf', originalname: 'dossier.pdf', size: 3 }],
  };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await sendMessage(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONTACT_AUTHORIZATION_REQUIRED' }));
  expect(mockDeletePrivateAsset).toHaveBeenCalledWith(mockUploadedAsset);
  expect(Message.create).not.toHaveBeenCalled();
});
