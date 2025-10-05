const express = require('express');
const dotenv = require('dotenv');
const colors = require('colors');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

// Rendre le dossier 'uploads' statique
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

// Routes de l'API
app.get('/', (req, res) => res.send('API Altitude-Vision en cours d\'exécution...'));

app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/properties', require('./routes/propertyRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/quotes', require('./routes/quoteRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));

// Middlewares de gestion d'erreurs
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
  console.log(
    `✅ Serveur démarré en mode ${process.env.NODE_ENV} sur le port ${PORT}`.yellow.bold
  )
);