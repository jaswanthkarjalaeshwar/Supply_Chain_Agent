import { fetchDisruptionNews, newsTool } from './news.js';
import { fetchWeatherAlert, weatherTool } from './weather.js';
import { fetchVesselStatus, vesselsTool } from './vessels.js';
import { fetchInventoryStatus, inventoryTool } from './inventory.js';

export const TOOLS = [newsTool, weatherTool, vesselsTool, inventoryTool];

export const TOOL_FUNCTIONS = {
  fetchDisruptionNews,
  fetchWeatherAlert,
  fetchVesselStatus,
  fetchInventoryStatus,
};
