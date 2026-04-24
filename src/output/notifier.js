import chalk from 'chalk';

export async function notifySlack(result) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return; // not configured — skip silently

  const { location, eventType, severity, disruptionId, reroutingOptions = [] } = result;
  const top = reroutingOptions[0];
  const topLine = top
    ? `Top option: *${top.forwarder ?? top.optionChosen}* (${top.mode}) — $${(top.costEstimateUsd ?? 0).toLocaleString()}`
    : 'No rerouting options computed yet.';

  const text = [
    `🚨 *Supply Chain Alert* — ${eventType ?? 'Disruption detected'} at *${location}*`,
    `Severity: *${(severity ?? '?').toUpperCase()}* | ${topLine}`,
    `Disruption #${disruptionId} — run \`node index.js --replay\` to review and approve.`,
  ].join('\n');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      console.log(chalk.dim('  [Slack] Notification sent ✓'));
    } else {
      console.log(chalk.dim(`  [Slack] Webhook returned ${res.status}`));
    }
  } catch {
    console.log(chalk.dim('  [Slack] Could not reach webhook (skipped)'));
  }
}
