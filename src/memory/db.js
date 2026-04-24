import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/agent_memory.db');

let _db = null;

export function initDB() {
  if (_db) return _db;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS disruptions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      detected_at      TEXT NOT NULL,
      event_type       TEXT NOT NULL,
      location         TEXT NOT NULL,
      severity         TEXT CHECK(severity IN ('low','medium','high')) NOT NULL,
      raw_news_summary TEXT,
      weather_snapshot TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS impacted_pos (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      disruption_id        INTEGER NOT NULL REFERENCES disruptions(id),
      po_id                TEXT NOT NULL,
      sku_id               TEXT,
      sku_name             TEXT,
      vessel_name          TEXT,
      container_id         TEXT,
      stockout_risk        TEXT,
      estimated_delay_days INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rerouting_decisions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      disruption_id     INTEGER NOT NULL REFERENCES disruptions(id),
      option_chosen     TEXT,
      cost_estimate_usd REAL    DEFAULT 0,
      time_saved_days   INTEGER DEFAULT 0,
      approved_by_human INTEGER DEFAULT 0,
      decision_at       TEXT    DEFAULT (datetime('now')),
      notes             TEXT
    );
  `);

  return _db;
}

export function logDisruption(data) {
  const db = initDB();
  const result = db.prepare(`
    INSERT INTO disruptions (detected_at, event_type, location, severity, raw_news_summary, weather_snapshot)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.detectedAt ?? new Date().toISOString(),
    data.eventType,
    data.location,
    data.severity,
    data.rawNewsSummary ?? null,
    data.weatherSnapshot ? JSON.stringify(data.weatherSnapshot) : null,
  );
  return result.lastInsertRowid;
}

export function logImpactedPOs(disruptionId, posArray) {
  const db = initDB();
  const stmt = db.prepare(`
    INSERT INTO impacted_pos
      (disruption_id, po_id, sku_id, sku_name, vessel_name, container_id, stockout_risk, estimated_delay_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction((pos) => {
    for (const po of pos) {
      stmt.run(
        disruptionId,
        po.poId ?? po.po_id ?? 'PO-UNKNOWN',
        po.skuId ?? po.sku_id ?? null,
        po.skuName ?? po.sku_name ?? null,
        po.vesselName ?? po.vessel_name ?? null,
        po.containerId ?? po.container_id ?? null,
        po.stockoutRisk ?? po.stockout_risk ?? 'low',
        po.estimatedDelayDays ?? po.estimated_delay_days ?? 0,
      );
    }
  })(posArray);
}

export function logDecision(disruptionId, decisionData) {
  const db = initDB();
  return db.prepare(`
    INSERT INTO rerouting_decisions
      (disruption_id, option_chosen, cost_estimate_usd, time_saved_days, approved_by_human, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    disruptionId,
    decisionData.optionChosen ?? decisionData.option_chosen ?? 'unspecified',
    decisionData.costEstimateUsd ?? decisionData.cost_estimate_usd ?? 0,
    decisionData.timeSavedDays ?? decisionData.time_saved_days ?? 0,
    decisionData.approvedByHuman ?? decisionData.approved_by_human ?? 0,
    decisionData.notes ?? '',
  ).lastInsertRowid;
}

export function getRecentDisruptions(limit = 5) {
  const db = initDB();
  return db.prepare(`SELECT * FROM disruptions ORDER BY created_at DESC LIMIT ?`).all(limit)
    .map((d) => ({
      ...d,
      impactedPOs: db.prepare(`SELECT * FROM impacted_pos WHERE disruption_id = ?`).all(d.id),
    }));
}

export function getDisruptionContext() {
  const db = initDB();
  const rows = db.prepare(`
    SELECT d.detected_at, d.event_type, d.location, d.severity,
           d.raw_news_summary,
           GROUP_CONCAT(p.po_id) AS po_ids
    FROM   disruptions d
    LEFT JOIN impacted_pos p ON p.disruption_id = d.id
    GROUP  BY d.id
    ORDER  BY d.created_at DESC
    LIMIT  3
  `).all();

  if (rows.length === 0) return 'No prior disruptions recorded.';

  return rows.map((r) =>
    `[${r.detected_at}] ${r.severity.toUpperCase()} — ${r.event_type} at ${r.location}. ` +
    `Affected POs: ${r.po_ids ?? 'none'}. ` +
    `Summary: ${r.raw_news_summary?.slice(0, 120) ?? 'N/A'}`,
  ).join('\n');
}
