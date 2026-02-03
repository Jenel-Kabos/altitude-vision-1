// C:\...\server\utils\appError.js

class AppError extends Error {
  constructor(message, statusCode) {
    super(message); // Appelle le constructeur de la classe parente (Error)

    this.statusCode = statusCode;
    // Détermine le statut en fonction du code HTTP
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    // Marque cette erreur comme "opérationnelle" (prévisible)
    this.isOperational = true;

    // Capture la "stack trace" pour le débogage, en excluant notre constructeur
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;