/**
 * @typedef {Object} EmailTemplateData
 * @property {string} userName
 * @property {string} userEmail
 * @property {string} [confirmLink]
 * @property {string} [date]
 * @property {string} [time]
 * @property {string} [service]
 * @property {string} [vehicleType]
 * @property {string} [licensePlate]
 * @property {string} [price]
 * @property {string} [oldDate]
 * @property {string} [oldTime]
 * @property {string} [newDate]
 * @property {string} [newTime]
 */

const emailStyles = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&family=Playfair+Display:wght@700&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Montserrat', Arial, sans-serif;
      background-color: #0A0A0A;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background: linear-gradient(135deg, #0A0A0A 0%, #1F1F1F 100%);
      border: 2px solid rgba(255, 215, 0, 0.3);
      border-radius: 20px;
      overflow: hidden;
    }
    
    .email-header {
      background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%);
      padding: 40px 30px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .email-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(0, 0, 0, 0.05) 10px,
        rgba(0, 0, 0, 0.05) 20px
      );
      pointer-events: none;
    }
    
    .logo {
      font-family: 'Playfair Display', serif;
      font-size: 42px;
      font-weight: bold;
      color: #0A0A0A;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 3px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
      position: relative;
      z-index: 1;
    }
    
    .tagline {
      color: #0A0A0A;
      font-size: 14px;
      margin: 10px 0 0 0;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
    
    .email-body {
      padding: 40px 30px;
      color: #FFFFFF;
    }
    
    .greeting {
      font-size: 24px;
      color: #FFD700;
      margin: 0 0 20px 0;
      font-weight: 700;
    }
    
    .message {
      font-size: 16px;
      line-height: 1.8;
      color: #E0E0E0;
      margin: 0 0 30px 0;
    }
    
    .info-box {
      background: rgba(255, 215, 0, 0.1);
      border: 2px solid rgba(255, 215, 0, 0.3);
      border-radius: 12px;
      padding: 25px;
      margin: 30px 0;
      backdrop-filter: blur(10px);
    }
    
    .info-title {
      font-family: 'Playfair Display', serif;
      font-size: 20px;
      color: #FFD700;
      margin: 0 0 20px 0;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 215, 0, 0.2);
    }
    
    .info-row:last-child {
      border-bottom: none;
    }
    
    .info-label {
      color: #B0B0B0;
      font-size: 14px;
      font-weight: 500;
    }
    
    .info-value {
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 700;
      text-align: right;
    }
    
    .price-highlight {
      background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%);
      color: #0A0A0A;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      margin: 30px 0;
      box-shadow: 0 8px 20px rgba(255, 215, 0, 0.3);
    }
    
    .price-label {
      font-size: 14px;
      font-weight: 500;
      margin: 0 0 5px 0;
    }
    
    .price-value {
      font-family: 'Playfair Display', serif;
      font-size: 36px;
      font-weight: 700;
      margin: 0;
    }
    
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%);
      color: #0A0A0A;
      text-decoration: none;
      padding: 15px 40px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 16px;
      text-align: center;
      box-shadow: 0 8px 20px rgba(255, 215, 0, 0.3);
      margin: 20px 0;
      transition: all 0.3s;
    }
    
    .divider {
      height: 2px;
      background: linear-gradient(90deg, transparent, #FFD700, transparent);
      margin: 30px 0;
    }
    
    .email-footer {
      background: #0A0A0A;
      padding: 30px;
      text-align: center;
      border-top: 2px solid rgba(255, 215, 0, 0.3);
    }
    
    .footer-text {
      color: #808080;
      font-size: 12px;
      line-height: 1.6;
      margin: 10px 0;
    }
    
    .social-links {
      margin: 20px 0;
    }
    
    .social-links a {
      color: #FFD700;
      text-decoration: none;
      margin: 0 10px;
      font-size: 14px;
    }
    
    .change-box {
      background: rgba(255, 100, 100, 0.1);
      border: 2px solid rgba(255, 100, 100, 0.3);
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    
    .change-label {
      color: #FF6464;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      margin: 0 0 5px 0;
    }
    
    .change-value {
      color: #FFFFFF;
      font-size: 14px;
      margin: 0;
    }
    
    .new-box {
      background: rgba(100, 255, 100, 0.1);
      border: 2px solid rgba(100, 255, 100, 0.3);
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    
    .new-label {
      color: #64FF64;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      margin: 0 0 5px 0;
    }
    
    .new-value {
      color: #FFFFFF;
      font-size: 14px;
      margin: 0;
    }
  </style>
`;

/**
 * @param {EmailTemplateData} data
 * @returns {string}
 */
export function RegistrationEmail(data) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenue chez Racing Clean</title>
      ${emailStyles}
    </head>
    <body>
      <div class="email-container">
        <!-- Header -->
        <div class="email-header">
          <h1 class="logo">Racing Clean</h1>
          <p class="tagline">Excellence & Performance</p>
        </div>
        
        <!-- Body -->
        <div class="email-body">
          <h2 class="greeting">Bienvenue ${data.userName} ! 🏁</h2>
          
          <p class="message">
            Nous sommes ravis de vous accueillir parmi nos clients premium ! Votre compte Racing Clean a été créé avec succès.
          </p>
          
          <div class="info-box">
            <h3 class="info-title">Vos Informations</h3>
            <div class="info-row">
              <span class="info-label">Nom</span>
              <span class="info-value">${data.userName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email</span>
              <span class="info-value">${data.userEmail}</span>
            </div>
          </div>
          
          <p class="message">
            Vous pouvez maintenant réserver nos services de nettoyage automobile premium. Nos experts sont prêts à redonner à votre véhicule tout son éclat !
          </p>
          
          <div style="text-align: center;">
            <a href="${data.confirmLink || '#'}" class="cta-button" target="_blank" rel="noopener noreferrer">Confirmer mon e-mail</a>
          </div>
          ${data.confirmLink ? `
          <p class="message" style="font-size:14px; color:#B0B0B0; text-align:center; margin-top:12px;">
            Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur : <a href="${data.confirmLink}" style="color:#FFD700;">${data.confirmLink}</a>
          </p>
          ` : ''}
          
          <div class="divider"></div>
          
          <p class="message" style="font-size: 14px; color: #B0B0B0;">
            <strong>Ce que vous obtenez :</strong><br>
            ✓ Accès à toutes nos formules de nettoyage<br>
            ✓ Historique de vos rendez-vous<br>
            ✓ Gestion simplifiée de vos réservations<br>
            ✓ Offres exclusives réservées aux membres
          </p>
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
          <p class="footer-text">
            <strong>Racing Clean</strong><br>
            Excellence en nettoyage automobile depuis 2020
          </p>
          <div class="social-links">
            <a href="#">Facebook</a> | 
            <a href="#">Instagram</a> | 
            <a href="#">Twitter</a>
          </div>
          <p class="footer-text">
            © 2024 Racing Clean. Tous droits réservés.<br>
            Cet email a été envoyé à ${data.userEmail}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * @param {EmailTemplateData} data
 * @returns {string}
 */
export function BookingConfirmationEmail(data) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Réservation Confirmée - Racing Clean</title>
      ${emailStyles}
    </head>
    <body>
      <div class="email-container">
        <!-- Header -->
        <div class="email-header">
          <h1 class="logo">Racing Clean</h1>
          <p class="tagline">Excellence & Performance</p>
        </div>
        
        <!-- Body -->
        <div class="email-body">
          <h2 class="greeting">Réservation Confirmée ! ✅</h2>
          
          <p class="message">
            Bonjour ${data.userName},<br><br>
            Nous avons le plaisir de confirmer votre rendez-vous chez Racing Clean. Notre équipe d'experts prendra soin de votre véhicule avec la plus grande attention.
          </p>
          
          <div class="info-box">
            <h3 class="info-title">Détails du Rendez-vous</h3>
            <div class="info-row">
              <span class="info-label">Service</span>
              <span class="info-value">${data.service}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date</span>
              <span class="info-value">${data.date}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Heure</span>
              <span class="info-value">${data.time}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Véhicule</span>
              <span class="info-value">${data.vehicleType}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Plaque d'immatriculation</span>
              <span class="info-value">${data.licensePlate}</span>
            </div>
          </div>
          
          <div class="price-highlight">
            <p class="price-label">Tarif Total</p>
            <p class="price-value">${data.price}</p>
          </div>
          
          <div class="divider"></div>
          
          <p class="message" style="font-size: 14px; color: #B0B0B0;">
            <strong>À savoir avant votre rendez-vous :</strong><br>
            • Arrivez 5 minutes avant l'heure prévue<br>
            • Assurez-vous que votre véhicule est accessible<br>
            • Retirez vos objets de valeur avant le service<br>
            • Le paiement s'effectue sur place (CB, espèces)
          </p>
          
          <p class="message" style="font-size: 14px; color: #FFD700; text-align: center;">
            <strong>Besoin de modifier ou annuler ?</strong><br>
            Connectez-vous à votre compte pour gérer vos rendez-vous.
          </p>
          
          <div style="text-align: center;">
            <a href="#" class="cta-button">Voir Mon Compte</a>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
          <p class="footer-text">
            <strong>Racing Clean</strong><br>
            Excellence en nettoyage automobile depuis 2020
          </p>
          <div class="social-links">
            <a href="#">Facebook</a> | 
            <a href="#">Instagram</a> | 
            <a href="#">Twitter</a>
          </div>
          <p class="footer-text">
            © 2024 Racing Clean. Tous droits réservés.<br>
            Cet email a été envoyé à ${data.userEmail}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * @param {EmailTemplateData} data
 * @returns {string}
 */
export function BookingModificationEmail(data) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rendez-vous Modifié - Racing Clean</title>
      ${emailStyles}
    </head>
    <body>
      <div class="email-container">
        <!-- Header -->
        <div class="email-header">
          <h1 class="logo">Racing Clean</h1>
          <p class="tagline">Excellence & Performance</p>
        </div>
        
        <!-- Body -->
        <div class="email-body">
          <h2 class="greeting">Rendez-vous Modifié ! 🔄</h2>
          
          <p class="message">
            Bonjour ${data.userName},<br><br>
            Votre rendez-vous chez Racing Clean a été modifié avec succès. Voici les nouvelles informations.
          </p>
          
          <div class="info-box">
            <h3 class="info-title">Informations du Service</h3>
            <div class="info-row">
              <span class="info-label">Service</span>
              <span class="info-value">${data.service}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Véhicule</span>
              <span class="info-value">${data.vehicleType}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Plaque d'immatriculation</span>
              <span class="info-value">${data.licensePlate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Tarif</span>
              <span class="info-value">${data.price}</span>
            </div>
          </div>
          
          <div style="margin: 30px 0;">
            <div class="change-box">
              <p class="change-label">⚠️ Ancien Rendez-vous</p>
              <p class="change-value">
                <strong>Date :</strong> ${data.oldDate}<br>
                <strong>Heure :</strong> ${data.oldTime}
              </p>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
              <div style="display: inline-block; width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #FFD700, #FFC700); display: flex; align-items: center; justify-content: center; font-size: 24px;">
                ↓
              </div>
            </div>
            
            <div class="new-box">
              <p class="new-label">✓ Nouveau Rendez-vous</p>
              <p class="new-value">
                <strong>Date :</strong> ${data.newDate}<br>
                <strong>Heure :</strong> ${data.newTime}
              </p>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <p class="message" style="font-size: 14px; color: #B0B0B0; text-align: center;">
            <strong>N'oubliez pas :</strong><br>
            Notez bien votre nouvelle date et heure de rendez-vous !
          </p>
          
          <div style="text-align: center;">
            <a href="#" class="cta-button">Voir Mon Compte</a>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
          <p class="footer-text">
            <strong>Racing Clean</strong><br>
            Excellence en nettoyage automobile depuis 2020
          </p>
          <div class="social-links">
            <a href="#">Facebook</a> | 
            <a href="#">Instagram</a> | 
            <a href="#">Twitter</a>
          </div>
          <p class="footer-text">
            © 2024 Racing Clean. Tous droits réservés.<br>
            Cet email a été envoyé à ${data.userEmail}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}