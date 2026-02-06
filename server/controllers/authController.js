// server/controllers/authController.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const sendEmail = require('../utils/email');

// Utilitaire pour générer le token (Intégré ici pour simplicité si tu n'as pas utils/generateToken)
const signToken = (id, tokenVersion) => {
    return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '90d',
    });
};

// Utility: create & send token
const createSendToken = (user, statusCode, res) => {
    // On passe la tokenVersion pour qu'elle soit dans le payload
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

// ============================================================
// 1. INSCRIPTION
// ============================================================
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

        // Génération du token de vérification d'email
        const verificationToken = newUser.createEmailVerificationToken();
        await newUser.save({ validateBeforeSave: false });

        // URL de vérification
        const verifyURL = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

        const message = `Bonjour ${newUser.name},\n\nBienvenue chez Altitude Vision ! 🎉\n\nPour activer votre compte, cliquez ici :\n${verifyURL}\n\nCe lien expire dans 24h.`;

        try {
            await sendEmail({
                email: newUser.email,
                subject: 'Altitude Vision - Activez votre compte',
                message,
            });

            res.status(200).json({
                status: 'success',
                message: 'Compte créé ! Vérifiez vos emails pour l\'activer.',
            });

        } catch (err) {
            newUser.emailVerificationToken = undefined;
            newUser.emailVerificationExpires = undefined;
            await newUser.save({ validateBeforeSave: false });

            return res.status(500).json({
                status: 'error',
                message: 'Erreur d\'envoi d\'email. Réessayez plus tard.',
            });
        }

    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ============================================================
// 2. VERIFICATION EMAIL
// ============================================================
exports.verifyEmail = async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ status: 'fail', message: 'Lien invalide ou expiré.' });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        if (!user.tokenVersion) user.tokenVersion = 0;
        
        await user.save({ validateBeforeSave: false });

        createSendToken(user, 200, res);

    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ============================================================
// 3. LOGIN
// ============================================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Email et mot de passe requis.' });
        }

        const user = await User.findOne({ email }).select('+password');

        // ✅ Harmonisation : on utilise 'matchPassword' comme dans User.js
        if (!user || !(await user.matchPassword(password, user.password))) {
            return res.status(401).json({ status: 'fail', message: 'Email ou mot de passe incorrect.' });
        }

        if (!user.isEmailVerified) {
            return res.status(401).json({ status: 'fail', message: 'Veuillez vérifier votre email.' });
        }
        
        // Mise à jour de la dernière connexion
        user.lastLoginAt = new Date();
        await user.save({ validateBeforeSave: false });

        createSendToken(user, 200, res);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ============================================================
// 4. AUTH OPTIONNELLE
// ============================================================
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

        req.user = currentUser;
        return next();
    } catch (err) {
        return next();
    }
};

// ============================================================
// 5. PROTECT (Auth Obligatoire)
// ============================================================
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
        
        // 🔒 Sécurité : Si le token a été invalidé (ex: bouton "Révoquer" cliqué)
        // On compare la version du token avec celle en base
        if (currentUser.tokenVersion && decoded.tokenVersion && currentUser.tokenVersion > decoded.tokenVersion) { 
            return res.status(401).json({
                status: 'fail',
                message: 'Session expirée ou révoquée. Veuillez vous reconnecter.',
            });
        }

        if (currentUser.changedPasswordAfter(decoded.iat)) {
            return res.status(401).json({ status: 'fail', message: 'Mot de passe changé. Reconnectez-vous.' });
        }

        // ✅ PERF : Mise à jour légère du timestamp (sans hooks)
        await User.findByIdAndUpdate(currentUser._id, { lastActivityAt: new Date() });

        req.user = currentUser;
        next();
    } catch (error) {
        res.status(401).json({ status: 'fail', message: 'Token invalide.' });
    }
};

// ============================================================
// 6. RESTRICTION (Rôles)
// ============================================================
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ status: 'fail', message: 'Permission refusée.' });
        }
        next();
    };
};

// ============================================================
// 7. MISE À JOUR MOT DE PASSE
// ============================================================
exports.updateMyPassword = async (req, res) => {
    try {
        const { passwordCurrent, password, passwordConfirm } = req.body;
        const user = await User.findById(req.user.id).select('+password');

        // ✅ Utilisation de matchPassword
        if (!user || !(await user.matchPassword(passwordCurrent, user.password))) {
            return res.status(401).json({ status: 'fail', message: 'Mot de passe actuel incorrect.' });
        }

        user.password = password;
        user.passwordConfirm = passwordConfirm;
        // On incrémente la version du token pour déconnecter les autres appareils si nécessaire
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        
        await user.save(); 

        createSendToken(user, 200, res);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ============================================================
// 8. UPDATE ME (Infos générales)
// ============================================================
exports.updateMe = async (req, res) => {
    try {
        if (req.body.password || req.body.passwordConfirm) {
            return res.status(400).json({ status: 'fail', message: 'Utilisez /updateMyPassword pour le mot de passe.' });
        }

        const filteredBody = {
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
        };
        if (req.file) filteredBody.photo = req.file.path;

        // Nettoyage des undefined
        Object.keys(filteredBody).forEach(key => filteredBody[key] === undefined && delete filteredBody[key]);

        const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({
            status: 'success',
            data: { user: updatedUser },
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};