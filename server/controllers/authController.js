// server/controllers/authController.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/email');

// Utility: create & send token
const createSendToken = (user, statusCode, res) => {
    // On passe la tokenVersion pour qu'elle soit dans le payload
    const token = generateToken(user._id, user.tokenVersion); 

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
                isEmailVerified: user.isEmailVerified, // On renvoie l'info au front
            },
        },
    });
};

// ============================================================
// 1. INSCRIPTION (Modifiée pour Email Verification)
// ============================================================
exports.signup = async (req, res) => {
    try {
        const { name, email, password, passwordConfirm, role, phone } = req.body;

        // 1. Vérifications de base
        if (!name || !email || !password) {
            return res.status(400).json({
                status: 'fail',
                message: 'Veuillez fournir un nom, un email et un mot de passe.',
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                status: 'fail',
                message: 'Adresse email déjà utilisée.',
            });
        }

        // 2. Création de l'utilisateur (isEmailVerified est false par défaut)
        const newUser = await User.create({
            name,
            email,
            password,
            passwordConfirm, // Important pour la validation du modèle
            role: role || 'Client',
            phone: phone || '',
            photo: req.file ? req.file.path : undefined,
        });

        // 3. Générer le token de vérification d'email
        const verificationToken = newUser.createEmailVerificationToken();
        await newUser.save({ validateBeforeSave: false });

        // 4. Construire l'URL de vérification (Lien vers le Frontend)
        const verifyURL = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

        const message = `Bonjour ${newUser.name},\n\nBienvenue chez Altitude Vision ! 🎉\n\nPour activer votre compte, veuillez cliquer sur le lien ci-dessous :\n\n${verifyURL}\n\nCe lien est valide pendant 24 heures.\n\nSi vous n'avez pas créé de compte, veuillez ignorer cet email.`;

        try {
            // 5. Envoyer l'email
            await sendEmail({
                email: newUser.email,
                subject: 'Altitude Vision - Activez votre compte',
                message,
            });

            // 6. Répondre au client (SANS le token JWT)
            res.status(200).json({
                status: 'success',
                message: 'Compte créé ! Un email de confirmation a été envoyé à votre adresse.',
            });

        } catch (err) {
            // En cas d'erreur d'envoi, on nettoie l'utilisateur pour qu'il puisse réessayer
            newUser.emailVerificationToken = undefined;
            newUser.emailVerificationExpires = undefined;
            await newUser.save({ validateBeforeSave: false });

            return res.status(500).json({
                status: 'error',
                message: 'Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.',
            });
        }

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
};

// ============================================================
// 2. VERIFICATION EMAIL
// ============================================================
exports.verifyEmail = async (req, res) => {
    try {
        // 1. Hasher le token reçu dans l'URL pour le comparer à la BDD
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        // 2. Chercher l'utilisateur avec ce token ET vérif expiration
        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() }, // Doit être dans le futur
        });

        if (!user) {
            return res.status(400).json({
                status: 'fail',
                message: 'Le lien est invalide ou a expiré.',
            });
        }

        // 3. Activer le compte
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        
        // On initialise la tokenVersion ici si elle n'existe pas
        if (!user.tokenVersion) user.tokenVersion = 0;
        
        await user.save({ validateBeforeSave: false });

        // 4. Connecter l'utilisateur directement (Envoi du JWT)
        createSendToken(user, 200, res);

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
};

// ============================================================
// 3. LOGIN
// ============================================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 'fail',
                message: 'Veuillez fournir un email et un mot de passe.',
            });
        }

        const user = await User.findOne({ email }).select('+password');

        if (!user || !(await user.correctPassword(password, user.password))) {
            return res.status(401).json({
                status: 'fail',
                message: 'Email ou mot de passe incorrect.',
            });
        }

        // Vérification de l'email
        if (!user.isEmailVerified) {
            return res.status(401).json({
                status: 'fail',
                message: 'Veuillez vérifier votre adresse email avant de vous connecter.',
            });
        }
        
        // Mise à jour de la session et de la tokenVersion
        user.lastLoginAt = new Date();
        user.tokenVersion = (user.tokenVersion || 0) + 1; 
        await user.save({ validateBeforeSave: false });

        createSendToken(user, 200, res);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
};

