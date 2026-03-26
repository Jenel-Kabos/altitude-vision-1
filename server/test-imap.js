// server/test-imap.js
// Lance avec : node test-imap.js
require('dotenv').config();
const { ImapFlow } = require('imapflow');

const client = new ImapFlow({
    host:   'imap.zoho.com',
    port:   993,
    secure: true,
    auth: {
        user: process.env.ZOHO_FROM_EMAIL,
        pass: process.env.ZOHO_IMAP_PASSWORD,
    },
    logger: false,
});

(async () => {
    try {
        console.log('🔌 Tentative de connexion à imap.zoho.com...');
        console.log('   User:', process.env.ZOHO_FROM_EMAIL);
        console.log('   Pass:', process.env.ZOHO_IMAP_PASSWORD ? '✅ défini' : '❌ manquant');

        await client.connect();
        console.log('✅ Connexion IMAP réussie !');

        const lock = await client.getMailboxLock('INBOX');
        try {
            const status = await client.status('INBOX', { messages: true, unseen: true });
            console.log(`📬 INBOX : ${status.messages} message(s) total, ${status.unseen} non lu(s)`);
        } finally {
            lock.release();
        }

        await client.logout();
        console.log('✅ Test terminé avec succès.');
    } catch (err) {
        console.error('❌ Erreur:', err.message);
        if (err.responseCode) console.error('   Code:', err.responseCode);
        if (err.response)     console.error('   Réponse serveur:', err.response);
    }
})();