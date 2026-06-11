// server/controllers/authController.js
const crypto    = require('crypto');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { promisify } = require('util');
const User      = require('../models/User');
const sendEmail = require('../utils/email');
const { uploadToCloudinary, destroyFromCloudinary } = require('../config/cloudinary');

// ======================================================
// 🔑 UTILITAIRES JWT
// ======================================================
const signToken = (id, tokenVersion) =>
    jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '90d',
    });

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id, user.tokenVersion);
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user: {
                _id:             user._id,
                name:            user.name,
                email:           user.email,
                role:            user.role,
                phone:           user.phone  || null,
                photo:           user.photo  || null,
                isEmailVerified: user.isEmailVerified,
            },
        },
    });
};

// ======================================================
// 1. INSCRIPTION
// ======================================================
exports.signup = async (req, res) => {
    try {
        const { name, email, password, passwordConfirm, role, phone, contratAccepte, certifications } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Champs manquants.' });
        }

        // Vérification contrat obligatoire pour Proprietaire
        if (role === 'Proprietaire' && !contratAccepte) {
            return res.status(400).json({
                status:  'fail',
                message: "Vous devez accepter le contrat d'hébergement pour vous inscrire en tant que Propriétaire.",
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ status: 'fail', message: 'Adresse email déjà utilisée.' });
        }

        // Photo de profil à l'inscription si envoyée
        let photoUrl;
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, {
                folder:    'altitude-vision/users',
                public_id: `user-signup-${Date.now()}`,
                overwrite: true,
            });
            photoUrl = result.secure_url;
        }

        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip;
        const now = new Date();

        const userData = {
            name,
            email,
            password,
            passwordConfirm,
            role:  role  || 'Client',
            phone: phone || '',
            photo: photoUrl || undefined,
        };

        if (role === 'Proprietaire' && contratAccepte) {
            userData.contratAccepte   = true;
            userData.contratAccepteLe = now;
            userData.contratVersion   = 'v1.0';
            userData.ipInscription    = ip;
            userData.certifications   = {
                informationsVraies:   true,
                estProprietaireLegal: true,
                engagementHonnetete:  true,
                commissionAcceptee:   true,
                dateCertification:    now,
            };
        }

        const newUser = await User.create(userData);

        const verificationToken = newUser.createEmailVerificationToken();
        await newUser.save({ validateBeforeSave: false });

        const verifyURL = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

        // PDF + email contrat pour Propriétaire (fire & forget)
        if (role === 'Proprietaire' && contratAccepte) {
            const userId   = newUser._id;
            const userName = newUser.name;
            const userEmail = newUser.email;
            const ref = `CONTRAT-${String(userId).slice(-8).toUpperCase()}-v1.0`;
            const dateStr = now.toLocaleDateString('fr-FR');
            const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            (async () => {
                try {
                    const { generateContratHebergement } = require('../services/pdfService');
                    const { sendEmailWithAttachment }    = require('../services/emailService');

                    const pdfBuffer = await generateContratHebergement(newUser);

                    // Upload vers Cloudinary
                    const uploadResult = await uploadToCloudinary(pdfBuffer, {
                        folder:        `altitude-vision/contrats/proprietaires/${userId}`,
                        resource_type: 'raw',
                        public_id:     `contrat-hebergement-${userId}`,
                        format:        'pdf',
                    });
                    await User.findByIdAndUpdate(userId, { contratPdfUrl: uploadResult.secure_url });

                    const attachment = {
                        filename:    `Contrat-Hebergement-${userName.replace(/\s+/g, '-')}.pdf`,
                        content:     pdfBuffer,
                        contentType: 'application/pdf',
                    };

                    const htmlProprio = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#C8872A,#2E7BB5);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;font-size:24px;">Altitude Vision — Altimmo</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Contrat d'hébergement de bien immobilier</p>
  </div>
  <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <h2 style="color:#1f2937;">Bonjour ${userName} 🏠</h2>
    <p style="color:#6b7280;line-height:1.6;">
      Votre inscription en tant que <strong>Propriétaire / Apporteur d'affaires</strong> sur Altitude Vision est confirmée.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#374151;font-weight:bold;">Détails de votre contrat :</p>
      <p style="margin:4px 0;color:#6b7280;">Référence : <strong style="color:#1f2937;">${ref}</strong></p>
      <p style="margin:4px 0;color:#6b7280;">Signé le : <strong style="color:#1f2937;">${dateStr} à ${timeStr}</strong></p>
      <p style="margin:4px 0;color:#6b7280;">Version : <strong style="color:#1f2937;">v1.0</strong></p>
    </div>
    <p style="color:#6b7280;line-height:1.6;">Votre contrat d'hébergement est joint à cet email en pièce jointe PDF.</p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="color:#92400e;margin:0;line-height:1.8;font-size:14px;">
        <strong>Conditions de rémunération :</strong><br>
        • Commission locataire (80 % du premier loyer) versée à Altitude Vision<br>
        • Votre part : 30 % de cette commission (soit ~24 % du loyer)<br>
        • Exemple : loyer 150 000 FCFA → Votre gain : <strong>36 000 FCFA</strong>
      </p>
    </div>
    <p style="color:#6b7280;line-height:1.6;">
      Vous pouvez maintenant publier vos biens sur
      <a href="https://altitudevision.agency/altimmo" style="color:#2563eb;">altitudevision.agency/altimmo</a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="color:#9ca3af;font-size:12px;">Cordialement,<br><strong>Altitude Vision — Altimmo</strong><br>contact@altitudevision.agency — +242 06 800 21 51</p>
  </div>
</div>`;

                    const htmlAdmin = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1e293b;padding:20px;border-radius:12px 12px 0 0;">
    <h2 style="color:white;margin:0;font-size:18px;">🏠 Nouveau propriétaire inscrit</h2>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
    <p style="margin:4px 0;color:#374151;"><strong>Nom :</strong> ${userName}</p>
    <p style="margin:4px 0;color:#374151;"><strong>Email :</strong> ${userEmail}</p>
    <p style="margin:4px 0;color:#374151;"><strong>Référence contrat :</strong> ${ref}</p>
    <p style="margin:4px 0;color:#374151;"><strong>Signé le :</strong> ${dateStr} à ${timeStr}</p>
    <p style="margin:12px 0 4px;color:#6b7280;font-size:13px;">Le contrat signé est joint en pièce jointe.</p>
  </div>
</div>`;

                    const adminEmail = process.env.ZOHO_FROM_EMAIL || 'contact@altitudevision.agency';
                    await sendEmailWithAttachment(userEmail,   '✅ Votre contrat d\'hébergement — Altitude Vision', htmlProprio, [attachment]);
                    await sendEmailWithAttachment(adminEmail,  `🏠 Nouveau propriétaire : ${userName}`,             htmlAdmin,   [attachment]);

                    console.log(`✅ [Auth] Contrat PDF envoyé à ${userEmail}`);
                } catch (pdfErr) {
                    console.error('❌ [Auth] Erreur génération/envoi contrat PDF:', pdfErr.message);
                }
            })();
        }

        try {
            await sendEmail({
                email:     newUser.email,
                subject:   '✅ Altitude Vision — Activez votre compte',
                type:      'verification',
                name:      newUser.name,
                verifyURL,
                message:   `Bonjour ${newUser.name},\n\nActivez votre compte ici : ${verifyURL}\n\nCe lien expire dans 24h.`,
            });

            res.status(200).json({
                status:  'success',
                message: "Compte créé ! Vérifiez vos emails pour l'activer.",
            });
        } catch (err) {
            newUser.emailVerificationToken   = undefined;
            newUser.emailVerificationExpires = undefined;
            await newUser.save({ validateBeforeSave: false });
            console.error('❌ Erreur envoi email vérification:', err);
            return res.status(500).json({
                status:  'error',
                message: "Erreur d'envoi d'email. Réessayez plus tard.",
            });
        }
    } catch (error) {
        console.error('❌ Erreur signup:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 2. VÉRIFICATION EMAIL
// ======================================================
exports.verifyEmail = async (req, res) => {
    try {
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            emailVerificationToken:   hashedToken,
            emailVerificationExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                status:  'fail',
                message: 'Lien de vérification invalide ou expiré. Veuillez vous réinscrire ou demander un nouveau lien.',
            });
        }

        user.isEmailVerified          = true;
        user.emailVerificationToken   = undefined;
        user.emailVerificationExpires = undefined;
        if (!user.tokenVersion) user.tokenVersion = 0;

        await user.save({ validateBeforeSave: false });

        createSendToken(user, 200, res);
    } catch (error) {
        console.error('❌ Erreur verifyEmail:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 3. RENVOYER EMAIL DE VÉRIFICATION
// ======================================================
exports.resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ status: 'fail', message: 'Email requis.' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(200).json({
                status:  'success',
                message: 'Si cet email existe, un nouveau lien a été envoyé.',
            });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ status: 'fail', message: 'Cet email est déjà vérifié.' });
        }

        const verificationToken = user.createEmailVerificationToken();
        await user.save({ validateBeforeSave: false });

        const verifyURL = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

        await sendEmail({
            email:     user.email,
            subject:   "✅ Altitude Vision — Nouveau lien d'activation",
            type:      'verification',
            name:      user.name,
            verifyURL,
            message:   `Bonjour ${user.name},\n\nVoici votre nouveau lien d'activation : ${verifyURL}\n\nCe lien expire dans 24h.`,
        });

        res.status(200).json({
            status:  'success',
            message: 'Un nouveau lien de vérification a été envoyé à votre adresse email.',
        });
    } catch (error) {
        console.error('❌ Erreur resendVerification:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 4. LOGIN
// ======================================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Email et mot de passe requis.' });
        }

        const user = await User.findOne({ email }).select('+password');

        if (!user || !(await user.matchPassword(password, user.password))) {
            return res.status(401).json({ status: 'fail', message: 'Email ou mot de passe incorrect.' });
        }

        if (!user.isEmailVerified) {
            return res.status(401).json({
                status:  'fail',
                message: 'Veuillez vérifier votre email avant de vous connecter.',
                action:  'VERIFY_EMAIL',
            });
        }

        user.lastLoginAt = new Date();
        await user.save({ validateBeforeSave: false });

        createSendToken(user, 200, res);
    } catch (error) {
        console.error('❌ Erreur login:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 5. AUTH OPTIONNELLE
// ======================================================
exports.optionalAuth = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) return next();

        const decoded     = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.id);

        if (!currentUser)                                     return next();
        if (currentUser.tokenVersion > decoded.tokenVersion) return next();
        if (currentUser.changedPasswordAfter(decoded.iat))   return next();

        req.user = currentUser;
        return next();
    } catch {
        return next();
    }
};

