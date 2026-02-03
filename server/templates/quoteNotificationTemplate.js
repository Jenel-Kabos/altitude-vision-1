// templates/quoteNotificationTemplate.js

// Fonction simple pour échapper les caractères HTML
const escapeHTML = (str) =>
  str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      }[tag] || tag)
  );

// Email envoyé à l'agence pour notifier d'une nouvelle demande
export const adminNotificationEmail = (quote) => {
  const servicesList = quote.services
    .map(
      (service) =>
        `<li>${escapeHTML(service.name)} - ${new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'XAF',
        }).format(service.price)}</li>`
    )
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
        <p><strong>Client :</strong> ${escapeHTML(quote.clientName)}</p>
        <p><strong>Email du client :</strong> <a href="mailto:${escapeHTML(
          quote.clientEmail
        )}">${escapeHTML(quote.clientEmail)}</a></p>
        <hr>
        <h3>Détails de la demande :</h3>
        <ul>${servicesList}</ul>
        <h3>Total Préliminaire : ${new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'XAF',
        }).format(quote.totalPrice)}</h3>
        <hr>
        <p>Veuillez contacter le client rapidement pour finaliser le devis.</p>
      </div>
    </body>
    </html>
  `;
};

// Email de confirmation envoyé au client
export const clientConfirmationEmail = (quote) => {
  const servicesList = quote.services
    .map(
      (service) =>
        `<li>${escapeHTML(service.name)} - ${new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'XAF',
        }).format(service.price)}</li>`
    )
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
        <p>Bonjour ${escapeHTML(quote.clientName)},</p>
        <p>Nous avons bien reçu votre demande de devis et nous vous remercions de votre confiance.</p>
        <p><strong>Voici un résumé de votre sélection :</strong></p>
        <ul>${servicesList}</ul>
        <p><strong>Total Préliminaire : ${new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'XAF',
        }).format(quote.totalPrice)}</strong></p>
        <hr>
        <p>Un membre de notre équipe vous contactera dans les plus brefs délais.</p>
        <p>Cordialement,<br>L'équipe Altitude-Vision</p>
      </div>
    </body>
    </html>
  `;
};