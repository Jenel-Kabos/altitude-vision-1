const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB connecté: ${conn.connection.host}`.cyan.underline);
  } catch (error) {
    console.error(`❌ Erreur de connexion à MongoDB: ${error.message}`.red.bold);
    process.exit(1);
  }
};

module.exports = connectDB;