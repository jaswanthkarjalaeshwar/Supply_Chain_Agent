import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { initDB, logDecision } from '../memory/db.js';
import { runAgent } from '../agent/loop.js';
import { fetchFreightOptions } from '../tools/freight.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ── GET /api/disruptions ──────────────────────────────────────────────────────
app.get('/api/disruptions', (_req, res) => {
  const db = initDB();
  const rows = db.prepare(
    `SELECT * FROM disruptions ORDER BY created_at DESC LIMIT 20`
  ).all();

  const result = rows.map((d) => ({
    ...d,
    impactedPOs: db.prepare(`SELECT * FROM impacted_pos WHERE disruption_id = ?`).all(d.id),
    decisions:   db.prepare(
      `SELECT * FROM rerouting_decisions WHERE disruption_id = ? ORDER BY decision_at DESC`
    ).all(d.id),
  }));

  res.json(result);
});

// ── GET /api/stats ────────────────────────────────────────────────────────────
app.get('/api/stats', (_req, res) => {
  const db = initDB();
  const total   = db.prepare(`SELECT COUNT(*) AS n FROM disruptions`).get().n;
  const pos     = db.prepare(`SELECT COUNT(*) AS n FROM impacted_pos`).get().n;
  const approved = db.prepare(
    `SELECT COUNT(*) AS n FROM rerouting_decisions WHERE approved_by_human = 1`
  ).get().n;
  const rejected = db.prepare(
    `SELECT COUNT(*) AS n FROM rerouting_decisions WHERE option_chosen = 'rejected'`
  ).get().n;
  const deferred = db.prepare(
    `SELECT COUNT(*) AS n FROM rerouting_decisions WHERE option_chosen IN ('deferred','auto-deferred') OR notes LIKE 'Auto-deferred%'`
  ).get().n;
  const topPort = db.prepare(
    `SELECT location, COUNT(*) AS n FROM disruptions GROUP BY location ORDER BY n DESC LIMIT 1`
  ).get();

  res.json({
    totalDisruptions: total,
    totalPOsAtRisk:   pos,
    decisionsApproved: approved,
    decisionsRejected: rejected,
    decisionsDeferred: deferred,
    topPort: topPort?.location ?? 'N/A',
  });
});

// ── GET /api/disruptions/:id/options ─────────────────────────────────────────
app.get('/api/disruptions/:id/options', (req, res) => {
  const db = initDB();
  const row = db.prepare(`SELECT location, severity FROM disruptions WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const urgency = row.severity === 'high' ? 'high' : row.severity === 'medium' ? 'medium' : 'low';
  const options = fetchFreightOptions(row.location, 'Distribution Center', urgency);
  res.json(options);
});

// ── POST /api/run-scan (SSE) ──────────────────────────────────────────────────
app.post('/api/run-scan', async (req, res) => {
  const location = req.body?.location ?? 'Port of Miami';
  const event    = req.body?.event    ?? 'disruption scan';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let closed = false;
  req.on('close', () => { closed = true; });

  const send = (type, data) => {
    if (!closed) res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('start', { location, event, ts: new Date().toISOString() });

  try {
    const result = await runAgent(location, event, {
      onEvent: (type, data) => send(type, data),
    });
    send('done', {
      disruptionId: result.disruptionId,
      severity:     result.severity,
      poCount:      result.impactedPOs?.length ?? 0,
      location:     result.location,
    });
  } catch (err) {
    send('error', { message: err.message });
  }

  res.end();
});

// ── POST /api/approve/:id ─────────────────────────────────────────────────────
app.post('/api/approve/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { optionChosen, forwarder, mode, costEstimateUsd, timeSavedDays, transitDays, notes } = req.body;

  logDecision(id, {
    optionChosen:   optionChosen ?? `${mode} via ${forwarder}`,
    costEstimateUsd: costEstimateUsd ?? 0,
    timeSavedDays:  timeSavedDays ?? transitDays ?? 0,
    approvedByHuman: 1,
    notes:          notes ?? '',
  });

  res.json({ success: true });
});

// ── POST /api/reject/:id ──────────────────────────────────────────────────────
app.post('/api/reject/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { reason } = req.body;

  logDecision(id, {
    optionChosen:   'rejected',
    costEstimateUsd: 0,
    timeSavedDays:  0,
    approvedByHuman: 0,
    notes: `Rejected: ${reason?.trim() || 'no reason given'}`,
  });

  res.json({ success: true });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
initDB();
app.listen(PORT, () => {
  console.log(`\nSupply Chain Dashboard → http://localhost:${PORT}`);
  console.log(`Model: ${process.env.MODEL ?? '(not set)'}\n`);
});
