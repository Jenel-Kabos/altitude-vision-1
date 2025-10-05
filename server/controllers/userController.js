const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Inscrire un nouvel utilisateur
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res, next) => {
  const { name, email, password, role } = req.body;
  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400);
      throw new Error('Cet utilisateur existe déjà');
    }

    const user = await User.create({
      name,
      email,
      password,
      role, // Par défaut 'Client' si non fourni
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(400);
      throw new Error('Données utilisateur invalides');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Authentifier un utilisateur & obtenir un token
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401);
      throw new Error('Email ou mot de passe incorrect');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { registerUser, loginUser };