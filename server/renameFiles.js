// server/renameFiles.js
const fs = require('fs');
const path = require('path');

const uploadDir = './uploads/events';

// Fonction identique à celle de multer
const sanitizeFilename = (filename) => {
  const ext = path.extname(filename);
  let name = path.basename(filename, ext);
  
  // Normaliser les caractères Unicode
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  name = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  
  if (!name || name.length < 3) {
    name = 'image';
  }
  
  return name + ext.toLowerCase();
};

const renameFiles = () => {
  try {
    const files = fs.readdirSync(uploadDir);
    console.log(`📁 ${files.length} fichier(s) trouvé(s)`);

    let renamed = 0;
    files.forEach(file => {
      const oldPath = path.join(uploadDir, file);
      
      // Nettoyer le nom
      const cleanName = sanitizeFilename(file);
      
      if (cleanName !== file) {
        const newPath = path.join(uploadDir, cleanName);
        
        // Vérifier si le nouveau nom existe déjà
        if (fs.existsSync(newPath)) {
          // Ajouter un timestamp pour éviter les conflits
          const ext = path.extname(cleanName);
          const nameWithoutExt = path.basename(cleanName, ext);
          const uniqueName = `${nameWithoutExt}-${Date.now()}${ext}`;
          const uniquePath = path.join(uploadDir, uniqueName);
          
          fs.renameSync(oldPath, uniquePath);
          console.log(`✅ ${file} → ${uniqueName}`);
          renamed++;
        } else {
          fs.renameSync(oldPath, newPath);
          console.log(`✅ ${file} → ${cleanName}`);
          renamed++;
        }
      }
    });

    console.log(`\n✨ ${renamed} fichier(s) renommé(s)`);
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
};

renameFiles();