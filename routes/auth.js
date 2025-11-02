import express from 'express';
import { register, login, logout, getCurrentUser, updateProfile, updateProfilePhoto, changePassword } from '../controllers/auth.js';
import { authMiddleware } from '../middlewares/auth.js';
import { uploadFtp } from '../middlewares/uploadToFtp.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/change-password', authMiddleware, changePassword);
router.get('/me', getCurrentUser);
// Upload photo de profil (FTPS -> stored on o2switch)
router.post('/profile/photo', authMiddleware, uploadFtp.single('photo'), updateProfilePhoto);

export default router;
