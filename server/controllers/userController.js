// server/controllers/userController.js
const User       = require('../models/User');
const sendEmail  = require('../utils/email');
const { destroyFromCloudinary, uploadToCloudinary } = require('../config/cloudinary');
const { logAction, buildAuteur } = require('../services/actionLogService');
const { COLLAB_ROLES, ROLE_LABELS } = require('../utils/roles');
const userKpiService = require('../services/userKpiService'); // USER-KPI-1
const { uploadPrivateAsset, readPrivateAsset } = require('../services/storage/secureStorageService');
const { assertResourceTenant } = require('../services/platformTenant/tenantResourceAttributionService');
const { getOperatorByUserId } = require('../services/platformOperator/platformOperatorService');
const PlatformTenant = require('../models/PlatformTenant');
const OrgMembership = require('../models/OrgMembership');
const PlatformOperator = require('../models/PlatformOperator');

// HOTFIX-USERS-COUNT-1 — `req.tenantScopeUserIds` (posé par
// `requireTenantScope`) ne contient que les membres `OrgMembership` du
// tenant, alimentés UNIQUEMENT par le flux d'invitation staff.
// `authController.signup` (inscription publique : Client, Proprietaire,
// User…) n'en crée jamais aucun (audit exhaustif, zéro occurrence) — ces
// comptes restaient donc invisibles ici bien qu'appartenant sans ambiguïté
// au tenant unique existant.
//
// Intentionnellement LOCAL à ce contrôleur (jamais dans
// `resolveTenantScope`, la couche partagée par le catalogue public de
// biens/hôtels et le reporting) : une tentative précédente d'appliquer
// cette même extension au niveau partagé a fait fuiter des propriétaires
// non affiliés dans le catalogue public tenant-scopé
// (`tenantCore.mongo.integration.test.js`, 6 régressions constatées) —
// l'extension n'est sûre que pour la liste d'utilisateurs elle-même, jamais
// pour des ressources métier tierces qu'un compte non affilié pourrait
// posséder.
//
// Strictement bornée au cas sans ambiguïté (`tenantCount === 1`) : dès
// qu'un second `PlatformTenant` existe, aucune supposition n'est jamais
// faite (retour au scope `OrgMembership` strict).
async function expandScopeWithUnaffiliatedUsersIfSoleTenant(scopeUserIds) {
    const ids = new Set((scopeUserIds || []).map(String));
    const tenantCount = await PlatformTenant.countDocuments({ status: { $in: ['trial', 'active'] } });
    if (tenantCount !== 1) return [...ids];
    const [membershipUserIds, operatorUserIds] = await Promise.all([
        OrgMembership.distinct('user'),
        PlatformOperator.distinct('user'),
    ]);
    const excluded = new Set([...membershipUserIds, ...operatorUserIds].map(String));
    const unaffiliated = await User.find({
        isTechnical: { $ne: true },
        isActive: { $ne: false },
        status: { $nin: ['Suspendu', 'Banni', 'Supprimé'] },
        _id: { $nin: [...excluded] },
    }).select('_id').lean();
    unaffiliated.forEach((u) => ids.add(String(u._id)));
    return [...ids];
}

