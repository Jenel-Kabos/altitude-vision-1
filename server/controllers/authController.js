// server/controllers/authController.js (MODIFIÉ)
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// Utility: create & send token
const createSendToken = (user, statusCode, res) => {
    // 🚨 MODIFICATION : Passez la tokenVersion pour qu'elle soit dans le payload
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
            },
        },
    });
};

// Signup
exports.signup = async (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;

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

        const newUser = await User.create({
            name,
            email,
            password,
            role: role || 'Client',
            phone: phone || '',
            photo: req.file ? req.file.path : undefined,
        });

        // Lors de la création, le modèle donne par défaut tokenVersion: 0.
        // On envoie le token avec la version initiale.
        createSendToken(newUser, 201, res);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
};

// Login
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
        
        // 🚨 MODIFICATION : Mise à jour de la session et de la tokenVersion lors du login
        user.lastLoginAt = new Date();
        user.tokenVersion = user.tokenVersion + 1; // Incrémente pour invalider les anciens tokens
        await user.save({ validateBeforeSave: false });

        createSendToken(user, 200, res);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
};

// Protect
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
        
        // 🚨 NOUVEAU CONTRÔLE 1 : Vérification de l'invalidation du token (bannissement/déconnexion forcée)
        if (currentUser.tokenVersion > decoded.tokenVersion) { 
            return res.status(401).json({
                status: 'fail',
                message: 'La session a été invalidée par l’administrateur ou par un changement de mot de passe. Veuillez vous reconnecter.',
            });
        }

        if (currentUser.changedPasswordAfter(decoded.iat)) {
            return res.status(401).json({
                status: 'fail',
                message: 'Mot de passe récemment changé. Veuillez vous reconnecter.',
            });
        }

        // 🚨 NOUVEAU CONTRÔLE 2 : Mettre à jour la dernière activité (pour le suivi)
        // Ceci est une opération fréquente, donc on l'enregistre en arrière-plan
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

// Restrict roles (INCHANGÉ)
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

// 🔹 Update user info (name, email, phone, photo) (INCHANGÉ)
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
            phone: req.body.phone, // 🔹 numéro de téléphone
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
                    phone: updatedUser.phone || null, // 🔹 renvoyer le téléphone
                    role: updatedUser.role,
                    photo: updatedUser.photo || null,
                },
            },
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// Update password (INCHANGÉ)
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
        // La mise à jour du passwordChangedAt invalidera automatiquement les tokens existants
        await user.save(); 

        createSendToken(user, 200, res);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};