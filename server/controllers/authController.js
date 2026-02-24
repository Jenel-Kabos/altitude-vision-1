// server/controllers/authController.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const sendEmail = require('../utils/email');

// ======================================================
// 🔑 UTILITAIRES JWT
// ======================================================
const signToken = (id, tokenVersion) => {
    return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '90d',
    });
};

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id, user.tokenVersion);
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone || null,
                photo: user.photo || null,
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

        const newUser = await User.create({
            name,
            email,
            password,
            passwordConfirm,
            role: role || 'Client',
            phone: phone || '',
            photo: req.file ? req.file.path : undefined,
        });

        // Génération du token de vérification
        const verificationToken = newUser.createEmailVerificationToken();
        await newUser.save({ validateBeforeSave: false });

        const verifyURL = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

        try {
            // ✅ Envoi de l'email HTML avec le nouveau template
            await sendEmail({
                email: newUser.email,
                subject: '✅ Altitude Vision — Activez votre compte',
                type: 'verification',       // ← déclenche le template HTML
                name: newUser.name,
                verifyURL,
                // Fallback texte brut
                message: `Bonjour ${newUser.name},\n\nActivez votre compte ici : ${verifyURL}\n\nCe lien expire dans 24h.`,
            });

            res.status(200).json({
                status: 'success',
                message: 'Compte créé ! Vérifiez vos emails pour l\'activer.',
            });

        } catch (err) {
            // Si l'envoi échoue, on nettoie le token pour permettre de réessayer
            newUser.emailVerificationToken = undefined;
            newUser.emailVerificationExpires = undefined;
            await newUser.save({ validateBeforeSave: false });

            console.error('❌ Erreur envoi email vérification:', err);
            return res.status(500).json({
                status: 'error',
                message: 'Erreur d\'envoi d\'email. Réessayez plus tard.',
            });
        }

    } catch (error) {
        console.error('❌ Erreur signup:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 2. VÉRIFICATION EMAIL (via le lien cliqué)
// ======================================================
exports.verifyEmail = async (req, res) => {
    try {
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                status: 'fail',
                message: 'Lien de vérification invalide ou expiré. Veuillez vous réinscrire ou demander un nouveau lien.',
            });
        }

        // ✅ Activation du compte
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        if (!user.tokenVersion) user.tokenVersion = 0;

        await user.save({ validateBeforeSave: false });

        // Connexion automatique après vérification
        createSendToken(user, 200, res);

    } catch (error) {
        console.error('❌ Erreur verifyEmail:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 3. RENVOYER L'EMAIL DE VÉRIFICATION
// ======================================================
exports.resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ status: 'fail', message: 'Email requis.' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            // Sécurité : ne pas révéler si l'email existe ou non
            return res.status(200).json({
                status: 'success',
                message: 'Si cet email existe, un nouveau lien a été envoyé.',
            });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({
                status: 'fail',
                message: 'Cet email est déjà vérifié.',
            });
        }

        // Génère un nouveau token
        const verificationToken = user.createEmailVerificationToken();
        await user.save({ validateBeforeSave: false });

        const verifyURL = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

        await sendEmail({
            email: user.email,
            subject: '✅ Altitude Vision — Nouveau lien d\'activation',
            type: 'verification',
            name: user.name,
            verifyURL,
            message: `Bonjour ${user.name},\n\nVoici votre nouveau lien d'activation : ${verifyURL}\n\nCe lien expire dans 24h.`,
        });

        res.status(200).json({
            status: 'success',
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

        // ✅ Blocage si email non vérifié
        if (!user.isEmailVerified) {
            return res.status(401).json({
                status: 'fail',
                message: 'Veuillez vérifier votre email avant de vous connecter.',
                action: 'VERIFY_EMAIL', // ← Le frontend peut utiliser ça pour afficher le bouton "Renvoyer"
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
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) return next();

        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.id);

        if (!currentUser) return next();
        if (currentUser.tokenVersion > decoded.tokenVersion) return next();
        if (currentUser.changedPasswordAfter(decoded.iat)) return next();

        console.log(`✅ [OptionalAuth] Utilisateur connecté : ${currentUser.email}`);
        req.user = currentUser;
        return next();
    } catch (err) {
        return next();
    }
};

// ======================================================
// 6. PROTECT (Auth Obligatoire)
// ======================================================
exports.protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ status: 'fail', message: 'Non connecté.' });
        }

        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.id);

        if (!currentUser) {
            return res.status(401).json({ status: 'fail', message: 'Utilisateur introuvable.' });
        }

        if (currentUser.tokenVersion && decoded.tokenVersion !== undefined
            && currentUser.tokenVersion > decoded.tokenVersion) {
            return res.status(401).json({
                status: 'fail',
                message: 'Session expirée ou révoquée. Veuillez vous reconnecter.',
            });
        }

        if (currentUser.changedPasswordAfter(decoded.iat)) {
            return res.status(401).json({
                status: 'fail',
                message: 'Mot de passe changé. Reconnectez-vous.',
            });
        }

        await User.findByIdAndUpdate(currentUser._id, { lastActivityAt: new Date() });

        req.user = currentUser;
        next();
    } catch (error) {
        res.status(401).json({ status: 'fail', message: 'Token invalide.' });
    }
};

// ======================================================
// 7. RESTRICTION (Rôles)
// ======================================================
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ status: 'fail', message: 'Permission refusée.' });
        }
        next();
    };
};

// ======================================================
// 8. MISE À JOUR MOT DE PASSE
// ======================================================
exports.updateMyPassword = async (req, res) => {
    try {
        const { passwordCurrent, password, passwordConfirm } = req.body;
        const user = await User.findById(req.user.id).select('+password');

        if (!user || !(await user.matchPassword(passwordCurrent, user.password))) {
            return res.status(401).json({ status: 'fail', message: 'Mot de passe actuel incorrect.' });
        }

        user.password = password;
        user.passwordConfirm = passwordConfirm;
        user.tokenVersion = (user.tokenVersion || 0) + 1;

        await user.save();

        createSendToken(user, 200, res);
    } catch (error) {
        console.error('❌ Erreur updateMyPassword:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ======================================================
// 9. UPDATE ME
// ======================================================
exports.updateMe = async (req, res) => {
    try {
        if (req.body.password || req.body.passwordConfirm) {
            return res.status(400).json({
                status: 'fail',
                message: 'Utilisez /updateMyPassword pour le mot de passe.',
            });
        }

        const filteredBody = {
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
        };
        if (req.file) filteredBody.photo = req.file.path;

        Object.keys(filteredBody).forEach(
            (key) => filteredBody[key] === undefined && delete filteredBody[key]
        );

        const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({
            status: 'success',
            data: { user: updatedUser },
        });
    } catch (error) {
        console.error('❌ Erreur updateMe:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};