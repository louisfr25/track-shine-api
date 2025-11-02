import express from 'express';
import { getAvailability } from '../controllers/availability.js';

const router = express.Router();

// Public availability endpoint
router.get('/', getAvailability);

export default router;
