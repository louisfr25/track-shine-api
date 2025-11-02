
import { db } from '../connect.js';
import { sendMail } from './utils.js';

// Supprimer un rendez-vous
export const deleteAppointment = async (req, res) => {
	try {
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ error: 'ID manquant' });
		}
		// Récupérer le rendez-vous pour notifier le client avant suppression
		const [[appointment]] = await db.query('SELECT * FROM appointments WHERE id = ? LIMIT 1', [id]);
		if (!appointment) {
			return res.status(404).json({ error: 'Rendez-vous non trouvé' });
		}
		// Envoi d'un mail d'annulation au client si possible
		try {
			const clientEmail = appointment.clientEmail;
			const clientName = appointment.clientName;
			const dateTime = appointment.appointmentDate;
			if (clientEmail) {
				const subject = `Votre rendez‑vous (${appointment.id}) a été annulé`;
				const text = `Bonjour ${clientName || ''},\n\nVotre rendez‑vous prévu le ${dateTime} a été annulé. Si vous souhaitez reprogrammer, rendez‑vous sur ${process.env.FRONTEND_URL || ''}`;
				await sendMail({ to: clientEmail, subject, text });
				console.log('Appointment cancellation mail sent to', clientEmail);
			}
		} catch (mailErr) {
			console.error('Erreur envoi mail annulation rendez-vous:', mailErr && mailErr.message ? mailErr.message : mailErr);
		}
		// Supprimer le rendez-vous
		const sql = 'DELETE FROM appointments WHERE id = ?';
		const [result] = await db.query(sql, [id]);
		res.status(200).json({ message: 'Rendez-vous supprimé avec succès' });
	} catch (err) {
		console.error('Erreur suppression rendez-vous:', err);
		res.status(500).json({ error: "Erreur lors de la suppression du rendez-vous" });
	}
};

// Créer un rendez-vous
export const createAppointment = async (req, res) => {
	try {
		const { clientName, clientEmail, type, appointmentDate, notes } = req.body;
		if (!clientName || !clientEmail || !type || !appointmentDate) {
			return res.status(400).json({ error: 'Champs obligatoires manquants' });
		}

		// Vérifier s'il existe déjà un rendez-vous à cette date/heure
		const checkSql = `SELECT COUNT(*) as count FROM appointments WHERE appointmentDate = ?`;
		const [rows] = await db.query(checkSql, [appointmentDate]);
		if (rows[0].count > 0) {
			return res.status(409).json({ error: 'Ce créneau est déjà réservé.' });
		}

		// Récupérer le sellerId depuis l'utilisateur connecté
		const sellerId = req.user?.sellerId || req.user?.id;
		if (!sellerId) {
			return res.status(401).json({ error: "Non autorisé : sellerId manquant" });
		}
		const sql = `INSERT INTO appointments (clientName, clientEmail, appointmentTypeId, appointmentDate, notes, status, sellerId) VALUES (?, ?, ?, ?, ?, ?, ?)`;
		const values = [clientName, clientEmail, type, appointmentDate, notes || null, 'en-attente', sellerId];
		await db.query(sql, values);
		res.status(201).json({ message: 'Rendez-vous créé avec succès' });
	} catch (err) {
		console.error('Erreur création rendez-vous:', err);
		res.status(500).json({ error: "Erreur lors de la création du rendez-vous" });
	}
};

