const { EventEmitter } = require('events');

jest.mock('imapflow', () => ({ ImapFlow: jest.fn() }));
jest.mock('mailparser', () => ({ simpleParser: jest.fn() }));
jest.mock('../models/InternalMail', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../models/User', () => ({ findOne: jest.fn() }));
jest.mock('../models/ImapSyncCheckpoint', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../config/cloudinary', () => ({ uploadToCloudinary: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn(),
}));

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const InternalMail = require('../models/InternalMail');
const User = require('../models/User');
const ImapSyncCheckpoint = require('../models/ImapSyncCheckpoint');
const logger = require('../utils/logger');
const { pollZohoInbox, resolveSyncOrigin } = require('../services/zohoImapService');

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
        mailbox: { uidValidity: '1000' },
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
        // Checkpoint existant par défaut (même UIDVALIDITY que `createClient`,
        // lastProcessedUid=0) — la plupart des tests existants portent sur le
        // traitement des messages, pas sur le bootstrap/reset lui-même
        // (couverts séparément, voir tests "checkpoint").
        ImapSyncCheckpoint.findOne.mockResolvedValue({ uidValidity: '1000', lastProcessedUid: 0 });
        ImapSyncCheckpoint.findOneAndUpdate.mockResolvedValue({});
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
        // HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — `\Seen` n'est plus jamais le
        // critère de recherche : avec un checkpoint existant (lastProcessedUid:0,
        // même UIDVALIDITY), la recherche porte sur UID > 0, jamais sur le flag.
        expect(client.search).toHaveBeenCalledWith({ uid: '1:*' });
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

    test('INBOX-PRO-1 — conserve le HTML original en plus du texte (ne préfère plus systématiquement le texte)', async () => {
        const client = createClient();
        client.search.mockResolvedValue([1]);
        client.fetchAll.mockResolvedValue([message(1)]);
        simpleParser.mockResolvedValue({
            from: { value: [{ address: 'sender@example.test', name: 'Sender' }] },
            to: { value: [{ address: 'inbox@altitudevision.test' }] },
            subject: 'Facture HTML',
            text: 'Facture — version texte auto-générée',
            html: '<table><tr><td>Ligne</td><td>100 FCFA</td></tr></table>',
            messageId: 'message-html-1',
            attachments: [],
        });
        User.findOne.mockResolvedValue({ _id: 'recipient-id', email: 'inbox@altitudevision.test' });
        InternalMail.findOne.mockResolvedValue(null);
        InternalMail.create.mockResolvedValue({ _id: 'created' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 1, skipped: 0, errors: 0 });

        expect(InternalMail.create).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Facture — version texte auto-générée',
            html: '<table><tr><td>Ligne</td><td>100 FCFA</td></tr></table>',
        }));
    });

    test('INBOX-PRO-1 — un email HTML sans partie texte stocke quand même le HTML, jamais tronqué de façon à casser content', async () => {
        const client = createClient();
        client.search.mockResolvedValue([1]);
        client.fetchAll.mockResolvedValue([message(1)]);
        const longHtml = `<div>${'x'.repeat(250000)}</div>`;
        simpleParser.mockResolvedValue({
            from: { value: [{ address: 'sender@example.test', name: 'Sender' }] },
            to: { value: [{ address: 'inbox@altitudevision.test' }] },
            subject: 'Newsletter volumineuse',
            text: '',
            html: longHtml,
            messageId: 'message-html-2',
            attachments: [],
        });
        User.findOne.mockResolvedValue({ _id: 'recipient-id', email: 'inbox@altitudevision.test' });
        InternalMail.findOne.mockResolvedValue(null);
        InternalMail.create.mockResolvedValue({ _id: 'created' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 1, skipped: 0, errors: 0 });

        const payload = InternalMail.create.mock.calls[0][0];
        // Ne doit jamais dépasser les plafonds du schéma (content: 10000,
        // html: 200000) — une validation Mongoose échouée rejetterait
        // l'import entier d'un email par ailleurs légitime.
        expect(payload.content.length).toBeLessThanOrEqual(10000);
        expect(payload.html.length).toBeLessThanOrEqual(200000);
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

// HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — `resolveSyncOrigin` (fonction pure)
describe('resolveSyncOrigin', () => {
    test('aucun checkpoint → réexamen complet (bootstrap), jamais de perte au premier démarrage', () => {
        expect(resolveSyncOrigin(null, '1000')).toEqual({
            searchCriteria: { all: true }, baseUid: 0, isReset: true, resetReason: 'no_checkpoint',
        });
    });

    test('UIDVALIDITY inchangée → recherche incrémentale stricte UID > lastProcessedUid', () => {
        expect(resolveSyncOrigin({ uidValidity: '1000', lastProcessedUid: 112 }, '1000')).toEqual({
            searchCriteria: { uid: '113:*' }, baseUid: 112, isReset: false, resetReason: null,
        });
    });

    test('UIDVALIDITY changée → reset contrôlé (jamais un silent-skip-all avec un ancien UID devenu invalide)', () => {
        expect(resolveSyncOrigin({ uidValidity: '1000', lastProcessedUid: 112 }, '2000')).toEqual({
            searchCriteria: { all: true }, baseUid: 0, isReset: true, resetReason: 'uidvalidity_changed',
        });
    });

    test('lastProcessedUid=0 (jamais aucun message traité mais checkpoint déjà écrit) → UID > 0', () => {
        expect(resolveSyncOrigin({ uidValidity: '1000', lastProcessedUid: 0 }, '1000')).toEqual({
            searchCriteria: { uid: '1:*' }, baseUid: 0, isReset: false, resetReason: null,
        });
    });
});

// HOTFIX-ZOHO-IMAP-SEEN-CHECKPOINT-1 — comportement de bout en bout du poller
describe('pollZohoInbox — checkpoint UID (remplace `\\Seen` comme source de vérité)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.ZOHO_FROM_EMAIL = 'inbox@altitudevision.test';
        process.env.ZOHO_IMAP_PASSWORD = 'test-password';
        ImapSyncCheckpoint.findOneAndUpdate.mockResolvedValue({});
    });

    test('RÉGRESSION FERMÉE — un message déjà marqué \\Seen (UID > checkpoint) est tout de même ingéré', async () => {
        // Caractérise exactement le cas prouvé par ZOHO_INBOX_HEALTHCHECK1 :
        // UID 113 déjà \Seen, checkpoint à 112 — avant ce hotfix,
        // `search({seen:false})` ne l'aurait JAMAIS trouvé. Le mock
        // `client.search` ci-dessous ignore volontairement le flag Seen
        // (comme le ferait un serveur IMAP réel pour une recherche par UID)
        // pour prouver que le NOUVEAU critère (`uid: '113:*'`) est bien ce
        // qui est utilisé, indépendamment de tout état de lecture.
        ImapSyncCheckpoint.findOne.mockResolvedValue({ uidValidity: '1000', lastProcessedUid: 112 });
        const client = createClient();
        client.search.mockImplementation(async (criteria) => (criteria.uid === '113:*' ? [113] : []));
        client.fetchAll.mockResolvedValue([message(113)]);
        simpleParser.mockResolvedValue(parsedMessage(113));
        User.findOne.mockResolvedValue({ _id: 'admin-fallback', role: 'Admin', isActive: true });
        InternalMail.findOne.mockResolvedValue(null);
        InternalMail.create.mockResolvedValue({ _id: 'created-113' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 1, skipped: 0, errors: 0 });

        expect(client.search).toHaveBeenCalledWith({ uid: '113:*' });
        expect(InternalMail.create).toHaveBeenCalledTimes(1);
        expect(ImapSyncCheckpoint.findOneAndUpdate).toHaveBeenCalledWith(
            { account: 'inbox@altitudevision.test', mailbox: 'INBOX' },
            { uidValidity: '1000', lastProcessedUid: 113 },
            { upsert: true },
        );
    });

    test('un message non lu (Unseen) au-dessus du checkpoint est ingéré normalement (non-régression)', async () => {
        ImapSyncCheckpoint.findOne.mockResolvedValue({ uidValidity: '1000', lastProcessedUid: 112 });
        const client = createClient();
        prepareTwoMessages(client, [message(113)]);
        InternalMail.findOne.mockResolvedValue(null);
        InternalMail.create.mockResolvedValue({ _id: 'created' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 1, skipped: 0, errors: 0 });
        expect(client.search).toHaveBeenCalledWith({ uid: '113:*' });
    });

    test('bootstrap (aucun checkpoint) : réexamen complet, la déduplication empêche tout doublon pour les messages déjà ingérés', async () => {
        ImapSyncCheckpoint.findOne.mockResolvedValue(null);
        const client = createClient();
        client.search.mockResolvedValue([111, 112, 113]);
        client.fetchAll.mockResolvedValue([message(111), message(112), message(113)]);
        simpleParser.mockImplementation(async (source) => parsedMessage(Number(source.toString().replace('message-', ''))));
        User.findOne.mockResolvedValue({ _id: 'recipient-id', email: 'inbox@altitudevision.test' });
        // 111 et 112 déjà en base (déjà ingérés lors de cycles précédents,
        // avant l'introduction du checkpoint) ; 113 est nouveau.
        InternalMail.findOne
            .mockResolvedValueOnce({ _id: 'existing-111' })
            .mockResolvedValueOnce({ _id: 'existing-112' })
            .mockResolvedValueOnce(null);
        InternalMail.create.mockResolvedValue({ _id: 'created-113' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 1, skipped: 2, errors: 0 });

        expect(client.search).toHaveBeenCalledWith({ all: true });
        expect(InternalMail.create).toHaveBeenCalledTimes(1); // jamais de doublon pour 111/112
        expect(ImapSyncCheckpoint.findOneAndUpdate).toHaveBeenCalledWith(
            { account: 'inbox@altitudevision.test', mailbox: 'INBOX' },
            { uidValidity: '1000', lastProcessedUid: 113 },
            { upsert: true },
        );
    });

    test('UIDVALIDITY changée : reset contrôlé, réexamen complet sous la nouvelle valeur', async () => {
        ImapSyncCheckpoint.findOne.mockResolvedValue({ uidValidity: '1000', lastProcessedUid: 112 });
        const client = createClient({ mailbox: { uidValidity: '2000' } });
        client.search.mockResolvedValue([1]);
        client.fetchAll.mockResolvedValue([message(1)]);
        simpleParser.mockResolvedValue(parsedMessage(1));
        User.findOne.mockResolvedValue({ _id: 'recipient-id', email: 'inbox@altitudevision.test' });
        InternalMail.findOne.mockResolvedValue(null);
        InternalMail.create.mockResolvedValue({ _id: 'created' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 1, skipped: 0, errors: 0 });

        expect(client.search).toHaveBeenCalledWith({ all: true });
        expect(logger.warn).toHaveBeenCalledWith('[IMAP] Réinitialisation du checkpoint de synchronisation', expect.objectContaining({
            reason: 'uidvalidity_changed',
        }));
        expect(ImapSyncCheckpoint.findOneAndUpdate).toHaveBeenCalledWith(
            { account: 'inbox@altitudevision.test', mailbox: 'INBOX' },
            { uidValidity: '2000', lastProcessedUid: 1 },
            { upsert: true },
        );
    });

    test("échec métier sur un UID intermédiaire : le checkpoint n'avance pas au-delà, même si un UID suivant réussit (jamais de perte définitive)", async () => {
        ImapSyncCheckpoint.findOne.mockResolvedValue({ uidValidity: '1000', lastProcessedUid: 112 });
        const client = createClient();
        client.search.mockResolvedValue([113, 114, 115]);
        client.fetchAll.mockResolvedValue([message(113), message(114), message(115)]);
        simpleParser.mockImplementation(async (source) => parsedMessage(Number(source.toString().replace('message-', ''))));
        User.findOne.mockResolvedValue({ _id: 'recipient-id', email: 'inbox@altitudevision.test' });
        InternalMail.findOne.mockResolvedValue(null);
        // 113 réussit, 114 échoue (ex. incident Mongo transitoire), 115 réussit quand même (résilience déjà existante préservée).
        InternalMail.create
            .mockResolvedValueOnce({ _id: 'created-113' })
            .mockRejectedValueOnce(new Error('Mongo temporary failure'))
            .mockResolvedValueOnce({ _id: 'created-115' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 2, skipped: 0, errors: 1 });

        // Le checkpoint reste bloqué à 113 (dernier succès contigu) : 114 ET
        // 115 seront réexaminés au prochain cycle. 115 sera alors détecté
        // comme doublon par `zohoMessageId` (déjà importé), jamais recréé.
        expect(ImapSyncCheckpoint.findOneAndUpdate).toHaveBeenCalledWith(
            { account: 'inbox@altitudevision.test', mailbox: 'INBOX' },
            { uidValidity: '1000', lastProcessedUid: 113 },
            { upsert: true },
        );
    });

    test('UID avec un trou (gap) entre le checkpoint et le prochain message réel : fonctionne normalement', async () => {
        ImapSyncCheckpoint.findOne.mockResolvedValue({ uidValidity: '1000', lastProcessedUid: 100 });
        const client = createClient();
        client.search.mockImplementation(async (criteria) => (criteria.uid === '101:*' ? [105] : []));
        client.fetchAll.mockResolvedValue([message(105)]);
        simpleParser.mockResolvedValue(parsedMessage(105));
        User.findOne.mockResolvedValue({ _id: 'recipient-id', email: 'inbox@altitudevision.test' });
        InternalMail.findOne.mockResolvedValue(null);
        InternalMail.create.mockResolvedValue({ _id: 'created-105' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 1, skipped: 0, errors: 0 });

        expect(ImapSyncCheckpoint.findOneAndUpdate).toHaveBeenCalledWith(
            { account: 'inbox@altitudevision.test', mailbox: 'INBOX' },
            { uidValidity: '1000', lastProcessedUid: 105 },
            { upsert: true },
        );
    });

    test('aucun nouveau message : le checkpoint existant reste inchangé (aucune écriture Mongo inutile)', async () => {
        ImapSyncCheckpoint.findOne.mockResolvedValue({ uidValidity: '1000', lastProcessedUid: 112 });
        const client = createClient();
        client.search.mockResolvedValue([]);
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 0, skipped: 0, errors: 0 });

        expect(ImapSyncCheckpoint.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('mailbox vide au bootstrap : établit quand même un checkpoint de référence (jamais un rescan infini)', async () => {
        ImapSyncCheckpoint.findOne.mockResolvedValue(null);
        const client = createClient();
        client.search.mockResolvedValue([]);
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 0, skipped: 0, errors: 0 });

        expect(ImapSyncCheckpoint.findOneAndUpdate).toHaveBeenCalledWith(
            { account: 'inbox@altitudevision.test', mailbox: 'INBOX' },
            { uidValidity: '1000', lastProcessedUid: 0 },
            { upsert: true },
        );
    });

    test('échec de persistance du checkpoint : compté en erreur, ne bloque pas la fin du cycle (le prochain cycle réexaminera la même plage)', async () => {
        ImapSyncCheckpoint.findOne.mockResolvedValue({ uidValidity: '1000', lastProcessedUid: 112 });
        ImapSyncCheckpoint.findOneAndUpdate.mockRejectedValue(new Error('Mongo unavailable'));
        const client = createClient();
        prepareTwoMessages(client, [message(113)]);
        InternalMail.findOne.mockResolvedValue(null);
        InternalMail.create.mockResolvedValue({ _id: 'created' });
        ImapFlow.mockImplementation(() => client);

        await expect(pollZohoInbox()).resolves.toEqual({ imported: 1, skipped: 0, errors: 1 });
        expect(client.logout).toHaveBeenCalledTimes(1); // le cycle se termine proprement malgré l'échec de checkpoint
    });
});