// ============================================================
// 4. AUTHENTIFICATION OPTIONNELLE (✅ C'est la fonction manquante !)
// ============================================================
exports.optionalAuth = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(); // Pas de token, on continue en tant que visiteur (req.user reste undefined)
        }

        // Vérification du token (si présent)
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

        // Vérifier si l'utilisateur existe encore
        const currentUser = await User.findById(decoded.id);
        if (!currentUser) {
            return next();
        }

        // Vérifier si le token a été invalidé
        if (currentUser.tokenVersion > decoded.tokenVersion) {
            return next();
        }

        // Vérifier si mot de passe changé
        if (currentUser.changedPasswordAfter(decoded.iat)) {
            return next();
        }

        // Si tout est bon, on attache l'utilisateur à la requête
        req.user = currentUser;
        return next();
    } catch (err) {
        // En cas d'erreur (token invalide, expiré, etc.), on continue simplement en tant que visiteur
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
            return res.status(401).json({
                status: 'fail',
                message: 'Vous n’êtes pas connecté. Veuillez vous connecter pour continuer.',
            });
        }

        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

        const currentUser = await User.findById(decoded.id);
        if (!currentUser) {
            return res.status(401).json({
                status: 'fail',
                message: 'L’utilisateur lié à ce token n’existe plus.',
            });
        }
        
        // Vérification invalidation token
        if (currentUser.tokenVersion > decoded.tokenVersion) { 
            return res.status(401).json({
                status: 'fail',
                message: 'La session a été invalidée. Veuillez vous reconnecter.',
            });
        }

        if (currentUser.changedPasswordAfter(decoded.iat)) {
            return res.status(401).json({
                status: 'fail',
                message: 'Mot de passe récemment changé. Veuillez vous reconnecter.',
            });
        }

        // Mise à jour activité
        currentUser.lastActivityAt = new Date();
        await currentUser.save({ validateBeforeSave: false }); 

        req.user = currentUser;
        next();
    } catch (error) {
        res.status(401).json({
            status: 'fail',
            message: 'Token invalide ou expiré. Veuillez vous reconnecter.',
        });
    }
};

// ============================================================
// 6. RESTRICTION (Rôles)
// ============================================================
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'fail',
                message: 'Vous n’avez pas la permission pour effectuer cette action.',
            });
        }
        next();
    };
};

// ============================================================
// 7. MISES À JOUR UTILISATEUR
// ============================================================
exports.updateMe = async (req, res) => {
    try {
        if (req.body.password || req.body.passwordConfirm) {
            return res.status(400).json({
                status: 'fail',
                message: 'Cette route n\'est pas pour les mots de passe. Utilisez /updateMyPassword.',
            });
        }

        const filteredBody = {
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
        };

        if (req.file) filteredBody.photo = req.file.path;

        Object.keys(filteredBody).forEach(key => {
            if (filteredBody[key] === undefined) delete filteredBody[key];
        });

        const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    _id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    phone: updatedUser.phone || null,
                    role: updatedUser.role,
                    photo: updatedUser.photo || null,
                },
            },
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.updateMyPassword = async (req, res) => {
    try {
        const { passwordCurrent, password, passwordConfirm } = req.body;

        const user = await User.findById(req.user.id).select('+password');

        if (!user || !(await user.correctPassword(passwordCurrent, user.password))) {
            return res.status(401).json({ status: 'fail', message: 'Mot de passe actuel incorrect.' });
        }

        if (password !== passwordConfirm) {
            return res.status(400).json({ status: 'fail', message: 'Les nouveaux mots de passe ne correspondent pas.' });
        }

        user.password = password;
        await user.save(); 

        createSendToken(user, 200, res);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};