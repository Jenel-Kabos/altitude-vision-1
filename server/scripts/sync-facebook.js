require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

// ============================================================
// ✅ VÉRIFICATION DU TOKEN AU CHARGEMENT
// ============================================================
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

const PAGES_IMMO = [
  { name: "Altitude Vision", id: "267164619819268" },
];

// ============================================================
// 🧩 SCHÉMA MONGOOSE
// ============================================================
const facebookPostSchema = new mongoose.Schema({
  facebook_id: { type: String, unique: true },
  page_name: String,
  page_id: String,
  message: String,
  image: String,
  permalink: String,
  date_publication: Date,
  date_sync: Date
});

const FacebookPost =
  mongoose.models.FacebookPost ||
  mongoose.model('FacebookPost', facebookPostSchema);

// ============================================================
// 📡 RÉCUPÉRATION DES POSTS FACEBOOK
// ============================================================
async function recupererPosts(pageId) {
  const url = `https://graph.facebook.com/v25.0/${pageId}/posts`;

  try {
    const response = await axios.get(url, {
      params: {
        access_token: ACCESS_TOKEN,
        fields: 'message,full_picture,created_time,permalink_url',
        limit: 10,
      },
      timeout: 10000, // 10 secondes max
    });

    return response.data.data || [];

  } catch (error) {
    // 🔍 Récupère le vrai message d'erreur de l'API Facebook
    const fbError = error.response?.data?.error;

    if (fbError) {
      // Erreurs courantes Facebook :
      // code 190 = token invalide ou expiré
      // code 200 = permissions insuffisantes
      // code 4   = quota dépassé
      const msg = `Facebook API Error [code ${fbError.code}] : ${fbError.message}`;
      console.error(`❌ ${msg}`);
      throw new Error(msg);
    }

    if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout : Facebook API n\'a pas répondu dans les 10 secondes.');
    }

    throw new Error(`Erreur réseau : ${error.message}`);
  }
}

// ============================================================
// 🔄 SYNCHRONISATION PRINCIPALE
// ============================================================
async function syncFacebook() {
  // 🔒 Vérification du token avant tout appel
  if (!ACCESS_TOKEN) {
    throw new Error(
      'FACEBOOK_ACCESS_TOKEN manquant dans les variables d\'environnement. ' +
      'Ajoutez-le dans Render → Environment.'
    );
  }

  const resultats = [];

  for (const page of PAGES_IMMO) {
    console.log(`\n🔄 Synchronisation de : ${page.name} (ID: ${page.id})`);

    let posts;
    try {
      posts = await recupererPosts(page.id);
    } catch (error) {
      // On log l'erreur mais on ne bloque pas les autres pages
      console.error(`❌ Échec pour la page ${page.name} : ${error.message}`);
      resultats.push({ page: page.name, success: false, error: error.message });
      continue;
    }

    if (!posts.length) {
      console.warn(`⚠️ Aucun post trouvé pour ${page.name}`);
      resultats.push({ page: page.name, success: true, count: 0 });
      continue;
    }

    let synced = 0;
    for (const post of posts) {
      try {
        await FacebookPost.findOneAndUpdate(
          { facebook_id: post.id },
          {
            facebook_id: post.id,
            page_name: page.name,
            page_id: page.id,
            message: post.message || '',
            image: post.full_picture || '',
            permalink: post.permalink_url || '',
            date_publication: new Date(post.created_time),
            date_sync: new Date(),
          },
          { upsert: true, new: true }
        );
        synced++;
      } catch (dbError) {
        console.error(`❌ Erreur DB pour le post ${post.id} : ${dbError.message}`);
      }
    }

    console.log(`✅ ${synced}/${posts.length} posts synchronisés pour ${page.name}`);
    resultats.push({ page: page.name, success: true, count: synced });
  }

  console.log('\n✅ Synchronisation terminée !');
  return resultats;
}

module.exports = { syncFacebook };