import 'dotenv/config';
import chalk from 'chalk';
import { fetchDisruptionNews } from './news.js';
import { fetchWeatherAlert } from './weather.js';
import { fetchVesselStatus } from './vessels.js';
import { fetchInventoryStatus } from './inventory.js';

function section(title) {
  console.log('\n' + chalk.bold.cyan('━'.repeat(60)));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.cyan('━'.repeat(60)));
}

function pass(label, value) {
  console.log(chalk.green('  ✓') + ' ' + chalk.white(label));
  console.log(chalk.gray(JSON.stringify(value, null, 2).split('\n').map(l => '    ' + l).join('\n')));
}

// --- News ---
section('fetchDisruptionNews("Miami", "hurricane port")');
const news = await fetchDisruptionNews('Miami', 'hurricane port');
if (news.length > 0) {
  pass(`${news.length} articles returned`, news[0]);
} else {
  console.log(chalk.yellow('  ⚠  No articles returned (GDELT may be rate-limiting or offline)'));
}

// --- Weather ---
section('fetchWeatherAlert("Miami")');
const weather = await fetchWeatherAlert('Miami');
pass('Weather result', weather);
if (!process.env.OPENWEATHER_API_KEY) {
  console.log(chalk.yellow('  ⚠  OPENWEATHER_API_KEY not set — result is a stub'));
}

// --- Vessels (Port of Miami) ---
section('fetchVesselStatus("Port of Miami")');
const miamiVessels = fetchVesselStatus('Port of Miami');
pass(`${miamiVessels.vessels.length} vessels at ${miamiVessels.port}`, miamiVessels);

// --- Vessels (Port of Los Angeles) ---
section('fetchVesselStatus("Port of Los Angeles")');
const laVessels = fetchVesselStatus('Port of Los Angeles');
pass(`${laVessels.vessels.length} vessels at ${laVessels.port}`, laVessels);

// --- Vessels (unknown port — generic fallback) ---
section('fetchVesselStatus("Port of Rotterdam")');
const rotVessels = fetchVesselStatus('Port of Rotterdam');
pass(`${rotVessels.vessels.length} vessels (generic fallback)`, rotVessels);

// --- Inventory ---
section('fetchInventoryStatus(["SKU-E002", "SKU-E004", "SKU-A002", "SKU-A007", "SKU-H002"])');
const inventory = fetchInventoryStatus(['SKU-E002', 'SKU-E004', 'SKU-A002', 'SKU-A007', 'SKU-H002']);
pass(`${inventory.length} SKUs returned`, inventory);
const highRisk = inventory.filter(i => i.stockoutRisk === 'high');
if (highRisk.length) {
  console.log(chalk.red(`  ⚠  ${highRisk.length} SKU(s) at HIGH stockout risk: `) + highRisk.map(i => i.skuId).join(', '));
}

// --- Inventory (unknown SKU) ---
section('fetchInventoryStatus(["SKU-FAKE-999"])');
const missing = fetchInventoryStatus(['SKU-FAKE-999']);
pass('Unknown SKU returns empty array', missing);

console.log('\n' + chalk.bold.green('All tool tests complete.\n'));
