// server/utils/generateToken.js
const jwt = require('jsonwebtoken');

/**
 * Génère un token JWT pour un utilisateur donné, incluant la version du token pour la gestion des sessions.
 * @param {string} userId - L'ID MongoDB de l'utilisateur.
 * @param {number} tokenVersion - La version actuelle du token de l'utilisateur (pour l'invalidation forcée).
 * @returns {string} - Token JWT signé.
 * @throws {Error} Si JWT_SECRET ou JWT_EXPIRES_IN ne sont pas définis.
 */
const generateToken = (userId, tokenVersion) => { // 🚨 MODIFIÉ : Ajout de tokenVersion
    if (!process.env.JWT_SECRET || !process.env.JWT_EXPIRES_IN) {
        throw new Error(
            'Les variables d'environnement JWT_SECRET ou JWT_EXPIRES_IN doivent être définies dans le fichier .env'
        );
    }

    // 🚨 MODIFIÉ : Ajout de tokenVersion dans le payload du JWT
    return jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

module.exports = generateToken;