// ======================================================
// 6. PROTECT (Auth obligatoire)
// ======================================================
exports.protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ status: 'fail', message: 'Non connecté.' });
        }

        const decoded     = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.id);

        if (!currentUser) {
            return res.status(401).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        }

        if (
            currentUser.tokenVersion &&
            decoded.tokenVersion !== undefined &&
            currentUser.tokenVersion > decoded.tokenVersion
        ) {
            return res.status(401).json({
                status:  'fail',
                message: 'Session expirée ou révoquée. Veuillez vous reconnecter.',
            });
        }

        if (currentUser.changedPasswordAfter(decoded.iat)) {
            return res.status(401).json({
                status:  'fail',
                message: 'Mot de passe changé. Reconnectez-vous.',
            });
        }

        await User.findByIdAndUpdate(currentUser._id, { lastActivityAt: new Date() });

        req.user = currentUser;
        next();
    } catch {
        res.status(401).json({ status: 'fail', message: 'Token invalide.' });
    }
};

// ======================================================
// 7. RESTRICTION (Rôles)
// ======================================================
exports.restrictTo = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ status: 'fail', message: 'Permission refusée.' });
    }
    next();
};

// ======================================================
// 8. MISE À JOUR MOT DE PASSE
// ======================================================
exports.updateMyPassword = async (req, res) => {
    try {
        const { passwordCurrent, password, passwordConfirm } = req.body;

        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        }

        if (!(await user.matchPassword(passwordCurrent, user.password))) {
            return res.status(401).json({ status: 'fail', message: 'Mot de passe actuel incorrect.' });
        }

        user.password        = password;
        user.passwordConfirm = passwordConfirm;
        user.tokenVersion    = (user.tokenVersion || 0) + 1;

        await user.save();

        createSendToken(user, 200, res);
    } catch (error) {
        console.error('❌ Erreur updateMyPassword:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 9. UPDATE ME
// ✅ Upload Cloudinary via buffer (multer memoryStorage)
// ✅ Gère removePhoto
// ✅ Gère phone
// ======================================================
exports.updateMe = async (req, res) => {
    try {
        if (req.body.password || req.body.passwordConfirm) {
            return res.status(400).json({
                status:  'fail',
                message: 'Utilisez /updateMyPassword pour le mot de passe.',
            });
        }

        const currentUser = await User.findById(req.user.id).select('photo');

        const filteredBody = {};
        ['name', 'email', 'phone'].forEach(field => {
            if (req.body[field] !== undefined) filteredBody[field] = req.body[field];
        });

        // ✅ Cas 1 : nouvelle photo
        // Avec multer memoryStorage, req.file.path n'existe PAS.
        // Il faut uploader le buffer manuellement vers Cloudinary.
        if (req.file) {
            console.log('📸 [updateMe] Fichier reçu:', req.file.originalname, req.file.size, 'bytes');
            const result = await uploadToCloudinary(req.file.buffer, {
                folder:         'altitude-vision/users',
                public_id:      `user-${req.user.id}`,
                overwrite:      true,
                invalidate:     true,
                transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
            });
            await destroyFromCloudinary(currentUser?.photo);
            filteredBody.photo = result.secure_url;
            console.log('✅ [updateMe] Photo Cloudinary:', filteredBody.photo);
        }

        // ✅ Cas 2 : suppression explicite
        else if (req.body.removePhoto === 'true') {
            await destroyFromCloudinary(currentUser?.photo);
            filteredBody.photo = null;
            console.log('🗑️  [updateMe] Photo supprimée pour user:', req.user.id);
        }

        const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
            new:           true,
            runValidators: true,
            select:        '-password',
        });

        res.status(200).json({ status: 'success', data: { user: updatedUser } });
    } catch (error) {
        console.error('❌ Erreur updateMe:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 10. MOT DE PASSE OUBLIÉ
// Route: POST /api/auth/forgot-password
// ======================================================
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ status: 'fail', message: 'Email requis.' });
        }

        const user = await User.findOne({ email });

        // Réponse générique pour ne pas révéler si l'email existe
        if (!user) {
            return res.status(200).json({
                status:  'success',
                message: 'Si cet email existe, un lien de réinitialisation a été envoyé.',
            });
        }

        // Générer le token de réinitialisation
        const resetToken = crypto.randomBytes(32).toString('hex');

        user.passwordResetToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Expire dans 10 minutes
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000;

        await user.save({ validateBeforeSave: false });

        const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        try {
            await sendEmail({
                email:    user.email,
                subject:  '🔐 Altitude Vision — Réinitialisation de votre mot de passe',
                type:     'passwordReset',
                name:     user.name,
                resetURL,
                message:  `Bonjour ${user.name},\n\nRéinitialisez votre mot de passe ici : ${resetURL}\n\nCe lien expire dans 10 minutes.\n\nSi vous n'avez pas fait cette demande, ignorez cet email.`,
            });

            console.log(`✅ [Auth] Email reset envoyé à: ${user.email}`);

            res.status(200).json({
                status:  'success',
                message: 'Si cet email existe, un lien de réinitialisation a été envoyé.',
            });
        } catch (err) {
            // Nettoyer le token si l'email échoue
            user.passwordResetToken   = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });

            console.error('❌ [Auth] Erreur envoi email reset:', err.message);
            return res.status(500).json({
                status:  'error',
                message: "Erreur lors de l'envoi de l'email. Réessayez dans quelques minutes.",
            });
        }
    } catch (error) {
        console.error('❌ [Auth] Erreur forgotPassword:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 11. GOOGLE AUTH
// Route: POST /api/auth/google
// ======================================================
exports.googleAuth = async (req, res) => {
    try {
        const { email, name, googleId, avatar } = req.body;

        if (!email || !googleId) {
            return res.status(400).json({ status: 'fail', message: 'email et googleId requis.' });
        }

        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (user) {
            if (!user.googleId) {
                user.googleId      = googleId;
                user.avatar        = avatar;
                user.photo         = user.photo || avatar;
                user.isVerified    = true;
                user.isEmailVerified = true;
                user.authProvider  = 'google';
                await user.save({ validateBeforeSave: false });
            }
        } else {
            const randomPwd = crypto.randomBytes(20).toString('hex');
            user = await User.create({
                name,
                email,
                googleId,
                avatar,
                photo:         avatar,
                role:          'User',
                isVerified:    true,
                isEmailVerified: true,
                authProvider:  'google',
                password:        randomPwd,
                passwordConfirm: randomPwd,
            });
        }

        user.lastLoginAt = new Date();
        await user.save({ validateBeforeSave: false });

        createSendToken(user, 200, res);
    } catch (error) {
        console.error('❌ [Auth] Erreur googleAuth:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 12. GOOGLE GET TOKEN
// Route: POST /api/auth/google-token
// ======================================================
exports.googleGetToken = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ status: 'fail', message: 'email requis.' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'Utilisateur non trouvé.' });
        }

        const token = signToken(user._id, user.tokenVersion);

        res.status(200).json({
            status: 'success',
            token,
            userId: user._id,
            role:   user.role,
        });
    } catch (error) {
        console.error('❌ [Auth] Erreur googleGetToken:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 13. RÉINITIALISATION MOT DE PASSE
// Route: PATCH /api/auth/reset-password/:token
// ======================================================
exports.resetPassword = async (req, res) => {
    try {
        const { password, passwordConfirm } = req.body;

        if (!password || !passwordConfirm) {
            return res.status(400).json({
                status:  'fail',
                message: 'Nouveau mot de passe et confirmation requis.',
            });
        }

        if (password !== passwordConfirm) {
            return res.status(400).json({
                status:  'fail',
                message: 'Les mots de passe ne correspondent pas.',
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                status:  'fail',
                message: 'Le mot de passe doit contenir au moins 8 caractères.',
            });
        }

        // Hasher le token de l'URL pour le comparer à celui en BDD
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken:   hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                status:  'fail',
                message: 'Lien de réinitialisation invalide ou expiré. Faites une nouvelle demande.',
            });
        }

        // Appliquer le nouveau mot de passe
        user.password             = password;
        user.passwordConfirm      = passwordConfirm;
        user.passwordResetToken   = undefined;
        user.passwordResetExpires = undefined;

        // Invalider toutes les sessions actives
        user.tokenVersion = (user.tokenVersion || 0) + 1;

        await user.save();

        console.log(`✅ [Auth] Mot de passe réinitialisé pour: ${user.email}`);

        // Connecter automatiquement l'utilisateur après reset
        createSendToken(user, 200, res);
    } catch (error) {
        console.error('❌ [Auth] Erreur resetPassword:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};