// server/updateEventImages.js
require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('./models/Event');
const path = require('path');

const sanitizeFilename = (filename) => {
  const ext = path.extname(filename);
  let name = path.basename(filename, ext);
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!name || name.length < 3) name = 'image';
  return name + ext.toLowerCase();
};

const updateImages = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connecté');

    const events = await Event.find({});
    let updated = 0;

    for (const event of events) {
      let hasChanged = false;
      const newImages = event.images.map(imgUrl => {
        // Extraire le nom de fichier de l'URL
        const urlParts = imgUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        
        // Nettoyer le nom
        const cleanName = sanitizeFilename(decodeURIComponent(filename));
        
        if (cleanName !== filename) {
          hasChanged = true;
          // Reconstruire l'URL avec le nom nettoyé
          urlParts[urlParts.length - 1] = cleanName;
          return urlParts.join('/');
        }
        return imgUrl;
      });

      if (hasChanged) {
        event.images = newImages;
        await event.save();
        updated++;
        console.log(`✅ Événement mis à jour: ${event.name}`);
        console.log('   Nouvelles images:', newImages);
      }
    }

    console.log(`\n✨ ${updated} événement(s) mis à jour`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
};

updateImages();