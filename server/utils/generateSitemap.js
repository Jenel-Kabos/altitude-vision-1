// server/utils/generateSitemap.js
// Lance avec: node server/utils/generateSitemap.js
// Ou intègre dans une route: GET /sitemap.xml

const fs   = require('fs');
const path = require('path');

const SITE_URL = 'https://altitudevision.agency';

// Pages statiques
const STATIC_PAGES = [
  { loc: '/',             changefreq: 'daily',   priority: '1.0' },
  { loc: '/altimmo',      changefreq: 'daily',   priority: '0.9' },
  { loc: '/mila-events',  changefreq: 'daily',   priority: '0.9' },
  { loc: '/altcom',       changefreq: 'weekly',  priority: '0.8' },
  { loc: '/contact',      changefreq: 'monthly', priority: '0.6' },
  { loc: '/actualites',   changefreq: 'daily',   priority: '0.7' },
  { loc: '/register',     changefreq: 'monthly', priority: '0.4' },
];

const toDate = (d) => new Date(d).toISOString().split('T')[0];

const buildUrl = ({ loc, lastmod, changefreq, priority }) => `
  <url>
    <loc>${SITE_URL}${loc}</loc>
    ${lastmod    ? `<lastmod>${lastmod}</lastmod>`         : ''}
    ${changefreq ? `<changefreq>${changefreq}</changefreq>` : ''}
    ${priority   ? `<priority>${priority}</priority>`       : ''}
  </url>`;

/**
 * Génère le sitemap.xml et l'écrit dans /public/sitemap.xml
 * Appelé au démarrage du serveur ou via une route cron.
 */
const generateSitemap = async () => {
  try {
    const Property    = require('../models/Property');
    const Event       = require('../models/Event');
    const PortfolioItem = require('../models/PortfolioItem');

    // Récupérer les IDs dynamiques
    const [properties, events, portfolioItems] = await Promise.all([
      Property.find({ statusAdmin: 'Validée' }, '_id updatedAt title').lean(),
      Event.find({}, '_id updatedAt title').lean(),
      PortfolioItem.find({ isPublished: true }, '_id updatedAt title').lean(),
    ]);

    const dynamicUrls = [
      ...properties.map(p => ({
        loc:        `/properties/${p._id}`,
        lastmod:    toDate(p.updatedAt),
        changefreq: 'weekly',
        priority:   '0.8',
      })),
      ...events.map(e => ({
        loc:        `/mila-events/${e._id}`,
        lastmod:    toDate(e.updatedAt),
        changefreq: 'weekly',
        priority:   '0.7',
      })),
      ...portfolioItems.map(p => ({
        loc:        `/altcom/portfolio/${p._id}`,
        lastmod:    toDate(p.updatedAt),
        changefreq: 'monthly',
        priority:   '0.6',
      })),
    ];

    const allUrls = [...STATIC_PAGES, ...dynamicUrls];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${allUrls.map(buildUrl).join('')}
</urlset>`;

    // Écrire dans /public (servi statiquement)
    const outPath = path.join(__dirname, '../../public/sitemap.xml');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, sitemap.trim(), 'utf8');

    console.log(`✅ [Sitemap] Généré: ${allUrls.length} URLs → public/sitemap.xml`);
    return sitemap;

  } catch (error) {
    console.error('❌ [Sitemap] Erreur:', error.message);
    // Fallback: sitemap statique uniquement
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC_PAGES.map(buildUrl).join('')}
</urlset>`;
    return sitemap;
  }
};

// ─── Route Express (à ajouter dans server.js) ────────────────
// app.get('/sitemap.xml', async (req, res) => {
//   const xml = await generateSitemap();
//   res.header('Content-Type', 'application/xml');
//   res.header('Cache-Control', 'public, max-age=3600'); // cache 1h
//   res.send(xml);
// });

// ─── Génération au démarrage (à ajouter dans server.js) ──────
// require('./utils/generateSitemap')();

module.exports = generateSitemap;

// Exécution directe: node server/utils/generateSitemap.js
if (require.main === module) {
  // Connexion MongoDB nécessaire
  const mongoose = require('mongoose');
  require('dotenv').config();
  mongoose.connect(process.env.MONGO_URI)
    .then(() => generateSitemap())
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}