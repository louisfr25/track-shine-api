import express from 'express';
import { createBooking, getBooking, updateBooking, deleteBooking, listBookings } from '../controllers/booking.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authMiddleware, createBooking);
router.get('/', authMiddleware, listBookings);
router.get('/:id', authMiddleware, getBooking);
router.put('/:id', authMiddleware, updateBooking);
router.delete('/:id', authMiddleware, deleteBooking);

export default router;