// server/test-poll.js
// Lance avec : node test-poll.js
require('dotenv').config();
const mongoose     = require('mongoose');
const { pollZohoInbox } = require('./services/zohoImapService');

(async () => {
    try {
        console.log('🔌 Connexion MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connecté');

        const stats = await pollZohoInbox();
        console.log('\n📊 Résultat final:', stats);

    } catch (err) {
        console.error('❌ Erreur:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 MongoDB déconnecté');
        process.exit(0);
    }
})();