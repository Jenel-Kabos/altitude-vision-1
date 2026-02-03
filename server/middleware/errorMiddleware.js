// --- middleware/errorMiddleware.js ---
import colors from "colors";

/**
 * Middleware pour gérer les routes non trouvées (404)
 */
const notFound = (req, res, next) => {
  const error = new Error(`Introuvable - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Middleware global de gestion des erreurs
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Log en développement pour débogage
  if (process.env.NODE_ENV !== "production") {
    console.error(colors.red(err.stack));
  }

  // Gestion des erreurs Mongoose
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Ressource non trouvée.";
  }

  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `La valeur '${err.keyValue[field]}' existe déjà pour le champ '${field}'.`;
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export { notFound, errorHandler };
