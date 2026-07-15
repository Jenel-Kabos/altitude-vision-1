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

const emptyAsyncIterable = async function* () {};

const createClient = (overrides = {}) => {
    const client = new EventEmitter();
    Object.assign(client, {
        usable: true,
        connect: jest.fn().mockResolvedValue(),
        getMailboxLock: jest.fn().mockResolvedValue({ release: jest.fn() }),
        search: jest.fn().mockResolvedValue([]),
        fetch: jest.fn().mockReturnValue(emptyAsyncIterable()),
        messageFlagsAdd: jest.fn().mockResolvedValue(),
        logout: jest.fn().mockResolvedValue(),
        close: jest.fn(),
    }, overrides);
    return client;
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
        expect(client.close).not.toHaveBeenCalled();
    });

    test('un socket timeout invalide le client, le ferme et n’envoie aucune commande IMAP supplémentaire', async () => {
        const timeout = Object.assign(new Error('Socket timeout'), { code: 'ETIMEDOUT' });
        const client = createClient({
            connect: jest.fn().mockImplementation(async () => {
                client.usable = false;
                client.emit('error', timeout);
                throw timeout;
            }),
        });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 0, skipped: 0, errors: 1 });

        expect(client.getMailboxLock).not.toHaveBeenCalled();
        expect(client.search).not.toHaveBeenCalled();
        expect(client.logout).not.toHaveBeenCalled();
        expect(client.close).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith('[IMAP] Échec réseau', expect.objectContaining({
            phase: 'connect', code: 'ETIMEDOUT', error: 'Socket timeout',
        }));
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

    test('une erreur de traitement email conserve le cleanup de la connexion', async () => {
        const client = createClient({
            search: jest.fn().mockResolvedValue([42]),
            fetch: jest.fn().mockReturnValue((async function* () {
                yield { uid: 42, source: Buffer.from('raw message') };
            })()),
        });
        ImapFlow.mockImplementation(() => client);
        simpleParser.mockRejectedValue(new Error('message malformed'));

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 0, skipped: 0, errors: 1 });

        expect(client.logout).toHaveBeenCalledTimes(1);
        expect(client.close).not.toHaveBeenCalled();
        expect(InternalMail.create).not.toHaveBeenCalled();
        expect(User.findOne).not.toHaveBeenCalled();
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
        expect(logger.warn).toHaveBeenCalledWith('[IMAP] Fermeture IMAP incomplète', expect.objectContaining({
            error: 'Logout IMAP dépassé après 5000 ms',
        }));
        jest.useRealTimers();
    });
});
