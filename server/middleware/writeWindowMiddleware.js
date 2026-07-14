/**
 * writeWindowMiddleware
 *
 * Règle collaborateur : peut créer, modifier et supprimer
 * dans les 10 minutes suivant une écriture.
 * Passé ce délai : lecture seule.
 *
 * Usage dans une route :
 *   router.use(protect, restrictTo('Admin','Collaborateur'), writeWindowMiddleware);
 *   ou plus finement :
 *   router.patch('/:id', protect, restrictTo('Admin','Collaborateur'), writeWindowMiddleware, ctrl.update);
 */

const WriteWindow = require('../models/WriteWindow');
const { COLLAB_ROLES } = require('../utils/roles');

const WRITE_METHODS  = ['POST', 'PUT', 'PATCH', 'DELETE'];
const MUTATE_METHODS = ['PUT', 'PATCH', 'DELETE'];

// Cherche récursivement le premier _id dans la réponse JSON
const findResourceId = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > 4) return null;
  if (obj._id) return String(obj._id);
  for (const v of Object.values(obj)) {
    const found = findResourceId(v, depth + 1);
    if (found) return found;
  }
  return null;
};

const writeWindowMiddleware = async (req, res, next) => {
  // Admin : toujours autorisé — restriction sur tous les sous-rôles collaborateurs
  // (cohérent avec isCollaborateur côté frontend, cf. AuthContext.jsx)
  if (!req.user || !COLLAB_ROLES.includes(req.user.role)) return next();

  const method     = req.method.toUpperCase();
  const resourceId = req.params.id;

  // ── Lecture : toujours permise ──────────────────────────────
  if (!WRITE_METHODS.includes(method)) return next();

  // ── PATCH / PUT / DELETE → vérifier la fenêtre ─────────────
  if (MUTATE_METHODS.includes(method)) {
    if (!resourceId) return next(); // pas d'ID → laisser passer (géré par le contrôleur)

    const window = await WriteWindow.findOne({
      userId:     req.user._id,
      resourceId: String(resourceId),
    });

    if (!window) {
      return res.status(403).json({
        status:  'fail',
        code:    'WRITE_WINDOW_EXPIRED',
        message: 'Fenêtre de modification expirée. Les collaborateurs peuvent modifier ou supprimer uniquement dans les 10 minutes suivant une écriture.',
      });
    }

    // Fenêtre valide → laisser passer
    return next();
  }

  // ── POST → autoriser + enregistrer la fenêtre après réponse ─
  if (method === 'POST') {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Enregistrement asynchrone (non bloquant)
      if (res.statusCode >= 200 && res.statusCode < 300 && body) {
        const newId = findResourceId(body?.data);
        if (newId) {
          WriteWindow.findOneAndUpdate(
            { userId: req.user._id, resourceId: newId },
            { userId: req.user._id, resourceId: newId, createdAt: new Date() },
            { upsert: true, new: true }
          ).catch(err => console.error('❌ [WriteWindow] Erreur enregistrement:', err.message));
        }
      }
      return originalJson(body);
    };

    return next();
  }

  next();
};

module.exports = writeWindowMiddleware;
