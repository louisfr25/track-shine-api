// Ensure environment variables from .env are loaded before any other module imports
import 'dotenv/config';
import express from 'express';
import { db } from './connect.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import appointment from './routes/appointment.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/booking.js';
import servicesRoutes from './routes/services.js';
import availabilityRoutes from './routes/availability.js';
import adminRoutes from './routes/admin.js';

const FRONTEND_URL = process.env.FRONTEND_URL;

const app = express();
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "https://2livesupply.fr", // Domaine de production
  process.env.FRONTEND_URL // Permet de configurer dynamiquement
].filter(Boolean);

// Strict CORS: only allow requests that include an Origin header and
// whose origin is in our allowlist. This will block Postman / curl requests
// that don't send Origin. Preflight OPTIONS are handled via app.options.
const corsOptions = {
  origin(origin, callback) {
    // require an origin and verify it's in the allowlist
    if (!origin) return callback(new Error('Missing Origin'));
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// Ensure caches vary by Origin
app.use((req, res, next) => {
  res.setHeader('Vary', 'Origin');
  next();
});

app.use(cors(corsOptions));
// Handle preflight OPTIONS requests centrally without registering a path pattern
// (some path parsers reject '*' or '/*' tokens). This returns 204 for OPTIONS.
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Convert CORS callback errors into 403 responses for clarity
app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.message === 'Not allowed by CORS' || err.message === 'Missing Origin') {
    return res.status(403).send('Not allowed by CORS');
  }
  return next(err);
});

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointment);
app.use('/api/bookings', bookingRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/admin', adminRoutes);

const port = process.env.PORT || 8800;
app.listen(port, () => {
  console.log('Server running on port', port);
});

// Periodic MySQL pings with lightweight IP fetch and retry/backoff.
const sleep = ms => new Promise(r => setTimeout(r, ms));
let outboundIp = null;
(async () => {
  const fetchIp = async () => {
    try {
      const j = await (await fetch('https://api.ipify.org?format=json')).json();
      outboundIp = j.ip;
      console.log('Outbound IP detected:', outboundIp);
    } catch (e) {
      console.warn('Could not fetch outbound IP:', e?.message ?? e);
    }
  };

  // initial + periodic IP refresh
  await fetchIp();
  setInterval(fetchIp, 10 * 60 * 1000);

  const ping = async (retries = 3) => {
    for (let i = 1; i <= retries; i++) {
      try {
        const start = Date.now();
        await db.query('SELECT 1');
        console.log(`Ping MySQL OK (attempt ${i}) - ${Date.now() - start}ms`);
        return;
      } catch (err) {
        const code = err?.code ?? err?.errno ?? err?.message;
        console.warn(`${new Date().toISOString()} - Ping MySQL failed (attempt ${i}) from outbound IP ${outboundIp}:`, code, err?.message ?? err);
        if (i < retries) await sleep(1000 * i);
        else console.error(`${new Date().toISOString()} - Ping MySQL ultimately failed after ${retries} attempts`);
      }
    }
  };

  // run immediately and every 5 minutes
  ping(3).catch(e => console.error('Unexpected ping error:', e));
  setInterval(() => ping(3).catch(e => console.error('Unexpected ping error:', e)), 300 * 1000);
})();
