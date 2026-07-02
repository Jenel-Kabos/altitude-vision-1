// server/controllers/userController.js
const User       = require('../models/User');
const sendEmail  = require('../utils/email');
const { destroyFromCloudinary, uploadToCloudinary } = require('../config/cloudinary');
const { logAction, buildAuteur } = require('../services/actionLogService');

// ── Email de notification de changement de rôle ──────────────
const ROLE_LABELS = {
    Admin: 'Administrateur', Collaborateur: 'Collaborateur',
    User: 'Utilisateur', Client: 'Client',
    Proprietaire: 'Propriétaire', Prestataire: 'Prestataire',
};

const getRoleChangeEmailHTML = (nomComplet, ancienLabel, nouveauLabel, adminName, normalized) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;font-size:24px;">Altitude Vision</h1>
    <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Dashboard — Mise à jour de votre rôle</p>
  </div>
  <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <h2 style="color:#1f2937;">Bonjour ${nomComplet} 👋</h2>
    <p style="color:#6b7280;line-height:1.6;">Votre rôle sur le dashboard Altitude Vision a été modifié.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:10px 0;color:#6b7280;width:40%;">Ancien rôle :</td>
        <td style="padding:10px 0;color:#374151;">${ancienLabel}</td>
      </tr>
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:10px 0;color:#6b7280;">Nouveau rôle :</td>
        <td style="padding:10px 0;"><strong style="color:#1f2937;">${nouveauLabel}</strong></td>
      </tr>
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:10px 0;color:#6b7280;">Modifié par :</td>
        <td style="padding:10px 0;color:#374151;">${adminName}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6b7280;">Date :</td>
        <td style="padding:10px 0;color:#374151;">${new Date().toLocaleDateString('fr-FR')}</td>
      </tr>
    </table>
    ${normalized === 'Collaborateur' ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="color:#1d4ed8;margin:0;line-height:1.6;">
        En tant que <strong>Collaborateur</strong>, vous pouvez désormais vous connecter au dashboard et ajouter du contenu.<br><br>
        🔗 <a href="https://altitudevision.agency/dashboard" style="color:#2563eb;">altitudevision.agency/dashboard</a>
      </p>
    </div>` : ''}
    ${normalized === 'Admin' ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="color:#991b1b;margin:0;line-height:1.6;">
        En tant qu'<strong>Administrateur</strong>, vous avez maintenant accès complet au dashboard.<br><br>
        🔗 <a href="https://altitudevision.agency/dashboard" style="color:#2563eb;">altitudevision.agency/dashboard</a>
      </p>
    </div>` : ''}
    <p style="color:#6b7280;font-size:13px;line-height:1.6;">
      Si vous n'êtes pas à l'origine de cette demande, contactez immédiatement l'administrateur.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="color:#9ca3af;font-size:12px;">
      Cordialement,<br>
      <strong>Altitude Vision</strong><br>
      contact@altitudevision.agency — +242 06 800 21 51
    </p>
  </div>
</div>`;

// ── Email de bienvenue ────────────────────────────────────────
const getWelcomeEmailHTML = (prenom, roleLabel, email, password) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;font-size:24px;">Altitude Vision</h1>
    <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Dashboard — Accès collaborateur</p>
  </div>
  <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <h2 style="color:#1f2937;">Bonjour ${prenom} 👋</h2>
    <p style="color:#6b7280;line-height:1.6;">
      Un compte <strong>${roleLabel}</strong> a été créé pour vous sur le dashboard Altitude Vision.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#374151;font-weight:bold;">Vos identifiants :</p>
      <p style="margin:4px 0;color:#6b7280;">Email : <strong style="color:#1f2937;">${email}</strong></p>
      <p style="margin:4px 0;color:#6b7280;">Mot de passe : <strong style="color:#1f2937;">${password}</strong></p>
      <p style="margin:4px 0;color:#6b7280;">Accès : <a href="https://altitudevision.agency/dashboard" style="color:#2563eb;">altitudevision.agency/dashboard</a></p>
    </div>
    <p style="color:#ef4444;font-size:13px;">⚠️ Nous vous recommandons de changer votre mot de passe à la première connexion.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="color:#9ca3af;font-size:12px;text-align:center;">Cordialement, <strong>Altitude Vision</strong></p>
  </div>
</div>`;

