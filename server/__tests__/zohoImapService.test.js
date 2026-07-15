const { EventEmitter } = require('events');

jest.mock('imapflow', () => ({ ImapFlow: jest.fn() }));
jest.mock('mailparser', () => ({ simpleParser: jest.fn() }));
jest.mock('../models/InternalMail', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../models/User', () => ({ findOne: jest.fn() }));
jest.mock('../config/cloudinary', () => ({ uploadToCloudinary: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(),
}));

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const InternalMail = require('../models/InternalMail');
const User = require('../models/User');
const logger = require('../utils/logger');
const { pollZohoInbox } = require('../services/zohoImapService');

const message = (uid) => ({ uid, source: Buffer.from(`message-${uid}`) });
const parsedMessage = (uid) => ({
    from: { value: [{ address: `sender-${uid}@example.test`, name: 'Sender' }] },
    to: { value: [{ address: 'inbox@altitudevision.test' }] },
    subject: `Sujet ${uid}`,
    text: 'Contenu',
    messageId: `message-${uid}`,
    attachments: [],
});

const createClient = (overrides = {}) => {
    const client = new EventEmitter();
    Object.assign(client, {
        usable: true,
        connect: jest.fn().mockResolvedValue(),
        getMailboxLock: jest.fn().mockResolvedValue({ release: jest.fn() }),
        search: jest.fn().mockResolvedValue([]),
        fetchAll: jest.fn().mockResolvedValue([]),
        fetch: jest.fn(),
        messageFlagsAdd: jest.fn().mockResolvedValue(),
        logout: jest.fn().mockResolvedValue(),
        close: jest.fn(),
    }, overrides);
    return client;
};

const prepareTwoMessages = (client, messages) => {
    client.search.mockResolvedValue(messages.map(({ uid }) => uid));
    client.fetchAll.mockResolvedValue(messages);
    simpleParser.mockImplementation(async (source) => parsedMessage(Number(source.toString().replace('message-', ''))));
    User.findOne.mockResolvedValue({ _id: 'recipient-id', email: 'inbox@altitudevision.test' });
};

describe('pollZohoInbox', () => {
    const env = { ...process.env };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.ZOHO_FROM_EMAIL = 'inbox@altitudevision.test';
        process.env.ZOHO_IMAP_PASSWORD = 'test-password';
    });

    afterAll(() => {
        process.env = env;
    });

    test('connecte, cherche les emails puis ferme proprement la connexion courte', async () => {
        const lock = { release: jest.fn() };
        const client = createClient({ getMailboxLock: jest.fn().mockResolvedValue(lock) });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 0, skipped: 0, errors: 0 });

        expect(client.connect).toHaveBeenCalledTimes(1);
        expect(client.getMailboxLock).toHaveBeenCalledWith('INBOX');
        expect(client.search).toHaveBeenCalledWith({ seen: false });
        expect(lock.release).toHaveBeenCalledTimes(1);
        expect(client.logout).toHaveBeenCalledTimes(1);
    });

    test('traite deux UNSEEN avec doublon puis email valide sans commande pendant fetch', async () => {
        let fetchFinished = false;
        const client = createClient({
            fetchAll: jest.fn().mockImplementation(async () => {
                fetchFinished = true;
                return [message(1), message(2)];
            }),
            fetch: jest.fn().mockReturnValue((async function* () {
                yield message(1);
                yield message(2);
            })()),
            messageFlagsAdd: jest.fn().mockImplementation(async () => {
                if (!fetchFinished) throw new Error('nested IMAP command');
            }),
        });
        prepareTwoMessages(client, [message(1), message(2)]);
        // prepareTwoMessages intentionally uses the safe fetchAll mock defined above.
        client.fetchAll.mockImplementation(async () => {
            fetchFinished = true;
            return [message(1), message(2)];
        });
        InternalMail.findOne.mockResolvedValueOnce({ _id: 'existing' }).mockResolvedValueOnce(null);
        InternalMail.create.mockResolvedValue({ _id: 'created' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 1, skipped: 1, errors: 0 });

        expect(client.fetch).not.toHaveBeenCalled();
        expect(client.fetchAll).toHaveBeenCalledWith([1, 2], { uid: true, source: true }, { uid: true });
        expect(client.messageFlagsAdd).toHaveBeenNthCalledWith(1, 1, ['\\Seen'], { uid: true });
        expect(client.messageFlagsAdd).toHaveBeenNthCalledWith(2, 2, ['\\Seen'], { uid: true });
    });

    test('traite deux UNSEEN avec email valide puis doublon', async () => {
        const client = createClient();
        prepareTwoMessages(client, [message(1), message(2)]);
        InternalMail.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 'existing' });
        InternalMail.create.mockResolvedValue({ _id: 'created' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 1, skipped: 1, errors: 0 });

        expect(InternalMail.create).toHaveBeenCalledTimes(1);
        expect(client.messageFlagsAdd).toHaveBeenNthCalledWith(1, 1, ['\\Seen'], { uid: true });
        expect(client.messageFlagsAdd).toHaveBeenNthCalledWith(2, 2, ['\\Seen'], { uid: true });
    });

    test('isole une erreur métier du premier email et importe le second', async () => {
        const client = createClient();
        prepareTwoMessages(client, [message(1), message(2)]);
        InternalMail.findOne.mockResolvedValue(null);
        InternalMail.create.mockRejectedValueOnce(new Error('Mongo temporary failure')).mockResolvedValueOnce({ _id: 'created' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 1, skipped: 0, errors: 1 });

        expect(client.messageFlagsAdd).toHaveBeenCalledTimes(1);
        expect(client.messageFlagsAdd).toHaveBeenCalledWith(2, ['\\Seen'], { uid: true });
    });

    test('marque un doublon Seen après la phase fetch terminée', async () => {
        const client = createClient();
        prepareTwoMessages(client, [message(7)]);
        InternalMail.findOne.mockResolvedValue({ _id: 'existing' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 0, skipped: 1, errors: 0 });

        expect(client.messageFlagsAdd).toHaveBeenCalledWith(7, ['\\Seen'], { uid: true });
        expect(logger.info).toHaveBeenCalledWith('[IMAP] Étape terminée', expect.objectContaining({
            step: 'duplicate_check', isDuplicate: true,
        }));
    });

    test('un socket timeout invalide le client et arrête les commandes IMAP restantes', async () => {
        const timeout = Object.assign(new Error('Socket timeout'), { code: 'ETIMEDOUT' });
        const client = createClient();
        prepareTwoMessages(client, [message(1), message(2)]);
        InternalMail.findOne.mockResolvedValue({ _id: 'existing' });
        client.messageFlagsAdd.mockImplementationOnce(async () => {
            client.usable = false;
            client.emit('error', timeout);
            throw Object.assign(new Error('Connection not available'), { code: 'NoConnection' });
        });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 0, skipped: 2, errors: 1 });

        expect(client.messageFlagsAdd).toHaveBeenCalledTimes(1);
        expect(client.logout).not.toHaveBeenCalled();
        expect(client.close).toHaveBeenCalledTimes(1);
    });

    test('ignore un second cycle tant que le premier est actif', async () => {
        let resolveConnect;
        const client = createClient({
            connect: jest.fn().mockImplementation(() => new Promise((resolve) => { resolveConnect = resolve; })),
        });
        ImapFlow.mockImplementation(() => client);

        const firstPoll = pollZohoInbox();
        await Promise.resolve();
        await expect(pollZohoInbox()).resolves.toEqual({ imported: 0, skipped: 0, errors: 0 });
        resolveConnect();
        await firstPoll;

        expect(ImapFlow).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith('[IMAP] Polling ignoré : cycle déjà en cours');
    });

    test('un logout qui ne répond pas est borné puis la connexion est fermée localement', async () => {
        jest.useFakeTimers();
        const client = createClient({ logout: jest.fn().mockReturnValue(new Promise(() => {})) });
        ImapFlow.mockImplementation(() => client);

        const polling = pollZohoInbox();
        await jest.advanceTimersByTimeAsync(5000);
        await expect(polling).resolves.toEqual({ imported: 0, skipped: 0, errors: 1 });

        expect(client.logout).toHaveBeenCalledTimes(1);
        expect(client.close).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });
});
