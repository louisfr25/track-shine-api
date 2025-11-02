import { db } from "../connect.js";
import dotenv from 'dotenv';
import { sendMail } from "./utils.js";
import { BookingConfirmationEmail, BookingModificationEmail } from "../mailTemplates/mailTemplates.js";
dotenv.config();

// Helper: format Date -> MySQL DATETIME (local timezone)
function toSqlDatetime(date) {
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  // build local YYYY-MM-DD HH:MM:SS to avoid UTC shift when storing DATETIME
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

// Controller exports: createBooking, getBooking, updateBooking, deleteBooking

export async function createBooking(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { serviceId, resourceId, startAt, notes, vehicleType, licensePlate } = req.body;
  if (!serviceId || !startAt) return res.status(400).json({ error: 'serviceId and startAt are required' });

  const start = new Date(startAt);
  if (isNaN(start.getTime())) return res.status(400).json({ error: 'Invalid startAt' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // load service
    const [svcRows] = await conn.query('SELECT id, duration_minutes, price FROM services WHERE id = ?', [serviceId]);
    if (!svcRows || svcRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Service not found' });
    }
    const duration = Number(svcRows[0].duration_minutes);
    const price = svcRows[0].price || 0;

    const end = new Date(start.getTime() + duration * 60000);
    const startSql = toSqlDatetime(start);
    const endSql = toSqlDatetime(end);

    // choose or lock resource
    let chosenResourceId = resourceId || null;
    let capacity = 1;
    if (chosenResourceId) {
      const [r] = await conn.query('SELECT id, capacity FROM resources WHERE id = ? FOR UPDATE', [chosenResourceId]);
      if (!r || r.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Resource not found' });
      }
      capacity = r[0].capacity || 1;
    } else {
      // pick first active resource and lock it
      const [r2] = await conn.query('SELECT id, capacity FROM resources WHERE active = 1 ORDER BY id LIMIT 1 FOR UPDATE');
      if (!r2 || r2.length === 0) {
        await conn.rollback();
        return res.status(500).json({ error: 'No available resource configured' });
      }
      chosenResourceId = r2[0].id;
      capacity = r2[0].capacity || 1;
    }

    // check overlapping bookings (lock matching rows)
    const [crows] = await conn.query(
      `SELECT COUNT(*) AS conflicts FROM bookings
       WHERE resource_id = ?
         AND status IN ('pending','confirmed')
         AND NOT (end_at <= ? OR start_at >= ?)
       FOR UPDATE`,
      [chosenResourceId, startSql, endSql]
    );
    const conflicts = Number(crows[0].conflicts || 0);
    if (conflicts >= capacity) {
      await conn.rollback();
      return res.status(409).json({ error: 'Slot not available' });
    }

      // Prepare insertion into bookings; include vehicle columns if they exist in bookings table
      // We'll detect which of the candidate vehicle columns exist and include them dynamically
      const baseCols = ['user_id','service_id','resource_id','start_at','end_at','duration_minutes','total_price','notes','status'];
      const basePlaceholders = ['?','?','?','?','?','?','?','?','?'];
      const values = [userId, serviceId, chosenResourceId, startSql, endSql, duration, price, notes || null, 'confirmed'];

      try {
        const candidateVehicleCols = [
          { name: 'vehicle_type', value: vehicleType },
          { name: 'license_plate', value: licensePlate },
          { name: 'vehicleType', value: vehicleType },
          { name: 'licensePlate', value: licensePlate }
        ];
        // query which of these columns exist on bookings
        const colNames = candidateVehicleCols.map(c => c.name);
        const placeholders = colNames.map(() => '?').join(',');
        const [colsRows] = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME IN (${placeholders})`,
          colNames
        );
        const existingCols = (colsRows || []).map(r => r.COLUMN_NAME);
        // for each candidate in order, if exists and a value provided, include it
        for (const cand of candidateVehicleCols) {
          if (existingCols.includes(cand.name) && cand.value !== undefined) {
            baseCols.push(cand.name);
            basePlaceholders.push('?');
            values.push(cand.value);
          }
        }
      } catch (err) {
        console.warn('Could not detect bookings vehicle columns:', err);
      }

    // insert booking (default to confirmed here; you can change to pending/payment flow)
    const insertSql = `INSERT INTO bookings (${baseCols.join(',')}) VALUES (${basePlaceholders.join(',')})`;
    const [ins] = await conn.query(insertSql, values);

    const bookingId = ins.insertId;
    await conn.commit();

    const [rows] = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    const booking = rows[0];

    // Try to send booking confirmation email (non-blocking)
    try {
      const [[user]] = await db.query('SELECT firstName, email FROM users WHERE id = ?', [userId]);
      const [[serviceRow]] = await db.query('SELECT title FROM services WHERE id = ?', [serviceId]);
      const startDate = new Date(start);
      const date = isNaN(startDate.getTime()) ? null : startDate.toLocaleDateString('fr-FR');
      const time = isNaN(startDate.getTime()) ? null : startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const emailData = {
        userName: (user && user.firstName) ? user.firstName : 'Client',
        userEmail: (user && user.email) ? user.email : null,
        date,
        time,
        service: serviceRow ? serviceRow.title : null,
        vehicleType: booking.vehicleType || booking.vehicle_type || null,
        licensePlate: booking.licensePlate || booking.license_plate || null,
        price: String(price || 0),
      };
      const html = BookingConfirmationEmail(emailData);
      const subject = 'Réservation confirmée - Racing Clean';
      const text = `Bonjour ${emailData.userName},\n\nVotre réservation pour ${emailData.service} le ${date} à ${time} a été confirmée.\n\nMerci.`;
      if (emailData.userEmail) {
        await sendMail({ to: emailData.userEmail, subject, html, text });
      }
    } catch (err) {
      console.error('Failed to send booking confirmation email:', err);
    }

    return res.status(201).json({ booking });
  } catch (err) {
    await conn.rollback();
    console.error('createBooking error', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
}

export async function getBooking(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const bookingId = Number(req.params.id);
  if (!bookingId) return res.status(400).json({ error: 'Invalid booking id' });

  try {
    const [rows] = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    // if owner allow, otherwise allow admin
    if (booking.user_id === userId) return res.json({ booking });

    // check role from users table
    const [urows] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (urows && urows.length > 0 && urows[0].role === 'admin') return res.json({ booking });

    return res.status(403).json({ error: 'Access denied' });
  } catch (err) {
    console.error('getBooking error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listBookings(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  try {
    // return bookings for the user, newest first; include service title
    const [rows] = await db.query(
      `SELECT b.*, s.title AS service_title
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       WHERE b.user_id = ?
       ORDER BY b.start_at DESC`,
      [userId]
    );
    // normalize vehicle fields so frontend can read either camelCase or snake_case
    const normalized = (rows || []).map(r => {
      return {
        ...r,
        vehicleType: r.vehicleType || r.vehicle_type || null,
        licensePlate: r.licensePlate || r.license_plate || null,
        service_title: r.service_title || r.title || null
      };
    });
    return res.json({ bookings: normalized });
  } catch (err) {
    console.error('listBookings error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateBooking(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const bookingId = Number(req.params.id);
  if (!bookingId) return res.status(400).json({ error: 'Invalid booking id' });

  // editable fields: status, notes, startAt, resourceId, serviceId, vehicleType, licensePlate
  const { status, notes, startAt, resourceId, serviceId, vehicleType, licensePlate } = req.body;
  if (!status && notes === undefined && startAt === undefined && resourceId === undefined && serviceId === undefined && vehicleType === undefined && licensePlate === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    // check if admin
    const [urows] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
    const role = (urows && urows[0]) ? urows[0].role : null;

    // security: do not allow modifying or cancelling past bookings for non-admins
    try {
      const bookingStart = booking.start_at ? new Date(booking.start_at) : null;
      const now = new Date();
      if (bookingStart && bookingStart <= now && role !== 'admin') {
        return res.status(400).json({ error: 'Cannot modify or cancel past bookings' });
      }
    } catch (e) {
      // ignore date parse errors and continue (other validations will catch issues)
    }

    // if changing status: validate owner/admin permissions
    if (status) {
      if (status === 'cancelled') {
        if (booking.user_id !== userId && role !== 'admin') {
          return res.status(403).json({ error: 'Only owner or admin can cancel' });
        }
      } else {
        // only admin can set other statuses
        if (role !== 'admin') return res.status(403).json({ error: 'Only admin can change status' });
      }
    }

    // If edit of time/resource/service requested, perform transactional check similar to createBooking
    const wantsReschedule = startAt !== undefined || resourceId !== undefined || serviceId !== undefined || vehicleType !== undefined || licensePlate !== undefined;
    if (wantsReschedule) {
      // Only owner or admin can reschedule
      if (booking.user_id !== userId && role !== 'admin') {
        return res.status(403).json({ error: 'Only owner or admin can modify this booking' });
      }

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        // determine new service/duration/price
        let newServiceId = serviceId !== undefined ? Number(serviceId) : booking.service_id;
        const [svcRows] = await conn.query('SELECT id, duration_minutes, price FROM services WHERE id = ?', [newServiceId]);
        if (!svcRows || svcRows.length === 0) {
          await conn.rollback();
          return res.status(404).json({ error: 'Service not found' });
        }
        const duration = Number(svcRows[0].duration_minutes);
        const price = svcRows[0].price || 0;

        const newStart = startAt ? new Date(startAt) : new Date(booking.start_at);
        if (isNaN(newStart.getTime())) {
          await conn.rollback();
          return res.status(400).json({ error: 'Invalid startAt' });
        }
        const newEnd = new Date(newStart.getTime() + duration * 60000);
        const newStartSql = toSqlDatetime(newStart);
        const newEndSql = toSqlDatetime(newEnd);

        // choose or lock resource
        let chosenResourceId = resourceId !== undefined ? resourceId : booking.resource_id;
        let capacity = 1;
        if (chosenResourceId) {
          const [r] = await conn.query('SELECT id, capacity FROM resources WHERE id = ? FOR UPDATE', [chosenResourceId]);
          if (!r || r.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Resource not found' });
          }
          capacity = r[0].capacity || 1;
        } else {
          // pick first active resource and lock it
          const [r2] = await conn.query('SELECT id, capacity FROM resources WHERE active = 1 ORDER BY id LIMIT 1 FOR UPDATE');
          if (!r2 || r2.length === 0) {
            await conn.rollback();
            return res.status(500).json({ error: 'No available resource configured' });
          }
          chosenResourceId = r2[0].id;
          capacity = r2[0].capacity || 1;
        }

        // check overlapping bookings excluding the current booking
        const [crows] = await conn.query(
          `SELECT COUNT(*) AS conflicts FROM bookings
           WHERE resource_id = ?
             AND id != ?
             AND status IN ('pending','confirmed')
             AND NOT (end_at <= ? OR start_at >= ?)
           FOR UPDATE`,
          [chosenResourceId, bookingId, newStartSql, newEndSql]
        );
        const conflicts = Number(crows[0].conflicts || 0);
        if (conflicts >= capacity) {
          await conn.rollback();
          return res.status(409).json({ error: 'Slot not available' });
        }

        // build update
        const updates = [];
        const params = [];
        updates.push('start_at = ?'); params.push(newStartSql);
        updates.push('end_at = ?'); params.push(newEndSql);
        updates.push('resource_id = ?'); params.push(chosenResourceId);
        updates.push('service_id = ?'); params.push(newServiceId);
        updates.push('duration_minutes = ?'); params.push(duration);
        updates.push('total_price = ?'); params.push(price);

        // detect which vehicle columns exist in bookings table and only include those
        try {
          const candidateVehicleCols = [
            { name: 'vehicle_type', value: vehicleType },
            { name: 'license_plate', value: licensePlate },
            { name: 'vehicleType', value: vehicleType },
            { name: 'licensePlate', value: licensePlate }
          ];
          const colNames = candidateVehicleCols.map(c => c.name);
          const placeholders = colNames.map(() => '?').join(',');
          const [colsRows] = await conn.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME IN (${placeholders})`,
            colNames
          );
          const existingCols = (colsRows || []).map(r => r.COLUMN_NAME);
          for (const cand of candidateVehicleCols) {
            if (existingCols.includes(cand.name) && cand.value !== undefined) {
              updates.push(`\`${cand.name}\` = ?`);
              params.push(cand.value);
            }
          }
        } catch (err) {
          // if detection fails, skip vehicle fields to avoid breaking the update
          console.warn('Could not detect bookings vehicle columns for update:', err);
        }

        if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
        if (status) {
          updates.push('status = ?'); params.push(status);
          if (status === 'cancelled') {
            updates.push('canceled_by = ?'); params.push(userId);
            updates.push('canceled_at = ?'); params.push(toSqlDatetime(new Date()));
          }
        }

        params.push(bookingId);
        const sql = `UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`;
        await conn.query(sql, params);
        await conn.commit();
        const [updated] = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
        const updatedBooking = updated[0];

        // Send booking modification email (non-blocking)
        try {
          const [[user]] = await db.query('SELECT firstName, email FROM users WHERE id = ?', [booking.user_id]);
          const [[serviceRow]] = await db.query('SELECT title FROM services WHERE id = ?', [newServiceId]);
          const oldStart = booking.start_at ? new Date(booking.start_at) : null;
          const newStartDate = newStart ? new Date(newStart) : null;
          const emailData = {
            userName: (user && user.firstName) ? user.firstName : 'Client',
            userEmail: (user && user.email) ? user.email : null,
            service: serviceRow ? serviceRow.title : null,
            vehicleType: updatedBooking.vehicleType || updatedBooking.vehicle_type || null,
            licensePlate: updatedBooking.licensePlate || updatedBooking.license_plate || null,
            price: String(price || 0),
            oldDate: oldStart ? oldStart.toLocaleDateString('fr-FR') : null,
            oldTime: oldStart ? oldStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null,
            newDate: newStartDate ? newStartDate.toLocaleDateString('fr-FR') : null,
            newTime: newStartDate ? newStartDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null,
          };
          const html = BookingModificationEmail(emailData);
          const subject = 'Réservation modifiée - Racing Clean';
          const text = `Bonjour ${emailData.userName},\n\nVotre réservation a été modifiée.`;
          if (emailData.userEmail) {
            await sendMail({ to: emailData.userEmail, subject, html, text });
          }
        } catch (err) {
          console.error('Failed to send booking modification email (reschedule):', err);
        }

        return res.json({ booking: updatedBooking });
      } catch (err) {
        await conn.rollback();
        console.error('reschedule updateBooking error', err);
        return res.status(500).json({ error: 'Internal server error' });
      } finally {
        try { conn.release(); } catch (e) {}
      }
    }

    // perform update for status/notes only (no reschedule)
    const updates = [];
    const params = [];
    if (status) {
      updates.push('status = ?'); params.push(status);
      if (status === 'cancelled') {
        updates.push('canceled_by = ?'); params.push(userId);
        updates.push('canceled_at = ?'); params.push(toSqlDatetime(new Date()));
      }
    }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    params.push(bookingId);
    const sql = `UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`;
    await db.query(sql, params);

    const [updated] = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    const updatedBooking = updated[0];

    // If a status change (or notes-only change) occurred, notify the user
    if (status) {
      try {
        const [[user]] = await db.query('SELECT firstName, email FROM users WHERE id = ?', [booking.user_id]);
        const [[serviceRow]] = await db.query('SELECT title FROM services WHERE id = ?', [updatedBooking.service_id]);
        const oldStart = booking.start_at ? new Date(booking.start_at) : null;
        const newStart = updatedBooking.start_at ? new Date(updatedBooking.start_at) : null;
        const emailData = {
          userName: (user && user.firstName) ? user.firstName : 'Client',
          userEmail: (user && user.email) ? user.email : null,
          service: serviceRow ? serviceRow.title : null,
          vehicleType: updatedBooking.vehicleType || updatedBooking.vehicle_type || null,
          licensePlate: updatedBooking.licensePlate || updatedBooking.license_plate || null,
          price: String(updatedBooking.total_price || 0),
          oldDate: oldStart ? oldStart.toLocaleDateString('fr-FR') : null,
          oldTime: oldStart ? oldStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null,
          newDate: newStart ? newStart.toLocaleDateString('fr-FR') : null,
          newTime: newStart ? newStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null,
        };
        const html = BookingModificationEmail(emailData);
        const subject = status === 'cancelled' ? 'Réservation annulée - Racing Clean' : 'Réservation modifiée - Racing Clean';
        const text = `Bonjour ${emailData.userName},\n\nVotre réservation a été mise à jour.`;
        if (emailData.userEmail) {
          await sendMail({ to: emailData.userEmail, subject, html, text });
        }
      } catch (err) {
        console.error('Failed to send booking modification email (status update):', err);
      }
    }

    return res.json({ booking: updatedBooking });
  } catch (err) {
    console.error('updateBooking error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteBooking(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const bookingId = Number(req.params.id);
  if (!bookingId) return res.status(400).json({ error: 'Invalid booking id' });

  try {
    // fetch booking
    const [rows] = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    // get role
    const [urows] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
    const role = (urows && urows[0]) ? urows[0].role : null;

    // only owner or admin can delete
    if (booking.user_id !== userId && role !== 'admin') {
      return res.status(403).json({ error: 'Only owner or admin can delete this booking' });
    }

    // security: non-admins cannot delete past bookings
    try {
      const bookingStart = booking.start_at ? new Date(booking.start_at) : null;
      const now = new Date();
      if (bookingStart && bookingStart <= now && role !== 'admin') {
        return res.status(400).json({ error: 'Cannot delete past bookings' });
      }
    } catch (e) {
      // ignore parse errors
    }

    await db.query('DELETE FROM bookings WHERE id = ?', [bookingId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteBooking error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

