import chalk from 'chalk';

const SEV_COLOR = {
  high:   (s) => chalk.red.bold(s),
  medium: (s) => chalk.yellow.bold(s),
  low:    (s) => chalk.green.bold(s),
};

const RISK_COLOR = {
  high:   (s) => chalk.red(s),
  medium: (s) => chalk.yellow(s),
  low:    (s) => chalk.green(s),
};

const MODE_COLOR = {
  air:          (s) => chalk.blue.bold(s),
  'sea-express':(s) => chalk.cyan(s),
  rail:         (s) => chalk.magenta(s),
};

function pad(str, len) {
  const s = String(str ?? '—');
  return s.length > len ? s.slice(0, len - 1) + '…' : s.padEnd(len);
}

function divider(char = '─', len = 72) {
  return chalk.dim(char.repeat(len));
}

export function renderBrief(result) {
  const { disruptionId, severity, location, eventType, impactedPOs = [], reroutingOptions = [] } = result;
  const sevFn = SEV_COLOR[severity] ?? SEV_COLOR.low;

  // ── Header ───────────────────────────────────────────────────────────────
  console.log('\n' + chalk.bold.cyan('╔' + '═'.repeat(70) + '╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold('  SUPPLY CHAIN DISRUPTION BRIEF') + ' '.repeat(40) + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚' + '═'.repeat(70) + '╝'));

  console.log(`  ${chalk.dim('Disruption')}  #${chalk.bold(disruptionId)}`);
  if (location)  console.log(`  ${chalk.dim('Location  ')}  ${chalk.white(location)}`);
  if (eventType) console.log(`  ${chalk.dim('Event     ')}  ${chalk.white(eventType)}`);
  console.log(`  ${chalk.dim('Severity  ')}  ${sevFn(severity.toUpperCase())}`);

  // ── Impacted POs ─────────────────────────────────────────────────────────
  console.log('\n' + chalk.bold.white('  IMPACTED PURCHASE ORDERS'));
  console.log(divider());
  const COL = [13, 28, 20, 8, 5];
  const hdr = [
    pad('PO ID',       COL[0]),
    pad('SKU Name',    COL[1]),
    pad('Vessel',      COL[2]),
    pad('Risk',        COL[3]),
    'Delay',
  ].join('  ');
  console.log(chalk.bold.white('  ' + hdr));
  console.log(divider());

  if (impactedPOs.length === 0) {
    console.log(chalk.dim('  (no impacted POs recorded)'));
  }
  for (const po of impactedPOs) {
    const risk = po.stockoutRisk ?? 'low';
    const rFn = RISK_COLOR[risk] ?? RISK_COLOR.low;
    const row = [
      chalk.cyan(pad(po.poId,      COL[0])),
      pad(po.skuName ?? po.skuId,  COL[1]),
      chalk.dim(pad(po.vesselName, COL[2])),
      rFn(pad(risk.toUpperCase(),  COL[3])),
      chalk.yellow((po.estimatedDelayDays ?? 0) + 'd'),
    ].join('  ');
    console.log('  ' + row);
  }

  // ── Rerouting options ─────────────────────────────────────────────────────
  console.log('\n' + chalk.bold.white('  REROUTING OPTIONS'));
  console.log(divider());

  if (reroutingOptions.length === 0) {
    console.log(chalk.dim('  (no rerouting options available)'));
  }
  reroutingOptions.forEach((opt, i) => {
    const mFn = MODE_COLOR[opt.mode] ?? ((s) => s);
    const cost = (opt.costEstimateUsd ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    const days = opt.timeSavedDays ?? opt.transitDays ?? '?';
    const rel  = opt.reliability != null ? `  ${chalk.dim('·')}  Reliability ${(opt.reliability * 100).toFixed(0)}%` : '';

    console.log(`\n  ${chalk.bold.white(`[${i + 1}]`)}  ${chalk.bold(opt.forwarder ?? opt.optionChosen)}`);
    console.log(`        Mode     ${mFn(opt.mode ?? '—')}`);
    console.log(`        Cost     ${chalk.green(cost)}${rel}`);
    console.log(`        Transit  ${chalk.yellow(days + ' days')}`);
    if (opt.notes) console.log(chalk.dim(`        Notes    ${opt.notes}`));
  });

  // ── Footer recommendation ─────────────────────────────────────────────────
  if (reroutingOptions.length > 0) {
    const top = reroutingOptions[0];
    const topCost = (top.costEstimateUsd ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    const topDays = top.timeSavedDays ?? top.transitDays ?? '?';
    console.log('\n' + divider('─'));
    console.log(
      chalk.bold('  Recommended: Option 1') +
      chalk.dim(' — saves ') + chalk.yellow.bold(topDays + ' days') +
      chalk.dim(' at ') + chalk.green.bold(topCost) + chalk.dim(' additional cost'),
    );
    console.log(divider('─'));
  }
}
