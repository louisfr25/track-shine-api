import express from 'express';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';
import { getAllBookings, getAllUsers, getAdminStats } from '../controllers/admin.js';

const router = express.Router();

// All admin endpoints require authentication + admin role
router.get('/bookings', authMiddleware, adminMiddleware, getAllBookings);
router.get('/users', authMiddleware, adminMiddleware, getAllUsers);
router.get('/stats', authMiddleware, adminMiddleware, getAdminStats);

export default router;
