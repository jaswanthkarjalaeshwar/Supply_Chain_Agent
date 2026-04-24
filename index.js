import 'dotenv/config';
import chalk from 'chalk';
import { initDB, getRecentDisruptions } from './src/memory/db.js';
import { runAgent } from './src/agent/loop.js';
import { runApproval } from './src/output/approval.js';
import { fetchFreightOptions } from './src/tools/freight.js';

const REPLAY = process.argv.includes('--replay');

console.log(chalk.bold('\nSupply Chain Disruption Agent'));
console.log(chalk.dim(`Model    : ${process.env.MODEL ?? '(not set)'}`));
console.log(chalk.dim(`API key  : ${process.env.OPENROUTER_API_KEY ? '✓ set' : '✗ missing'}`));

initDB();
console.log(chalk.green('\n✓ Database initialized at data/agent_memory.db'));

let result;

if (REPLAY) {
  // ── Replay mode: load most recent disruption from SQLite ─────────────────
  console.log(chalk.yellow('\n[--replay] Loading most recent disruption from DB...'));

  const [latest] = getRecentDisruptions(1);
  if (!latest) {
    console.error(chalk.red('No disruptions found in DB. Run without --replay first.'));
    process.exit(1);
  }

  console.log(chalk.dim(`  Found disruption #${latest.id}: ${latest.event_type} at ${latest.location}`));

  const reroutingOptions = fetchFreightOptions(latest.location, 'Miami Distribution Center', 'high');

  result = {
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
    rawPlan: `[replay] Disruption #${latest.id} loaded from agent_memory.db`,
  };

} else {
  // ── Live mode: run the full agent ─────────────────────────────────────────
  result = await runAgent('Port of Miami', 'Hurricane warning');
}

await runApproval(result);
