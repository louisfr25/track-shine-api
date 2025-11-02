import { db } from '../connect.js';

export async function getServices(req, res) {
  try {
    const [rows] = await db.query('SELECT id, code, title, description, duration_minutes, price, active FROM services WHERE active = 1 ORDER BY id');
    return res.json({ services: rows });
  } catch (err) {
    console.error('getServices error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getService(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [rows] = await db.query('SELECT id, code, title, description, duration_minutes, price, active FROM services WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    return res.json({ service: rows[0] });
  } catch (err) {
    console.error('getService error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default { getServices, getService };
