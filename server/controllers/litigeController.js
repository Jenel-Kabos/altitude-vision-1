// server/controllers/litigeController.js
const Litige   = require('../models/Litige');
const User     = require('../models/User');
const sendEmail = require('../utils/email');
const { uploadToCloudinary } = require('../config/cloudinary');

const ADMIN_EMAIL = process.env.ZOHO_FROM_EMAIL || 'contact@altitudevision.agency';

// ── helpers ───────────────────────────────────────────────────
const typeLabel = {
  Information_fausse:  'Information fausse',
  Bien_inexistant:     'Bien inexistant',
  'Prix_non_respecté': 'Prix non respecté',
  Arnaque:             'Arnaque',
  Mauvaise_foi:        'Mauvaise foi',
  'Problème_paiement': 'Problème de paiement',
  Autre:               'Autre',
};

const notifyParties = async ({ litige, subject, htmlFn }) => {
  const emails = [];
  if (litige.plaignant?.email) emails.push(litige.plaignant.email);
  if (litige.accusé?.userId) {
    const u = await User.findById(litige.accusé.userId).select('email');
    if (u?.email) emails.push(u.email);
  }
  await Promise.allSettled(
    emails.map(email => sendEmail({ email, subject, html: htmlFn(email) }))
  );
};

// ======================================================
// 1. CRÉER UN LITIGE  POST /api/litiges
// ======================================================
exports.createLitige = async (req, res) => {
  try {
    const {
      type, description,
      plaignantNom, plaignantEmail, plaignantTelephone, plaignantType,
      accuséUserId, accuséNom, accuséEmail, accuséType,
      bienConcerné,
    } = req.body;

    if (!type || !description || !plaignantNom || !plaignantEmail) {
      return res.status(400).json({ status: 'fail', message: 'Champs obligatoires manquants.' });
    }

    // Référence auto
    const count = await Litige.countDocuments();
    const ref   = `LIT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    // Upload preuves
    const preuves = [];
    if (req.files?.length) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer, {
          folder:    'altitude-vision/litiges',
          public_id: `litige-${ref}-${Date.now()}`,
          resource_type: file.mimetype.startsWith('image/') ? 'image' : 'raw',
        });
        preuves.push({ url: result.secure_url, nom: file.originalname, type: file.mimetype });
      }
    }

    const plaignantId = req.user?._id || undefined;

    const litige = await Litige.create({
      reference:    ref,
      type,
      description,
      bienConcerné: bienConcerné || undefined,
      plaignant: {
        userId:    plaignantId,
        nom:       plaignantNom,
        email:     plaignantEmail,
        telephone: plaignantTelephone || '',
        type:      plaignantType || 'Client',
      },
      accusé: {
        userId: accuséUserId || undefined,
        nom:    accuséNom    || '',
        email:  accuséEmail  || '',
        type:   accuséType   || 'Propriétaire',
      },
      preuves,
      timeline: [{ action: `Litige ouvert par ${plaignantNom}`, auteur: plaignantNom, role: plaignantType || 'Client' }],
    });

    // Emails en arrière-plan
    Promise.allSettled([
      // Admin
      sendEmail({
        email:   ADMIN_EMAIL,
        subject: `⚠️ Nouveau litige #${ref}`,
        message: `Un nouveau litige a été ouvert.\n\nRéférence : ${ref}\nType : ${typeLabel[type] || type}\nPlaignant : ${plaignantNom} (${plaignantEmail})\nDescription : ${description}\n\nVoir : altitudevision.agency/dashboard/litiges`,
      }),
      // Accusé si userId fourni
      ...(accuséUserId
        ? [User.findById(accuséUserId).select('email name').then(u => u && sendEmail({
            email:   u.email,
            subject: `⚠️ Un litige vous concernant — Altitude Vision`,
            message: `Bonjour ${u.name},\n\nUn litige vous concernant a été ouvert.\nRéférence : ${ref}\n\nMerci de nous contacter sous 48 heures à contact@altitudevision.agency ou de vous connecter à votre espace pour répondre.\n\nAltitude Vision`,
          }))]
        : []),
      // Plaignant
      sendEmail({
        email:   plaignantEmail,
        subject: `✅ Votre signalement ${ref} a été enregistré — Altitude Vision`,
        message: `Bonjour ${plaignantNom},\n\nVotre litige a bien été enregistré.\nRéférence : ${ref}\nType : ${typeLabel[type] || type}\n\nNous vous répondrons sous 48 heures ouvrables.\n\nAltitude Vision\ncontact@altitudevision.agency`,
      }),
    ]);

    res.status(201).json({ status: 'success', data: { litige: { _id: litige._id, reference: ref } } });
  } catch (err) {
    console.error('❌ [Litige] createLitige:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 2. LISTE  GET /api/litiges
// ======================================================
exports.getLitiges = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'Admin';
    const { statut, priorité, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (!isAdmin) {
      filter.$or = [
        { 'plaignant.userId': req.user._id },
        { 'accusé.userId':    req.user._id },
      ];
    }
    if (statut)   filter.statut   = statut;
    if (priorité) filter.priorité = priorité;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Litige.countDocuments(filter);
    const items = await Litige.find(filter)
      .sort({ dateOuverture: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('bienConcerné', 'title');

    res.json({ status: 'success', results: total, data: { litiges: items } });
  } catch (err) {
    console.error('❌ [Litige] getLitiges:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 3. STATS  GET /api/litiges/stats
// ======================================================
exports.getStats = async (req, res) => {
  try {
    const [byStatut, byType, byPriorité] = await Promise.all([
      Litige.aggregate([{ $group: { _id: '$statut',   count: { $sum: 1 } } }]),
      Litige.aggregate([{ $group: { _id: '$type',     count: { $sum: 1 } } }]),
      Litige.aggregate([{ $group: { _id: '$priorité', count: { $sum: 1 } } }]),
    ]);
    const toMap = arr => arr.reduce((acc, v) => { acc[v._id] = v.count; return acc; }, {});
    res.json({ status: 'success', data: { byStatut: toMap(byStatut), byType: toMap(byType), byPriorité: toMap(byPriorité) } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 4. DÉTAIL  GET /api/litiges/:id
// ======================================================
exports.getLitige = async (req, res) => {
  try {
    const litige = await Litige.findById(req.params.id).populate('bienConcerné', 'title images');
    if (!litige) return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });

    const isAdmin = req.user?.role === 'Admin';
    const isPart  = litige.plaignant?.userId?.equals(req.user._id) || litige.accusé?.userId?.equals(req.user._id);
    if (!isAdmin && !isPart) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });

    res.json({ status: 'success', data: { litige } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 5. CHANGER STATUT  PUT /api/litiges/:id/statut
// ======================================================
exports.updateStatut = async (req, res) => {
  try {
    const { statut, note } = req.body;
    if (!statut) return res.status(400).json({ status: 'fail', message: 'Statut requis.' });

    const litige = await Litige.findByIdAndUpdate(
      req.params.id,
      {
        statut,
        dateDerniereMaj: new Date(),
        $push: {
          timeline: {
            action: `Statut changé → ${statut}`,
            auteur: req.user.name,
            role:   'Admin',
            note:   note || '',
          },
        },
      },
      { new: true }
    );
    if (!litige) return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });

    // Notifier les parties
    const html = () => `<p>Bonjour,<br><br>Le statut de votre litige <strong>${litige.reference}</strong> a été mis à jour : <strong>${statut}</strong>${note ? `<br>Note : ${note}` : ''}.<br><br>Altitude Vision</p>`;
    await notifyParties({ litige, subject: `Mise à jour litige ${litige.reference}`, htmlFn: html });

    res.json({ status: 'success', data: { litige } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 6. AJOUTER MESSAGE  POST /api/litiges/:id/message
// ======================================================
exports.addMessage = async (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ status: 'fail', message: 'Message requis.' });

    const litige = await Litige.findById(req.params.id);
    if (!litige) return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });

    const isAdmin = req.user?.role === 'Admin';
    const isPart  = litige.plaignant?.userId?.equals(req.user._id) || litige.accusé?.userId?.equals(req.user._id);
    if (!isAdmin && !isPart) return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });

    litige.timeline.push({ action: 'Message ajouté', auteur: req.user.name, role: req.user.role, note });
    litige.dateDerniereMaj = new Date();
    await litige.save();

    res.json({ status: 'success', data: { litige } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================
// 7. RÉSOUDRE  POST /api/litiges/:id/resolution
// ======================================================
exports.resolverLitige = async (req, res) => {
  try {
    const { decision } = req.body;
    if (!decision) return res.status(400).json({ status: 'fail', message: 'Décision requise.' });

    const litige = await Litige.findByIdAndUpdate(
      req.params.id,
      {
        statut:          'Résolu',
        dateDerniereMaj: new Date(),
        resolution: { decision, dateResolution: new Date(), resolvedBy: req.user._id },
        $push: {
          timeline: {
            action: 'Litige résolu',
            auteur: req.user.name,
            role:   'Admin',
            note:   decision,
          },
        },
      },
      { new: true }
    );
    if (!litige) return res.status(404).json({ status: 'fail', message: 'Litige introuvable.' });

    const html = () => `<p>Bonjour,<br><br>Le litige <strong>${litige.reference}</strong> a été clôturé.<br><br><strong>Décision :</strong> ${decision}<br><br>Altitude Vision</p>`;
    await notifyParties({ litige, subject: `Litige ${litige.reference} résolu`, htmlFn: html });

    res.json({ status: 'success', data: { litige } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
