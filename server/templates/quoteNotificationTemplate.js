// Ce fichier exporte des fonctions qui génèrent le HTML de nos emails.

// Email envoyé à l'agence pour notifier d'une nouvelle demande
const adminNotificationEmail = (quote) => {
  // Affiche les services sélectionnés sous forme de liste HTML
  const servicesList = quote.services
    .map(service => `<li>${service.name} - ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(service.price)}</li>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        h1 { color: #1E3A8A; }
        strong { color: #1E3A8A; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Nouvelle Demande de Devis</h1>
        <p>Vous avez reçu une nouvelle demande de devis via le site Altitude-Vision.</p>
        <p><strong>Client :</strong> ${quote.clientName}</p>
        <p><strong>Email du client :</strong> <a href="mailto:${quote.clientEmail}">${quote.clientEmail}</a></p>
        <hr>
        <h3>Détails de la demande :</h3>
        <ul>${servicesList}</ul>
        <h3>Total Préliminaire : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(quote.totalPrice)}</h3>
        <hr>
        <p>Veuillez contacter le client rapidement pour finaliser le devis.</p>
      </div>
    </body>
    </html>
  `;
};

// Email de confirmation envoyé au client
const clientConfirmationEmail = (quote) => {
  const servicesList = quote.services
    .map(service => `<li>${service.name} - ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(service.price)}</li>`)
    .join('');
    
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        h1 { color: #F59E0B; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Confirmation de votre demande de devis</h1>
        <p>Bonjour ${quote.clientName},</p>
        <p>Nous avons bien reçu votre demande de devis pour un événement et nous vous remercions de votre confiance.</p>
        <p><strong>Voici un résumé de votre sélection :</strong></p>
        <ul>${servicesList}</ul>
        <p><strong>Total Préliminaire : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(quote.totalPrice)}</strong></p>
        <hr>
        <p>Un membre de notre équipe Mila Events vous contactera dans les plus brefs délais pour affiner les détails avec vous.</p>
        <p>Cordialement,<br>L'équipe Altitude-Vision</p>
      </div>
    </body>
    </html>
  `;
};

module.exports = { adminNotificationEmail, clientConfirmationEmail };