// Ce middleware est appelé lorsqu'aucune autre route ne correspond à la requête.
// Il crée une erreur 404 et la passe au middleware de gestion d'erreurs suivant.
const notFound = (req, res, next) => {
  const error = new Error(`Route non trouvée - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Ce middleware est le gestionnaire d'erreurs principal.
// Il attrape toutes les erreurs qui se produisent dans l'application.
const errorHandler = (err, req, res, next) => {
  // Parfois, une erreur peut arriver avec un code de statut 200, il faut le corriger.
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);

  // Répondre avec un message d'erreur en format JSON
  res.json({
    message: err.message,
    // N'afficher la "stack trace" que si nous sommes en mode développement
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

// Assurez-vous que les deux fonctions sont bien exportées
module.exports = { notFound, errorHandler };