// Récupérer tous les rendez-vous
export const getAppointments = async (req, res) => {
	try {
		const sellerId = req.user?.sellerId || req.user?.id; 
		if (!sellerId) {
			return res.status(401).json({ error: "Non autorisé : sellerId manquant" });
		}
		// Jointure pour récupérer le phone du client
		const sql = `SELECT a.*, u.phone as phone FROM appointments a LEFT JOIN users u ON a.clientEmail = u.email WHERE a.sellerId = ? ORDER BY a.appointmentDate DESC`;
		const [rows] = await db.query(sql, [sellerId]);
		// Format appointmentDate as local time string
		const formattedRows = rows.map(r => ({
			...r,
			appointmentDate: r.appointmentDate instanceof Date
				? `${r.appointmentDate.getFullYear()}-${String(r.appointmentDate.getMonth() + 1).padStart(2, '0')}-${String(r.appointmentDate.getDate()).padStart(2, '0')} ${String(r.appointmentDate.getHours()).padStart(2, '0')}:${String(r.appointmentDate.getMinutes()).padStart(2, '0')}:00`
				: r.appointmentDate
		}));
		res.status(200).json(formattedRows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Erreur lors de la récupération des rendez-vous" });
	}
};

// Mettre à jour le statut d'un rendez-vous
export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'ID ou statut manquant' });
    }
    const sql = 'UPDATE appointments SET status = ? WHERE id = ?';
    await db.query(sql, [status, id]);
	// After updating status, fetch the appointment to send a notification if needed
	try {
		const [[appointment]] = await db.query('SELECT * FROM appointments WHERE id = ?', [id]);
		if (appointment) {
			const clientEmail = appointment.clientEmail;
			const clientName = appointment.clientName;
				const rawDate = appointment.appointmentDate;
				// Format date pour le mail (locale FR)
				const dateTime = rawDate && new Date(rawDate) instanceof Date
					? new Date(rawDate).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
					: rawDate;
				const location = appointment.location || '';
				// Récupérer advisorName via sellerId si présent
				let advisorName = '';
				try {
					if (appointment.sellerId) {
						const [sellerRows] = await db.query('SELECT firstName, lastName FROM users WHERE id = ? LIMIT 1', [appointment.sellerId]);
						if (sellerRows.length) {
							const s = sellerRows[0];
							advisorName = [s.firstName, s.lastName].filter(Boolean).join(' ');
						}
					}
				} catch (e) {
					console.warn('Impossible de récupérer le nom du vendeur pour l\'email de statut:', e && e.message ? e.message : e);
				}
			const appointmentId = appointment.id;

			if (['confirmed', 'valid', 'accepted'].includes(status)) {
				try {
						console.log('Sending appointment confirmation mail', { to: clientEmail, subject: mail.subject });
						const info = await sendMail({ to: clientEmail, subject: mail.subject, html: mail.html, text: mail.text });
						console.log('Appointment confirmation mail result:', info && (info.statusCode || info));
				} catch (e) {
					console.error('Failed to send appointment confirmation mail:', e && e.message ? e.message : e);
				}
			} else if (status === 'cancelled' || status === 'refused') {
				// Simple cancellation text
				const subject = `Votre rendez‑vous (${appointmentId}) a été annulé`;
				const text = `Bonjour ${clientName || ''},\n\nVotre rendez‑vous prévu le ${dateTime} a été annulé. Si vous souhaitez reprogrammer, rendez‑vous sur ${process.env.FRONTEND_URL || ''}`;
				try {
						console.log('Sending appointment cancellation mail', { to: clientEmail, subject });
						const info = await sendMail({ to: clientEmail, subject, text });
						console.log('Appointment cancellation mail result:', info && (info.statusCode || info));
				} catch (e) {
					console.error('Failed to send appointment cancellation mail:', e && e.message ? e.message : e);
				}
			}
		}
	} catch (e) {
		console.error('Could not fetch appointment after update to send mail:', e && e.message ? e.message : e);
	}
    res.status(200).json({ message: 'Statut du rendez-vous mis à jour' });
  } catch (err) {
    console.error('Erreur update statut rendez-vous:', err);
    res.status(500).json({ error: "Erreur lors de la mise à jour du statut" });
  }
};

export const getMyAppointments = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Non autorisé : userId manquant" });
        }
        const [rowsMail] = await db.query(`SELECT email FROM users WHERE id = ?`, [userId]);
		const email = rowsMail[0]?.email;
        const sql = `SELECT * FROM appointments WHERE clientEmail = ? ORDER BY appointmentDate DESC`;
        const [rows] = await db.query(sql, [email]);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Erreur récupération mes rendez-vous:', err);
        res.status(500).json({ error: "Erreur lors de la récupération des rendez-vous" });
    }
};