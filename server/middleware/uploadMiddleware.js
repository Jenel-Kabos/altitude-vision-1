const multer = require('multer');
const path = require('path');

// 1. Configuration du stockage des fichiers
const storage = multer.diskStorage({
  // Définit le dossier de destination pour les fichiers uploadés
  destination(req, file, cb) {
    // Les fichiers seront sauvegardés dans le dossier 'uploads'
    // Assurez-vous que ce dossier existe à la racine de /server
    cb(null, 'uploads/');
  },
  // Définit le nom du fichier une fois sauvegardé sur le serveur
  filename(req, file, cb) {
    // Pour éviter les conflits de noms, on crée un nom unique :
    // nomDuChamp-DateActuelle.extensionOriginale
    // ex: image-166788T120000.jpg
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

// 2. Fonction de validation pour n'accepter que les images
function checkFileType(file, cb) {
  // Types de fichiers autorisés (expressions régulières)
  const filetypes = /jpeg|jpg|png|gif/;
  // Vérifier l'extension du fichier (ex: .png)
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Vérifier le type MIME du fichier (ex: image/jpeg)
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    // Si c'est une image, on autorise l'upload
    return cb(null, true);
  } else {
    // Sinon, on rejette l'upload avec un message d'erreur
    cb(new Error('Erreur : Seules les images sont autorisées !'));
  }
}

// 3. Initialisation de multer avec la configuration
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

module.exports = upload;