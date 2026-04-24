import { createInterface } from 'readline';
import chalk from 'chalk';
import { renderBrief } from './formatter.js';
import { logDecision, getRecentDisruptions } from '../memory/db.js';

function ask(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function printHistory() {
  const history = getRecentDisruptions(5);
  console.log('\n' + chalk.bold.cyan('╔' + '═'.repeat(70) + '╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold('  DISRUPTION HISTORY (last 5)') + ' '.repeat(41) + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚' + '═'.repeat(70) + '╝'));

  if (history.length === 0) {
    console.log(chalk.dim('  (no history)'));
    return;
  }

  for (const d of history) {
    const sevFn = d.severity === 'high' ? chalk.red.bold : d.severity === 'medium' ? chalk.yellow.bold : chalk.green.bold;
    const date  = (d.detected_at ?? d.created_at ?? '').slice(0, 10);
    const pos   = d.impactedPOs.length;
    console.log(`  ${chalk.dim(date)}  ${sevFn(`[${d.severity.toUpperCase()}]`)}  ${chalk.white(d.event_type)} at ${chalk.cyan(d.location)}  ${chalk.dim(`(${pos} PO${pos !== 1 ? 's' : ''})`)}`);
  }
}

export async function runApproval(result) {
  renderBrief(result);

  // In non-interactive sessions (monitor mode, piped stdin) auto-defer so the
  // loop is never blocked waiting for keyboard input.
  if (!process.stdin.isTTY) {
    logDecision(result.disruptionId, {
      optionChosen: 'deferred',
      costEstimateUsd: 0,
      timeSavedDays: 0,
      approvedByHuman: 0,
      notes: 'Auto-deferred — non-interactive session (use --replay to process)',
    });
    console.log(chalk.yellow('\n  ⏸  Auto-deferred (non-interactive). Run --replay to review and approve.'));
    printHistory();
    console.log('');
    return;
  }

  const { disruptionId, reroutingOptions = [] } = result;

  // Build the prompt line
  const maxOpt  = reroutingOptions.length;
  const optNums = maxOpt > 0 ? `1${maxOpt > 1 ? `-${maxOpt}` : ''}` : '';
  const choices  = [
    optNums && chalk.bold.green(`[${optNums}]`) + ' approve option',
    chalk.bold.red('[r]') + ' reject',
    chalk.bold.yellow('[d]') + ' defer',
  ].filter(Boolean).join('   ');

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  console.log('');
  const raw = (await ask(rl, `  ${choices}\n\n  Your choice: `)).trim().toLowerCase();

  const optNum = parseInt(raw, 10);
  const isValidOption = !isNaN(optNum) && optNum >= 1 && optNum <= maxOpt;

  if (isValidOption) {
    const chosen = reroutingOptions[optNum - 1];
    logDecision(disruptionId, {
      optionChosen: chosen.optionChosen ?? chosen.mode ?? `Option ${optNum}`,
      costEstimateUsd: chosen.costEstimateUsd ?? 0,
      timeSavedDays: chosen.timeSavedDays ?? chosen.transitDays ?? 0,
      approvedByHuman: 1,
      notes: chosen.notes ?? '',
    });
    const cost = (chosen.costEstimateUsd ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    console.log(chalk.bold.green(`\n  ✓ Decision logged.`) + ` Alerting ${chalk.bold(chosen.forwarder ?? 'freight forwarder')}...`);
    console.log(chalk.dim(`    [simulated] Sending priority booking request via EDI — ${cost} committed`));
    console.log(chalk.dim(`    [simulated] Notifying warehouse team at destination DC`));
    console.log(chalk.dim(`    [simulated] Updating ERP order status → REROUTING`));

  } else if (raw === 'r') {
    const reason = await ask(rl, chalk.yellow('  Rejection reason: '));
    logDecision(disruptionId, {
      optionChosen: 'rejected',
      costEstimateUsd: 0,
      timeSavedDays: 0,
      approvedByHuman: 0,
      notes: `Rejected: ${reason.trim() || 'no reason given'}`,
    });
    console.log(chalk.red('\n  ✗ Rejection logged.'));

  } else if (raw === 'd') {
    logDecision(disruptionId, {
      optionChosen: 'deferred',
      costEstimateUsd: 0,
      timeSavedDays: 0,
      approvedByHuman: 0,
      notes: 'Deferred — no action taken',
    });
    console.log(chalk.yellow('\n  ⏸  Decision deferred and logged.'));

  } else {
    console.log(chalk.dim('\n  Unrecognized input — no action logged.'));
  }

  rl.close();
  printHistory();
  console.log('');
}
