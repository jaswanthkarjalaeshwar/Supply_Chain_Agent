import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inventoryPath = join(__dirname, '../../data/mock/inventory.json');

let _cache = null;
function loadInventory() {
  if (!_cache) _cache = JSON.parse(readFileSync(inventoryPath, 'utf-8'));
  return _cache;
}

function computeStockoutRisk(currentStock, reorderPoint) {
  if (currentStock < reorderPoint) return 'high';
  if (currentStock < reorderPoint * 1.5) return 'medium';
  return 'low';
}

export function fetchInventoryStatus(skuIds) {
  const inventory = loadInventory();
  const idSet = new Set(skuIds);
  return inventory
    .filter((item) => idSet.has(item.skuId))
    .map((item) => ({
      ...item,
      stockoutRisk: computeStockoutRisk(item.currentStock, item.reorderPoint),
    }));
}

export const inventoryTool = {
  type: 'function',
  function: {
    name: 'fetchInventoryStatus',
    description:
      'Look up current inventory levels for one or more SKUs. Returns stock counts, reorder points, lead times, and a computed stockout risk level (high/medium/low).',
    parameters: {
      type: 'object',
      properties: {
        skuIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of SKU IDs to look up, e.g. ["SKU-E001", "SKU-A002"]',
        },
      },
      required: ['skuIds'],
    },
  },
};
