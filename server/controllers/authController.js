// server/controllers/authController.js
const crypto    = require('crypto');
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
        const { name, email, password, passwordConfirm, role, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Champs manquants.' });
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

        const newUser = await User.create({
            name,
            email,
            password,
            passwordConfirm,
            role:  role  || 'Client',
            phone: phone || '',
            photo: photoUrl || undefined,
        });

        const verificationToken = newUser.createEmailVerificationToken();
        await newUser.save({ validateBeforeSave: false });

        const verifyURL = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

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