// ======================================================
// 🧭 UTILITAIRE : Récupère l'ID de l'utilisateur connecté
// ======================================================
exports.getMe = (req, res, next) => {
    req.params.id = req.user.id;
    next();
};

// ======================================================
// 👑 ADMIN : Récupérer tous les utilisateurs
// ======================================================
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json({ status: 'success', results: users.length, data: { users } });
    } catch (error) {
        console.error('Erreur getAllUsers:', error);
        res.status(500).json({ status: 'error', message: 'Erreur serveur lors de la récupération des utilisateurs.' });
    }
};

// ======================================================
// 👑 ADMIN : Récupérer tous les propriétaires
// ======================================================
exports.getAllOwners = async (req, res) => {
    try {
        const owners = await User.find({ role: 'Proprietaire' }).select('-password');
        res.status(200).json({ status: 'success', results: owners.length, data: { owners } });
    } catch (error) {
        console.error('Erreur getAllOwners:', error);
        res.status(500).json({ status: 'error', message: 'Erreur serveur lors de la récupération des propriétaires.' });
    }
};

// ======================================================
// 🔍 Récupérer un utilisateur par ID (Admin + getMe)
// ======================================================
exports.getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'Aucun utilisateur trouvé avec cet ID.' });
        }
        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        console.error('Erreur getUser:', error);
        res.status(500).json({ status: 'error', message: "Erreur serveur lors de la récupération de l'utilisateur." });
    }
};

// ======================================================
// ✏️ ADMIN : Mettre à jour un utilisateur (name, email, role)
// ======================================================
exports.updateUser = async (req, res) => {
    try {
        const allowedFields = ['name', 'email', 'role'];
        const updates = {};
        Object.keys(req.body).forEach(key => {
            if (allowedFields.includes(key)) updates[key] = req.body[key];
        });

        const user = await User.findByIdAndUpdate(req.params.id, updates, {
            new:           true,
            runValidators: true,
            select:        '-password',
        });

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        }

        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        console.error('Erreur updateUser:', error);
        res.status(500).json({ status: 'error', message: "Erreur serveur lors de la mise à jour de l'utilisateur." });
    }
};

// ======================================================
// ✅ ADMIN : Vérifier un propriétaire (KYC)
// ======================================================
exports.verifyOwner = async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isVerified: true, status: 'Actif' },
            { new: true, select: '-password' }
        );
        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        res.status(200).json({ status: 'success', message: '✅ Propriétaire vérifié avec succès.', data: { user } });
        const { notify } = require('../services/notificationService');
        notify({
            recipient: user._id,
            type:      'account_verified',
            title:     'Compte vérifié ✅',
            body:      'Votre compte propriétaire a été validé. Vous pouvez maintenant publier vos biens.',
            data:      { screen: 'Profil' },
        }).catch(() => {});
    } catch (error) {
        console.error('Erreur verifyOwner:', error);
        next(error);
    }
};

// ======================================================
// ⚠️ ADMIN : Suspendre un utilisateur
// 🔧 Utilise la méthode suspend() du modèle (invalide les sessions)
// ======================================================
exports.suspendUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

        await user.suspend(); // invalide tokenVersion → déconnecte immédiatement

        const updated = await User.findById(req.params.id).select('-password');
        res.status(200).json({ status: 'success', message: '⚠️ Compte suspendu avec succès.', data: { user: updated } });
        const { notify: _notify1 } = require('../services/notificationService');
        _notify1({
            recipient: updated._id,
            type:      'account_suspended',
            title:     'Compte suspendu',
            body:      'Votre compte a été suspendu. Contactez notre support pour plus d\'informations.',
            data:      { screen: 'Profil' },
        }).catch(() => {});
        logAction({
          action: 'Compte suspendu',
          description: `Compte de ${updated.name} suspendu`,
          module: 'Utilisateurs',
          typeAction: 'MODIFICATION',
          auteur: buildAuteur(req.user),
          cible: { id: String(updated._id), type: 'User', nom: updated.name },
          req,
        });
    } catch (error) {
        console.error('Erreur suspendUser:', error);
        next(error);
    }
};

