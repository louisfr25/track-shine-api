import { db } from '../connect.js';

// Helper: create Date from yyyy-mm-dd and HH:MM:SS in local time
function makeDateTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm, ss] = (timeStr || '00:00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
}

// check overlap between [aStart,aEnd) and [bStart,bEnd)
function overlap(aStart, aEnd, bStart, bEnd) {
  return !(aEnd <= bStart || aStart >= bEnd);
}

// Generate slots for a single range and resource
function generateSlotsForRange(rangeStart, rangeEnd, durationMinutes, stepMinutes, existingBookings) {
  const slots = [];
  let cur = new Date(rangeStart.getTime());
  const durMs = durationMinutes * 60000;
  const stepMs = stepMinutes * 60000;
  while (cur.getTime() + durMs <= rangeEnd.getTime()) {
    const candidateEnd = new Date(cur.getTime() + durMs);
    const conflict = existingBookings.some(b => overlap(cur, candidateEnd, new Date(b.start_at), new Date(b.end_at)));
    if (!conflict) slots.push({ startAt: new Date(cur), endAt: candidateEnd });
    cur = new Date(cur.getTime() + stepMs);
  }
  return slots;
}

export async function getAvailability(req, res) {
  try {
    const date = req.query.date; // YYYY-MM-DD
    const serviceId = Number(req.query.serviceId || req.query.service_id);
    const resourceId = req.query.resourceId ? Number(req.query.resourceId) : null;
    const step = Number(req.query.step || req.query.stepMinutes || 30);

    if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date (YYYY-MM-DD required)' });
    if (!serviceId) return res.status(400).json({ error: 'serviceId required' });

    // load service duration
    const [svcRows] = await db.query('SELECT id, duration_minutes FROM services WHERE id = ?', [serviceId]);
    if (!svcRows || svcRows.length === 0) return res.status(404).json({ error: 'Service not found' });
    const duration = Number(svcRows[0].duration_minutes);

  const dt = new Date(date + 'T00:00:00');
  // JavaScript getDay() => 0 (Sun) .. 6 (Sat)
  // Some DB seeds use 1..7 (Mon=1 .. Sun=7). Accept both forms by querying for both values.
  const weekday0 = dt.getDay(); // 0..6
  const weekday1 = weekday0 === 0 ? 7 : weekday0; // 1..7

    // Determine resources to consider
    let resources = [];
    if (resourceId) {
      const [r] = await db.query('SELECT id, capacity FROM resources WHERE id = ? AND active = 1', [resourceId]);
      if (!r || r.length === 0) return res.status(404).json({ error: 'Resource not found' });
      resources = r;
    } else {
      const [rAll] = await db.query('SELECT id, capacity FROM resources WHERE active = 1 ORDER BY id');
      resources = rAll;
      if (!resources || resources.length === 0) {
        // allow global (resource_id NULL) business_hours handling even if no resource rows
        resources = [{ id: null, capacity: 1 }];
      }
    }

    // load business hours for weekday (global or per resource)
    const bhQuery = `SELECT id, resource_id, weekday, start_time, end_time FROM business_hours WHERE weekday = ? AND (resource_id IS NULL OR resource_id = ? ) ORDER BY resource_id`;

    const availability = [];

    for (const r of resources) {
      const rid = r.id;
      // select business hours matching either weekday convention (0..6 or 1..7)
      const [bhRows] = await db.query(
        'SELECT id, resource_id, weekday, start_time, end_time FROM business_hours WHERE weekday IN (?, ?) AND (resource_id IS NULL OR resource_id = ?) ORDER BY resource_id',
        [weekday0, weekday1, rid]
      );

      // check exceptions (closed days) for this resource or global
      const [excRows] = await db.query('SELECT * FROM availability_exceptions WHERE date = ? AND (resource_id IS NULL OR resource_id = ?)', [date, rid]);
  const isFullyClosed = excRows.some(e => e.is_closed === 1 && (!e.start_time && !e.end_time));
      if (isFullyClosed) {
        // skip resource
        continue;
      }

      // load existing bookings for that resource and date
      const dayStart = new Date(date + 'T00:00:00');
      const dayEnd = new Date(date + 'T23:59:59');
      const [bookings] = await db.query(
        `SELECT id, resource_id, start_at, end_at, status FROM bookings WHERE DATE(start_at) = ? AND status IN ('pending','confirmed') AND (resource_id = ? OR ? IS NULL)`,
        [date, rid, rid]
      );

      // for each business_hours range build available slots
      for (const bh of bhRows) {
        const rangeStart = makeDateTime(date, bh.start_time);
        const rangeEnd = makeDateTime(date, bh.end_time);

        // apply exceptions that are partial (is_closed=0 with start/end) -> subtract ranges
        let subRanges = [{ start: rangeStart, end: rangeEnd }];
        const exceptionsForThis = excRows.filter(e => e.is_closed === 1 || (e.start_time && e.end_time));
        for (const ex of exceptionsForThis) {
          if (ex.is_closed === 1 && !ex.start_time && !ex.end_time) {
            subRanges = [];
            break;
          }
          const exStart = ex.start_time ? makeDateTime(date, ex.start_time) : null;
          const exEnd = ex.end_time ? makeDateTime(date, ex.end_time) : null;
          if (!exStart || !exEnd) continue;
          const newRanges = [];
          for (const sr of subRanges) {
            // if exception does not intersect, keep sr
            if (!overlap(sr.start, sr.end, exStart, exEnd)) {
              newRanges.push(sr);
              continue;
            }
            // left part
            if (sr.start < exStart) newRanges.push({ start: sr.start, end: exStart });
            // right part
            if (sr.end > exEnd) newRanges.push({ start: exEnd, end: sr.end });
          }
          subRanges = newRanges;
        }

        for (const sr of subRanges) {
          const slots = generateSlotsForRange(sr.start, sr.end, duration, step, bookings);
          for (const s of slots) {
              // server-side: filter out slots in the past relative to server clock when the requested date is today
              // This avoids offering already-passed slots to clients and reduces timezone-related confusion.
              const now = new Date();
              const slotStart = s.startAt instanceof Date ? s.startAt : new Date(s.startAt);
              // if requested date equals today (server local), skip past slots
              const requestDate = new Date(date + 'T00:00:00');
              const requestDayStart = new Date(requestDate.getFullYear(), requestDate.getMonth(), requestDate.getDate());
              const today = new Date();
              const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const isRequestToday = requestDayStart.getTime() === todayStart.getTime();
              if (isRequestToday && slotStart.getTime() <= now.getTime()) {
                continue;
              }
              availability.push({ resourceId: rid, startAt: slotStart.toISOString(), endAt: s.endAt.toISOString() });
            }
        }
      }
    }

    // sort slots by datetime
    availability.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

    return res.json({ date, serviceId, stepMinutes: step, slots: availability });
  } catch (err) {
    console.error('getAvailability error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default { getAvailability };