exports.downloadContractDocument = async (req, res) => {
    try {
        const requestedId = req.params.id || req.user.id;
        if (String(requestedId) !== String(req.user.id) && req.user.role !== 'Admin') {
            return res.status(403).json({ status: 'fail', message: 'Accès refusé.' });
        }
        const user = await User.findById(requestedId).select('+contratPdfAsset');
        if (!user) return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        if (String(requestedId) !== String(req.user.id)) await assertResourceTenant({ resourceType: 'User', resource: user, tenantId: req.platformTenant?._id });
        if (!user.contratPdfAsset) return res.status(409).json({ status: 'fail', code: 'LEGACY_ASSET_MIGRATION_REQUIRED', message: 'Ce contrat historique doit être migré.' });
        const buffer = await readPrivateAsset(user.contratPdfAsset.toObject());
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${req.query.download === '0' ? 'inline' : 'attachment'}; filename="contract.pdf"`);
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(buffer);
    } catch (error) { return res.status(502).json({ status: 'error', message: 'Impossible de récupérer le contrat.' }); }
};

// ── Email de notification de changement de rôle ──────────────

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
        // PLATFORM-ADMIN-CERT-1 (V1) — `req.tenantScopeUserIds` (posé par
        // `requireTenantScope`, monté sur ce routeur) borne la liste aux
        // utilisateurs réellement membres du tenant actif. Un PlatformOperator
        // sans capacité tenant sélectionnée n'atteint jamais ce contrôleur
        // (403 en amont) — jamais de `User.find()` global implicite.
        const scopeUserIds = await expandScopeWithUnaffiliatedUsersIfSoleTenant(req.tenantScopeUserIds || []).catch(() => req.tenantScopeUserIds || []);
        const users = await User.find({ _id: { $in: scopeUserIds } }).select('-password');
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
        // USER-KPI-1 — remplace l'ancien `role:'Proprietaire'` (voir
        // server/routes/dashboardRoutes.js pour la justification de la règle
        // d'union propriétaire immobilier + exploitant d'établissement).
        const ownerIds = await userKpiService.getProprietaireUserIds();
        // PLATFORM-ADMIN-CERT-1 (V1) — intersection avec le scope tenant actif,
        // même principe que getAllUsers ci-dessus (HOTFIX-USERS-COUNT-1 :
        // scope étendu localement, voir expandScopeWithUnaffiliatedUsersIfSoleTenant).
        const expandedScope = await expandScopeWithUnaffiliatedUsersIfSoleTenant(req.tenantScopeUserIds || []).catch(() => req.tenantScopeUserIds || []);
        const scopeSet = new Set(expandedScope.map(String));
        const scopedOwnerIds = ownerIds.filter((id) => scopeSet.has(String(id)));
        const owners = await User.find({ _id: { $in: scopedOwnerIds } }).select('-password');
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
        const payload = { user };
        // PLATFORM-ADMIN-1 — n'expose le statut opérateur QUE sur /me (jamais
        // en consultant un autre utilisateur au passage) : évite une requête
        // supplémentaire systématique sur getAllUsers/getOwner/etc., et évite
        // de révéler à un Tenant Admin qui d'autre est opérateur via cette
        // route générique (la liste complète reste réservée à
        // platform-operators, elle-même gated par `platform.operators.manage`).
        const requesterId = String(req.user?._id || req.user?.id || '');
        if (requesterId && requesterId === String(user._id)) {
            payload.platformOperator = await getOperatorByUserId(user._id).catch(() => null);
        }
        res.status(200).json({ status: 'success', data: payload });
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
        const ALL_ASSIGNABLE = ['Admin', 'User', 'Client', 'Proprietaire', 'Prestataire', ...COLLAB_ROLES];
        const normalized = ALL_ASSIGNABLE.find(r => r.toLowerCase() === String(role).toLowerCase()) || null;
        if (!normalized) {
            return res.status(400).json({ status: 'fail', message: `Rôle invalide. Valeurs acceptées : ${ALL_ASSIGNABLE.join(', ')}.` });
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

        const contractAsset = await uploadPrivateAsset(pdfBuffer, {
            purpose: 'administrative', ownerType: 'User', ownerId: user._id,
            filename: `contrat-hebergement-${user._id}-${Date.now()}.pdf`, mimeType: 'application/pdf',
        });
        await User.findByIdAndUpdate(user._id, { $set: { contratPdfAsset: contractAsset }, $unset: { contratPdfUrl: 1 } });

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
            documentAccess: { canDownload: true, downloadEndpoint: `/api/users/${user._id}/contract-document` },
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
        const ADMIN_CREATABLE = ['Admin', ...COLLAB_ROLES];
        const normalized = ADMIN_CREATABLE.find(r => r.toLowerCase() === String(role).toLowerCase()) || null;
        if (!normalized) {
            return res.status(400).json({ status: 'fail', message: `Rôle invalide. Valeurs acceptées : ${ADMIN_CREATABLE.join(', ')}.` });
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
                const roleLabel = ROLE_LABELS[normalized] || normalized;
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
// Regex Congo : accepte +242XXXXXXXXX ou 00242XXXXXXXXX ou 0XXXXXXXXX
// ou XXXXXXXXX (9 chiffres) — format Airtel/MTN Congo
const PHONE_REGEX = /^(\+242|00242|0)?[0-9]{9}$/;

exports.completeProfile = async (req, res) => {
    try {
        const { prenom, nom, telephone, ville, role, certifications } = req.body;
        const telClean = telephone?.trim().replace(/\s/g, '');

        if (!prenom || !nom) {
            return res.status(400).json({ status: 'fail', message: 'Prénom et nom requis.' });
        }
        if (!telClean) {
            return res.status(400).json({ status: 'fail', message: 'Téléphone requis.' });
        }
        if (!PHONE_REGEX.test(telClean)) {
            return res.status(400).json({
                status: 'fail',
                message: 'Format téléphone invalide. Exemple: +242066000000',
            });
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
            phone: telClean,
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
