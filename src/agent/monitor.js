import chalk from 'chalk';
import { runAgent } from './loop.js';
import { runApproval } from '../output/approval.js';
import { notifySlack } from '../output/notifier.js';
import { startScheduler } from './scheduler.js';

// Map severity string → numeric score for threshold comparison
const SEVERITY_SCORE = { low: 2, medium: 5, high: 8 };

const DEFAULT_CONFIG = {
  locations: ['Port of Miami', 'Port of Los Angeles', 'Port of Rotterdam'],
  intervalMinutes: 30,
  severityThreshold: 6, // score >= 6 means "high" triggers approval
  maxCycles: Infinity,  // set to a number to stop after N cycles (useful for demos/tests)
};

function hhmm() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

async function scanLocation(location, severityThreshold) {
  console.log(chalk.dim(`\n  Scanning ${location}...`));

  const result = await runAgent(location, 'disruption scan');
  const score  = SEVERITY_SCORE[result.severity] ?? 0;
  const time   = hhmm();

  if (score >= severityThreshold) {
    console.log(
      chalk.red.bold(`\n  [${time}] ${location}`) +
      chalk.red(` — ⚠  DISRUPTION DETECTED (${result.severity.toUpperCase()}, score ${score})`),
    );
    await notifySlack(result);
    await runApproval(result);
    return { triggered: true };
  }

  console.log(
    chalk.dim(`  [${time}] ${location} — no significant disruption`) +
    chalk.dim(` (${result.severity}, score ${score})`),
  );
  return { triggered: false };
}

export async function startMonitor(overrides = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...overrides };
  const { locations, intervalMinutes, severityThreshold, maxCycles } = cfg;

  console.log('\n' + chalk.bold.cyan('╔' + '═'.repeat(60) + '╗'));
  console.log(chalk.bold.cyan('║  CONTINUOUS MONITOR STARTED') + ' '.repeat(33) + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚' + '═'.repeat(60) + '╝'));
  console.log(chalk.dim(`  Locations  : ${locations.join(' · ')}`));
  console.log(chalk.dim(`  Interval   : ${intervalMinutes} minute(s)`));
  console.log(chalk.dim(`  Threshold  : score ≥ ${severityThreshold}  (low=2 · medium=5 · high=8)`));

  let cycleNum = 0;

  await startScheduler({
    intervalMinutes,
    maxCycles,
    callback: async () => {
      cycleNum++;

      console.log('\n' + chalk.bold.white('─'.repeat(62)));
      console.log(chalk.bold.white(`[Monitor] Scan cycle #${cycleNum} — ${new Date().toLocaleTimeString()}`));
      console.log(chalk.white('─'.repeat(62)));

      let checked = 0;
      let found   = 0;
      let errors  = 0;

      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        try {
          const { triggered } = await scanLocation(location, severityThreshold);
          checked++;
          if (triggered) found++;
        } catch (err) {
          errors++;
          const msg = err.message?.slice(0, 100) ?? String(err);
          console.log(chalk.red(`  [${hhmm()}] ${location} — scan error: ${msg}`));
        }

        // Brief pause between location scans to respect free-tier rate limits
        if (i < locations.length - 1) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      // ── Cycle summary ────────────────────────────────────────────────────
      console.log('\n' + chalk.bold.cyan('[Monitor] Cycle #' + cycleNum + ' complete'));
      console.log(chalk.cyan(`  Locations checked : ${checked} / ${locations.length}`));
      console.log(chalk.cyan(`  Disruptions found : ${found}`));
      if (errors > 0) console.log(chalk.yellow(`  Scan errors       : ${errors}`));
      console.log(chalk.cyan(`  Decisions pending : ${found} (auto-deferred — run --replay to process)`));
    },
  });
}
