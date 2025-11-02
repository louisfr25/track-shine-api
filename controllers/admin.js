import { db } from '../connect.js';

// Return all bookings with basic user and service info for admin dashboard
export async function getAllBookings(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT b.*, u.firstName AS user_firstName, u.lastName AS user_lastName, u.email AS user_email, s.title AS service_title
       FROM bookings b
       LEFT JOIN users u ON u.id = b.user_id
       LEFT JOIN services s ON s.id = b.service_id
       ORDER BY b.start_at DESC`
    );

    // normalize per-frontend expectations (date/time fields and vehicle camelCase)
    const normalized = (rows || []).map(r => {
      const startAtRaw = r.start_at;
      let date = null;
      let time = null;
      try {
        if (startAtRaw) {
          // start_at may be a Date object or string 'YYYY-MM-DD HH:MM:SS'
          const dt = new Date(startAtRaw);
          if (!isNaN(dt.getTime())) {
            date = dt.toISOString().split('T')[0];
            // local time HH:MM
            time = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
          } else if (typeof startAtRaw === 'string') {
            const parts = startAtRaw.split(' ');
            date = parts[0];
            time = parts[1] ? parts[1].slice(0,5) : null;
          }
        }
      } catch (e) {
        // ignore parse errors
      }

      return {
        ...r,
        id: r.id,
        userId: r.user_id,
        service: r.service_title || r.service || null,
        date: date,
        time: time,
        start_at: r.start_at,
        vehicleType: r.vehicleType || r.vehicle_type || null,
        licensePlate: r.licensePlate || r.license_plate || null,
      };
    });

    return res.json({ bookings: normalized });
  } catch (err) {
    console.error('getAllBookings admin error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAllUsers(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, firstName, lastName, email, phone, role, createdAt FROM users ORDER BY createdAt DESC`
    );
    return res.json({ users: rows });
  } catch (err) {
    console.error('getAllUsers admin error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Optional: aggregated stats endpoint (small, client can also compute)
export async function getAdminStats(req, res) {
  try {
  // Totals
  const [[totalsRow]] = await db.query(`SELECT COUNT(*) AS totalBookings FROM bookings`);
  const totalBookings = Number(totalsRow?.totalBookings || 0);

  // Compute total revenue from bookings that are not cancelled (include confirmed/completed)
  const [[revRow]] = await db.query(`SELECT COALESCE(SUM(CAST(total_price AS DECIMAL(10,2))),0) AS totalRevenue FROM bookings WHERE status IN ('confirmed','completed')`);
  const totalRevenue = Number(revRow?.totalRevenue || 0);

  // Status distribution (raw)
  const [statusRows] = await db.query(`SELECT status, COUNT(*) AS cnt FROM bookings GROUP BY status`);
  const statusDistribution = (statusRows || []).map(r => ({ status: r.status, count: Number(r.cnt) }));

  // Derive meaningful counts based on dates + cancellation
  const [upcomingRow] = await db.query(`SELECT COUNT(*) AS cnt FROM bookings WHERE status <> 'cancelled' AND start_at > NOW()`);
  const upcoming = Number(upcomingRow[0]?.cnt || 0);
  const [completedRow] = await db.query(`SELECT COUNT(*) AS cnt FROM bookings WHERE status <> 'cancelled' AND end_at <= NOW()`);
  const completed = Number(completedRow[0]?.cnt || 0);
  const [cancelledRow] = await db.query(`SELECT COUNT(*) AS cnt FROM bookings WHERE status = 'cancelled'`);
  const cancelled = Number(cancelledRow[0]?.cnt || 0);

    // Service distribution (by number of bookings)
    const [svcRows] = await db.query(
      `SELECT COALESCE(s.title, 'Unknown') AS name, COUNT(*) AS cnt
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       GROUP BY name
       ORDER BY cnt DESC`
    );
    const serviceDistribution = (svcRows || []).map(r => ({ name: r.name, count: Number(r.cnt) }));

    // Monthly revenue trend for last 6 months based on booking start date (start_at)
    // Build month buckets in JS to ensure months with zero revenue are present
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0,7); // YYYY-MM
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      months.push({ key, label, revenue: 0 });
    }

    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const rangeStartSql = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth()+1).padStart(2,'0')}-01`;

    const [monthAgg] = await db.query(
      `SELECT DATE_FORMAT(start_at, '%Y-%m') AS ym, COALESCE(SUM(CAST(total_price AS DECIMAL(10,2))),0) AS revenue
       FROM bookings
       WHERE status IN ('confirmed','completed') AND start_at >= ?
       GROUP BY ym
       ORDER BY ym ASC`,
      [rangeStartSql]
    );

    const monthMap = {};
    (monthAgg || []).forEach(r => { monthMap[r.ym] = Number(r.revenue); });
    const monthlyTrend = months.map(m => ({ month: m.label, revenue: monthMap[m.key] || 0 }));

    return res.json({
      totalBookings,
      totalRevenue,
      upcomingBookings: upcoming,
      completedBookings: completed,
      cancelledBookings: cancelled,
      statusDistribution,
      serviceDistribution,
      monthlyTrend
    });
  } catch (err) {
    console.error('getAdminStats error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