// ======================================================
// 🔄 ADMIN : Réactiver un utilisateur
// 🔧 Utilise la méthode activate() du modèle
// ======================================================
exports.activateUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

        await user.activate();

        const updated = await User.findById(req.params.id).select('-password');
        res.status(200).json({ status: 'success', message: '✅ Compte réactivé avec succès.', data: { user: updated } });
        const { notify: _notify2 } = require('../services/notificationService');
        _notify2({
            recipient: updated._id,
            type:      'account_verified',
            title:     'Compte réactivé ✅',
            body:      'Votre compte est de nouveau actif. Bienvenue !',
            data:      { screen: 'Profil' },
        }).catch(() => {});
        logAction({
          action: 'Compte réactivé',
          description: `Compte de ${updated.name} réactivé`,
          module: 'Utilisateurs',
          typeAction: 'MODIFICATION',
          auteur: buildAuteur(req.user),
          cible: { id: String(updated._id), type: 'User', nom: updated.name },
          req,
        });
    } catch (error) {
        console.error('Erreur activateUser:', error);
        next(error);
    }
};

// ======================================================
// 🗑️ ADMIN : Supprimer un utilisateur
// 🔧 Supprime aussi la photo Cloudinary
// 🔧 Refuse de supprimer le dernier admin
// ======================================================
exports.deleteUser = async (req, res) => {
    try {
        if (req.params.id === String(req.user._id)) {
            return res.status(403).json({ status: 'fail', message: 'Vous ne pouvez pas supprimer votre propre compte.' });
        }

        const target = await User.findById(req.params.id);
        if (!target) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

        if (target.role === 'Admin') {
            const adminCount = await User.countDocuments({ role: 'Admin' });
            if (adminCount <= 1) {
                return res.status(403).json({ status: 'fail', message: 'Impossible de supprimer le dernier administrateur.' });
            }
        }

        await User.findByIdAndDelete(req.params.id);
        await destroyFromCloudinary(target.photo);

        res.status(204).send();
        logAction({
          action: 'Utilisateur supprimé',
          description: `Compte de ${target.name} (${target.email}) supprimé`,
          module: 'Utilisateurs',
          typeAction: 'SUPPRESSION',
          auteur: buildAuteur(req.user),
          cible: { id: String(target._id), type: 'User', nom: target.name },
          req,
        });
    } catch (error) {
        console.error('Erreur deleteUser:', error);
        res.status(500).json({ status: 'error', message: "Erreur serveur lors de la suppression de l'utilisateur." });
    }
};

