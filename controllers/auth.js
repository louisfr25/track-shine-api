import path from 'path';
import { db } from "../connect.js";
import bcrypt from "bcryptjs"; 
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
import crypto from 'crypto';
import { sendMail } from "./utils.js";
import { RegistrationEmail } from "../mailTemplates/mailTemplates.js";
dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL;


// Configuration CORS pour autoriser le frontend
const corsOptions = {
  origin: FRONTEND_URL,
  credentials: true,
};

export const register = async (req, res) => {
  try {
    // Vérifier si l'utilisateur existe déjà
    const q = "SELECT * FROM users WHERE email = ?";
    const [data] = await db.query(q, [req.body.email]);
    if (data.length) {
      return res.status(409).json("email already exists !");
    }

    // Créer un nouvel utilisateur
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(req.body.password, salt);

    const insertQuery = "INSERT INTO users (`firstName`, `lastName`, `email`, `password`, `phone`, `acceptTerms`, `acceptNewsletter`, `role`, `createdAt`) VALUES (?)";
    const values = [
      req.body.firstName,
      req.body.lastName,
      req.body.email,
      hashedPassword,
      req.body.phone,
      req.body.acceptTerms,
      req.body.acceptNewsletter,
      "default",
      new Date()
    ];

    // Insère l'utilisateur et récupère l'id
    const [result] = await db.query(insertQuery, [values]);
    const userId = result.insertId;

    const emailToken = crypto.randomBytes(32).toString("hex");
    await db.query("UPDATE users SET emailToken = ? WHERE id = ?", [emailToken, userId]);

    // Envoyer l'email de bienvenue avec le lien de confirmation
    const confirmLink = `${FRONTEND_URL}/confirm-email?token=${emailToken}`;
    // Le template RegistrationEmail renvoie du HTML (string). On construit
    // explicitement subject/html/text pour sendMail.
    const html = RegistrationEmail({ userName: req.body.firstName, userEmail: req.body.email, confirmLink });
    const subject = 'Bienvenue chez Racing Clean';
    const text = `Bonjour ${req.body.firstName},\n\nMerci pour votre inscription sur Racing Clean. Pour confirmer votre adresse e-mail, cliquez sur le lien suivant : ${confirmLink}\n\nSi vous n'avez pas demandé cet e-mail, ignorez-le.`;

    await sendMail({
      to: req.body.email,
      subject,
      html,
      text,
    });

    return res.status(200).json("User has been created.");
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json(err);
  }
};


export const login = async (req, res) => {
    const q = "SELECT * FROM users WHERE email = ?";
    try {
        const [data] = await db.query(q, [req.body.email]);
        if (data.length === 0) {
          return res.status(404).json("Utilisateur non trouvé !");
        }

        let user = data[0];

        const isPasswordCorrect = bcrypt.compareSync(req.body.password, user.password);
        if (!isPasswordCorrect) {
          return res.status(400).json("Mauvais mot de passe ou email !");
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
        const { password, ...other } = user;

        // Choix dynamique selon l'environnement
        const isProd = process.env.NODE_ENV === 'production';
        if (isProd) {
          // === PROD/HTTPS ===
          res.cookie("access_token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            domain: ""
          });
        } else {
          // === DEV/LOCAL ===
          res.cookie("access_token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax"
          });
        }

        return res.status(200).json(other);
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json(err);
    }
};

export const logout = async (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      // === PROD/HTTPS ===
      res.clearCookie("access_token", {
        sameSite: "none",
        secure: true,
        domain: ".example.com" // <-- À adapter à ton domaine prod
      }).status(200).json("Déconnecté avec succès");
    } else {
      // === DEV/LOCAL ===
      res.clearCookie("access_token", {
        sameSite: "lax",
        secure: false
      }).status(200).json("Déconnecté avec succès");
    }
}

export const getCurrentUser = async (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: "Non authentifié" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Récupérer uniquement les champs nécessaires (ne jamais renvoyer le password ni tokens)
    const [[user]] = await db.query(
      `SELECT id, firstName, lastName, email, phone, birthDate, photo, country, city, adress, postalCode, role, acceptTerms, acceptNewsletter, createdAt
       FROM users WHERE id = ?`,
      [decoded.id]
    );
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    // Normaliser la réponse côté API (évite d'exposer des champs inattendus)
    const safeUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || null,
      birthDate: user.birthDate || null,
      photo: user.photo || null,
      country: user.country || null,
      city: user.city || null,
      adress: user.adress || null,
      postalCode: user.postalCode || null,
      role: user.role || 'default',
      acceptTerms: !!user.acceptTerms,
      acceptNewsletter: !!user.acceptNewsletter,
      createdAt: user.createdAt || null
    };
    res.json(safeUser);
  } catch (err) {
    res.status(401).json({ error: "Token invalide" });
  }
};

// Modifier le profil utilisateur (profil + adresse)
export const updateProfile = async (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: "Non authentifié" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const {
      firstName,
      lastName,
      email,
      phone,
      birthDate,
      genre,
      adress,
      city,
      postalCode,
      country,
      description // Ajout pour les sellers
    } = req.body;

    const updateQuery = `UPDATE users SET firstName=?, lastName=?, email=?, phone=?, birthDate=?, genre=?, adress=?, city=?, postalCode=?, country=?, description=? WHERE id=?`;
    const values = [
      firstName,
      lastName,
      email,
      phone,
      birthDate && birthDate !== '' ? birthDate : null,
      genre,
      adress,
      city,
      postalCode && postalCode !== '' ? postalCode : null,
      country,
      description,
      userId
    ];
    await db.query(updateQuery, values);
    res.json({ message: "Profil mis à jour" });
  } catch (err) {
    console.error("[updateProfile] Erreur:", err);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  }
};

// POST /change-password : changer le mot de passe
export const changePassword = async (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: "Non authentifié" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const { currentPassword, newPassword } = req.body;
    // Vérifier l'ancien mot de passe
    const [[user]] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    const isPasswordCorrect = bcrypt.compareSync(currentPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ error: "Ancien mot de passe incorrect" });
    }
    // Hasher le nouveau mot de passe
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(newPassword, salt);
    await db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId]);
    res.json({ message: "Mot de passe modifié avec succès" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  }
};

// Upload photo de profil (même logique que produit)
export const updateProfilePhoto = async (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: "Non authentifié" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier reçu" });
    }
    // Use FTPS upload like product images
    const ext = path.extname(req.file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    // uploadBufferToFtp is defined in uploadToFtp.js
    const { uploadBufferToFtp } = await import('../middlewares/uploadToFtp.js');
    await uploadBufferToFtp(req.file.buffer, filename);
    const url = `${process.env.OWNSITE_BASE_URL || 'https://2livesupply.fr'}/uploads/${filename}`;
    await db.query("UPDATE users SET photo = ? WHERE id = ?", [url, userId]);
    res.status(200).json({ message: "Photo de profil mise à jour", photo: url });
  } catch (err) {
    console.error("Erreur upload photo profil:", err);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  }
};