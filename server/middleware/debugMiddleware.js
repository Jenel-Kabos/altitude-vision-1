// middleware/debugMiddleware.js
// Permet d'afficher le contenu de FormData et des fichiers côté serveur

const debugFormData = (req, res, next) => {
  console.log('===== DEBUG FORM DATA =====');
  console.log('Body:', req.body);

  if (req.files && req.files.length > 0) {
    console.log('Files:', req.files.map(f => ({
      fieldname: f.fieldname,
      originalname: f.originalname,
      path: f.path,
      size: f.size
    })));
  } else {
    console.log('Files: Aucun fichier uploadé');
  }

  console.log('===========================');
  next();
};

module.exports = debugFormData;