// ======================================================
// 🔄 ADMIN : Changer le rôle d'un utilisateur
// ======================================================
exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const ROLE_MAP = { admin:'Admin', collaborateur:'Collaborateur', user:'User', Admin:'Admin', Collaborateur:'Collaborateur', User:'User' };
        const normalized = ROLE_MAP[role];

        if (!normalized) {
            return res.status(400).json({ status: 'fail', message: "Rôle invalide. Valeurs acceptées : Admin, Collaborateur, User." });
        }
        if (String(req.params.id) === String(req.user._id)) {
            return res.status(403).json({ status: 'fail', message: 'Vous ne pouvez pas modifier votre propre rôle.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });

        const ancienRole = user.role;
        user.historiqueRoles.push({ ancienRole, nouveauRole: normalized, changedBy: req.user._id, date: new Date() });
        user.role = normalized;
        await user.save({ validateBeforeSave: false });

        console.log(`✅ Admin ${req.user.name} a changé le rôle de ${user.name} en ${normalized}`);

        // Envoi de l'email de notification — non bloquant
        let emailSent = false;
        try {
            await sendEmail({
                to:      user.email,
                subject: 'Votre rôle a été mis à jour — Altitude Vision Dashboard',
                html:    getRoleChangeEmailHTML(
                    user.name || user.email,
                    ROLE_LABELS[ancienRole]  || ancienRole,
                    ROLE_LABELS[normalized]  || normalized,
                    req.user.name || 'Admin',
                    normalized
                ),
            });
            emailSent = true;
        } catch (emailErr) {
            console.error('❌ Email de notification de rôle non envoyé:', emailErr.message);
        }

        const updated = await User.findById(user._id).select('-password').populate('historiqueRoles.changedBy', 'name');
        res.status(200).json({ status: 'success', emailSent, data: { user: updated } });
        logAction({
          action: 'Rôle utilisateur modifié',
          description: `Rôle de ${user.name} changé de ${ancienRole} vers ${normalized}`,
          module: 'Utilisateurs',
          typeAction: 'CHANGEMENT_RÔLE',
          auteur: buildAuteur(req.user),
          cible: { id: String(user._id), type: 'User', nom: user.name },
          metadata: { ancienneValeur: ancienRole, nouvelleValeur: normalized },
          req,
        });
    } catch (error) {
        console.error('Erreur updateUserRole:', error);
        res.status(500).json({ status: 'error', message: "Erreur lors du changement de rôle." });
    }
};

// ======================================================
// 📄 ADMIN : Renvoyer le contrat d'hébergement par email
// ======================================================
exports.renvoyerContrat = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        if (user.role !== 'Proprietaire') {
            return res.status(400).json({ status: 'fail', message: "Seuls les propriétaires ont un contrat d'hébergement." });
        }

        const { generateContratHebergement } = require('../services/pdfService');
        const { sendEmailWithAttachment }    = require('../services/emailService');

        const pdfBuffer = await generateContratHebergement(user);

        const uploadResult = await uploadToCloudinary(pdfBuffer, {
            folder:        `altitude-vision/contrats/proprietaires/${user._id}`,
            resource_type: 'raw',
            public_id:     `contrat-hebergement-${user._id}-${Date.now()}`,
            format:        'pdf',
        });
        await User.findByIdAndUpdate(user._id, { contratPdfUrl: uploadResult.secure_url });

        const ref      = `CONTRAT-${String(user._id).slice(-8).toUpperCase()}-v1.0`;
        const dateStr  = user.contratAccepteLe
            ? new Date(user.contratAccepteLe).toLocaleDateString('fr-FR')
            : new Date().toLocaleDateString('fr-FR');

        const attachment = {
            filename:    `Contrat-Hebergement-${user.name.replace(/\s+/g, '-')}.pdf`,
            content:     pdfBuffer,
            contentType: 'application/pdf',
        };

        const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#C8872A,#2E7BB5);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;font-size:24px;">Altitude Vision — Altimmo</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Contrat d'hébergement de bien immobilier</p>
  </div>
  <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <h2 style="color:#1f2937;">Bonjour ${user.name} 🏠</h2>
    <p style="color:#6b7280;line-height:1.6;">Suite à votre demande, voici votre contrat d'hébergement en pièce jointe.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#374151;font-weight:bold;">Détails :</p>
      <p style="margin:4px 0;color:#6b7280;">Référence : <strong style="color:#1f2937;">${ref}</strong></p>
      <p style="margin:4px 0;color:#6b7280;">Signé le : <strong style="color:#1f2937;">${dateStr}</strong></p>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="color:#9ca3af;font-size:12px;">Cordialement,<br><strong>Altitude Vision — Altimmo</strong><br>contact@altitudevision.agency</p>
  </div>
</div>`;

        await sendEmailWithAttachment(user.email, '📋 Votre contrat d\'hébergement — Altitude Vision', html, [attachment]);

        res.status(200).json({
            status:  'success',
            message: 'Contrat renvoyé avec succès.',
            contratPdfUrl: uploadResult.secure_url,
        });
    } catch (error) {
        console.error('❌ renvoyerContrat error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// ➕ ADMIN : Créer un utilisateur (Admin ou Collaborateur)
// ======================================================
exports.createByAdmin = async (req, res) => {
    try {
        const { nom, prenom, email, password, role, telephone, sendWelcomeEmail = true } = req.body;

        if (!nom || !prenom || !email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Prénom, nom, email et mot de passe sont requis.' });
        }
        const ROLE_MAP = { admin:'Admin', collaborateur:'Collaborateur', Admin:'Admin', Collaborateur:'Collaborateur' };
        const normalized = ROLE_MAP[role];
        if (!normalized) {
            return res.status(400).json({ status: 'fail', message: 'Rôle invalide. Valeurs acceptées : Admin, Collaborateur.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ status: 'fail', message: 'Le mot de passe doit contenir au moins 8 caractères.' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ status: 'fail', message: 'Un compte avec cet email existe déjà.' });
        }

        const newUser = await User.create({
            name:            `${prenom} ${nom}`,
            email:           email.toLowerCase(),
            password,
            passwordConfirm: password,
            role:            normalized,
            phone:           telephone || undefined,
            isEmailVerified: true,
            status:          'Actif',
            historiqueRoles: [{ ancienRole: 'Nouveau', nouveauRole: normalized, changedBy: req.user._id, note: 'Compte créé par un administrateur' }],
        });

        if (sendWelcomeEmail) {
            try {
                const roleLabel = normalized === 'Admin' ? 'Administrateur' : 'Collaborateur';
                await sendEmail({
                    to:      email,
                    subject: 'Bienvenue sur Altitude Vision Dashboard',
                    html:    getWelcomeEmailHTML(prenom, roleLabel, email, password),
                });
            } catch (emailErr) {
                console.error('❌ Email de bienvenue non envoyé:', emailErr.message);
            }
        }

        const user = await User.findById(newUser._id).select('-password');
        res.status(201).json({ status: 'success', data: { user } });
        logAction({
          action: 'Utilisateur créé',
          description: `Compte ${normalized} créé pour ${prenom} ${nom} (${email})`,
          module: 'Utilisateurs',
          typeAction: 'CRÉATION',
          auteur: buildAuteur(req.user),
          cible: { id: String(newUser._id), type: 'User', nom: `${prenom} ${nom}` },
          req,
        });
    } catch (error) {
        console.error('Erreur createByAdmin:', error);
        res.status(500).json({ status: 'error', message: "Erreur lors de la création du compte." });
    }
};

// ======================================================
// COMPLETE PROFILE (Google OAuth — après inscription)
// PATCH /api/users/complete-profile
// ======================================================
exports.completeProfile = async (req, res) => {
    try {
        const { prenom, nom, telephone, ville, role, certifications } = req.body;

        if (!prenom || !nom || !telephone) {
            return res.status(400).json({ status: 'fail', message: 'Prénom, nom et téléphone requis.' });
        }

        const allowedRoles = ['Client', 'Proprietaire', 'Prestataire'];
        const newRole = allowedRoles.includes(role) ? role : 'Client';

        if (newRole === 'Proprietaire' && (!certifications || !certifications.contratAccepte)) {
            return res.status(400).json({
                status: 'fail',
                message: "Vous devez accepter le contrat d'hébergement.",
            });
        }

        const now = new Date();
        const updates = {
            name:  `${prenom.trim()} ${nom.trim()}`,
            phone: telephone.trim(),
            role:  newRole,
        };

        if (newRole === 'Proprietaire' && certifications) {
            const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
            updates.contratAccepte   = true;
            updates.contratAccepteLe = now;
            updates.contratVersion   = 'v1.0';
            updates.ipInscription    = ip;
            updates.certifications   = {
                informationsVraies:   !!certifications.informationsVraies,
                estProprietaireLegal: !!certifications.estProprietaireLegal,
                engagementHonnetete:  !!certifications.engagementHonnetete,
                commissionAcceptee:   !!certifications.commissionAcceptee,
                dateCertification:    now,
            };
        }

        const updated = await User.findByIdAndUpdate(req.user._id, updates, {
            new: true, runValidators: false, select: '-password',
        });

        res.status(200).json({ status: 'success', data: { user: updated } });
    } catch (error) {
        console.error('❌ Erreur completeProfile:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * @description Enregistrer ou mettre à jour le token Expo Push de l'appareil
 * @route PATCH /api/users/push-token
 * @access Protected
 */
exports.savePushToken = async (req, res) => {
    try {
        const { pushToken } = req.body;
        if (!pushToken) {
            return res.status(400).json({ status: 'fail', message: 'pushToken requis.' });
        }

        await User.findByIdAndUpdate(req.user._id, { pushToken });

        console.log(`✅ [PushToken] Enregistré pour ${req.user._id}`);
        res.status(200).json({ status: 'success', message: 'Push token enregistré.' });
    } catch (error) {
        console.error('❌ Erreur savePushToken:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
