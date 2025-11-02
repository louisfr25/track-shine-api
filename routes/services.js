import express from 'express';
import { getServices, getService } from '../controllers/services.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// Public: list services
router.get('/', getServices);

// Public: get single
router.get('/:id', getService);

export default router;
