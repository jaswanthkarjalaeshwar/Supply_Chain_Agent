import chalk from 'chalk';

let _running = false;
let _handle  = null;
let _stopped = false;

export async function startScheduler({ intervalMinutes = 30, maxCycles = Infinity, callback }) {
  const ms = intervalMinutes * 60 * 1000;
  _stopped = false;
  let fired = 0;

  const tick = async () => {
    if (_stopped) return;
    if (_running) {
      console.log(chalk.dim('[Scheduler] Previous cycle still running — skipping tick'));
      return;
    }
    fired++;
    _running = true;
    try {
      await callback();
    } finally {
      _running = false;
    }
    if (fired >= maxCycles) {
      console.log(chalk.dim(`\n[Scheduler] Reached maxCycles (${maxCycles}) — stopping.`));
      stopScheduler();
      return;
    }
    if (!_stopped) {
      const next = new Date(Date.now() + ms);
      console.log(chalk.dim(`\n[Scheduler] Next scan at ${next.toLocaleTimeString()}`));
    }
  };

  // Fire immediately, then on interval
  tick();
  _handle = setInterval(tick, ms);
}

export function stopScheduler() {
  _stopped = true;
  if (_handle) {
    clearInterval(_handle);
    _handle = null;
  }
}
