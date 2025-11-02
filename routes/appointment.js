import express from 'express';
import { createAppointment, getAppointments, deleteAppointment, updateAppointmentStatus, getMyAppointments} from '../controllers/appointment.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();
// Supprimer un rendez-vous
router.delete('/delete/:id', deleteAppointment);


// Créer un rendez-vous
router.post('/createAppointment', createAppointment);
// Récupérer tous les rendez-vous
router.get('/all', authMiddleware, getAppointments);
// Récupérer tous les rendez-vous de l'utilisateur connecté
router.get('/my', authMiddleware, getMyAppointments);

// Mettre à jour le statut d'un rendez-vous
router.put('/updateStatus/:id', updateAppointmentStatus);

export default router;