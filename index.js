import 'dotenv/config';
import chalk from 'chalk';
import { initDB, getRecentDisruptions } from './src/memory/db.js';
import { runAgent } from './src/agent/loop.js';
import { runApproval } from './src/output/approval.js';
import { fetchFreightOptions } from './src/tools/freight.js';
import { startMonitor } from './src/agent/monitor.js';

// ── Flag parsing ────────────────────────────────────────────────────────────
const REPLAY   = process.argv.includes('--replay');
const MONITOR  = process.argv.includes('--monitor');

const intervalArg = process.argv.find((a) => a.startsWith('--interval='));
const intervalMinutes = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : undefined;

// e.g. --locations=Port of Miami,Port of Los Angeles
const locationsArg = process.argv.find((a) => a.startsWith('--locations='));
const locations = locationsArg
  ? locationsArg.split('=').slice(1).join('=').split(',').map((l) => l.trim())
  : undefined;

const cyclesArg = process.argv.find((a) => a.startsWith('--cycles='));
const maxCycles = cyclesArg ? parseInt(cyclesArg.split('=')[1], 10) : undefined;

// ── Boot ─────────────────────────────────────────────────────────────────────
console.log(chalk.bold('\nSupply Chain Disruption Agent'));
console.log(chalk.dim(`Model    : ${process.env.MODEL ?? '(not set)'}`));
console.log(chalk.dim(`API key  : ${process.env.OPENROUTER_API_KEY ? '✓ set' : '✗ missing'}`));

initDB();
console.log(chalk.green('\n✓ Database initialized at data/agent_memory.db'));

// ── Mode dispatch ─────────────────────────────────────────────────────────────
if (MONITOR) {
  // ── Continuous monitor ────────────────────────────────────────────────────
  await startMonitor({
    ...(intervalMinutes != null && { intervalMinutes }),
    ...(locations        != null && { locations }),
    ...(maxCycles        != null && { maxCycles }),
  });

} else if (REPLAY) {
  // ── Replay most recent disruption from SQLite ─────────────────────────────
  console.log(chalk.yellow('\n[--replay] Loading most recent disruption from DB...'));

  const [latest] = getRecentDisruptions(1);
  if (!latest) {
    console.error(chalk.red('No disruptions found. Run without --replay first.'));
    process.exit(1);
  }

  console.log(chalk.dim(`  Found disruption #${latest.id}: ${latest.event_type} at ${latest.location}`));

  const reroutingOptions = fetchFreightOptions(latest.location, 'Miami Distribution Center', 'high');

  const result = {
    disruptionId: latest.id,
    location:     latest.location,
    eventType:    latest.event_type,
    severity:     latest.severity,
    impactedPOs:  latest.impactedPOs.map((p) => ({
      poId:               p.po_id,
      skuId:              p.sku_id,
      skuName:            p.sku_name,
      vesselName:         p.vessel_name,
      containerId:        p.container_id,
      stockoutRisk:       p.stockout_risk,
      estimatedDelayDays: p.estimated_delay_days,
    })),
    reroutingOptions,
    rawPlan: `[replay] Disruption #${latest.id} from agent_memory.db`,
  };

  await runApproval(result);

} else {
  // ── Single agent run ───────────────────────────────────────────────────────
  const result = await runAgent('Port of Miami', 'Hurricane warning');
  await runApproval(result);
}
