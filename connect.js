import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const db = mysql.createPool({
  host: process.env.DB_HOST_DEVELOP,
  user: process.env.DB_USER_DEVELOP,
  password: process.env.DB_PASSWORD_DEVELOP,
  database: process.env.DB_NAME_DEVELOP,
  timezone: 'local',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '5', 10),
  queueLimit: 0,
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
});

// teste la connexion au démarrage (log utile)
db.getConnection()
  .then(conn => {
    console.log('Connexion MySQL réussie !');
    conn.release();
  })
  .catch(err => {
    console.error('Erreur de connexion MySQL :', err);
  });
