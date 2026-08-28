const mongoose = require('mongoose');
const { serializeMessage } = require('../services/messageSerializer');

const MESSAGE_ID = new mongoose.Types.ObjectId('507f191e810c19729de860ea');
const ATTACHMENT_ID = new mongoose.Types.ObjectId('507f191e810c19729de860eb');
const SENDER_ID = new mongoose.Types.ObjectId('507f191e810c19729de860ec');
const CONVERSATION_ID = new mongoose.Types.ObjectId('507f191e810c19729de860ed');

const base = (overrides = {}) => ({
  _id: MESSAGE_ID,
  sender: SENDER_ID,
  receiver: null,
  conversation: CONVERSATION_ID,
  subject: 'Sans objet',
  content: '',
  isRead: false,
  isStarred: false,
  attachments: [],
  createdAt: new Date('2026-08-23T10:00:00.000Z'),
  updatedAt: new Date('2026-08-23T10:01:00.000Z'),
  ...overrides,
});

describe('serializeMessage — contrat historique avant extraction', () => {
  test('préserve exactement un message minimal plain avec sender ObjectId, timestamps et unread', () => {
    const input = base();
    const output = serializeMessage(input);

    expect(output).toEqual(input);
    expect(output).not.toBe(input);
    expect(output.sender).toBe(SENDER_ID);
    expect(output.conversation).toBe(CONVERSATION_ID);
    expect(output.content).toBe('');
    expect(output.isRead).toBe(false);
    expect(output.createdAt).toEqual(new Date('2026-08-23T10:00:00.000Z'));
    expect(output.updatedAt).toEqual(new Date('2026-08-23T10:01:00.000Z'));
  });

  test('préserve sender et conversation populated sans ajouter de champ privé', () => {
    const input = base({
      sender: { _id: SENDER_ID, name: 'Alice', email: 'alice@example.test', avatar: '/alice.png' },
      conversation: { _id: CONVERSATION_ID, isStaffInbox: true },
    });
    const output = serializeMessage(input);

    expect(output.sender).toEqual(input.sender);
    expect(output.conversation).toEqual(input.conversation);
    expect(output.sender).not.toHaveProperty('password');
    expect(output.sender).not.toHaveProperty('token');
    expect(output.sender).not.toHaveProperty('refreshToken');
    expect(output.sender).not.toHaveProperty('googleId');
  });

  test('utilise toObject pour un document-like et ne mute pas sa représentation source', () => {
    const source = base({ content: 'Document Mongoose' });
    const value = { toObject: jest.fn(() => source) };
    const output = serializeMessage(value);

    expect(value.toObject).toHaveBeenCalledTimes(1);
    expect(output).toEqual(source);
    expect(source.attachments).toEqual([]);
  });

  test('asset privé devient un descripteur sûr sans publicId, provider, version ni URL', () => {
    const output = serializeMessage(base({
      attachments: [{
        _id: ATTACHMENT_ID, type: 'file', nom: 'contrat.pdf', size: 42,
        asset: {
          assetClass: 'PRIVATE_DOCUMENT', purpose: 'conversation', provider: 'cloudinary',
          publicId: 'private/secret-id', resourceType: 'raw', deliveryType: 'authenticated',
          version: '123', format: 'pdf', mimeType: 'application/pdf',
          originalFilename: 'contrat.pdf', size: 42,
        },
      }],
    }));

    expect(output.attachments).toEqual([{
      _id: ATTACHMENT_ID, type: 'file', nom: 'contrat.pdf', size: 42,
      assetClass: 'PRIVATE_DOCUMENT', purpose: 'conversation', mimeType: 'application/pdf',
      originalFilename: 'contrat.pdf', canPreview: true, canDownload: true,
      previewEndpoint: `/api/messages/${MESSAGE_ID}/attachments/${ATTACHMENT_ID}`,
      downloadEndpoint: `/api/messages/${MESSAGE_ID}/attachments/${ATTACHMENT_ID}?download=1`,
    }]);
    for (const key of ['asset', 'url', 'publicId', 'provider', 'version', 'deliveryType', 'resourceType']) {
      expect(output.attachments[0]).not.toHaveProperty(key);
    }
  });

  test.each([
    ['avec URL legacy', 'https://legacy.example.test/file.pdf', true],
    ['sans URL legacy', undefined, false],
  ])('pièce jointe legacy %s conserve metadata/endpoints et capacités exactes', (_label, url, capability) => {
    const output = serializeMessage(base({
      attachments: [{ _id: ATTACHMENT_ID, type: 'file', nom: 'legacy.pdf', size: 12, url }],
    }));

    expect(output.attachments[0]).toEqual({
      _id: ATTACHMENT_ID, type: 'file', nom: 'legacy.pdf', size: 12,
      legacy: true,
      previewEndpoint: `/api/messages/${MESSAGE_ID}/attachments/${ATTACHMENT_ID}`,
      downloadEndpoint: `/api/messages/${MESSAGE_ID}/attachments/${ATTACHMENT_ID}?download=1`,
      canPreview: capability,
      canDownload: capability,
    });
    expect(output.attachments[0]).not.toHaveProperty('url');
  });

  test('champs optionnels absents restent absents et attachments absent devient []', () => {
    const output = serializeMessage({ _id: MESSAGE_ID, sender: SENDER_ID, content: 'Bonjour' });
    expect(output).toEqual({ _id: MESSAGE_ID, sender: SENDER_ID, content: 'Bonjour', attachments: [] });
    expect(output).not.toHaveProperty('readAt');
    expect(output).not.toHaveProperty('tenant');
  });
});
