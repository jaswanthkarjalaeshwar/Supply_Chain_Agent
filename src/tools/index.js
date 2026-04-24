import { fetchDisruptionNews, newsTool }     from './news.js';
import { fetchWeatherAlert, weatherTool }     from './weather.js';
import { fetchVesselStatus, vesselsTool }     from './vessels.js';
import { fetchInventoryStatus, inventoryTool } from './inventory.js';
import { fetchFreightOptions, freightTool }   from './freight.js';

export const TOOLS = [newsTool, weatherTool, vesselsTool, inventoryTool, freightTool];

// Wrappers accept the parsed args object from the LLM tool call so the loop
// never has to know each function's positional signature.
export const TOOL_FUNCTIONS = {
  fetchDisruptionNews:  (a) => fetchDisruptionNews(a.location, a.eventType),
  fetchWeatherAlert:    (a) => fetchWeatherAlert(a.city),
  fetchVesselStatus:    (a) => fetchVesselStatus(a.portName),
  fetchInventoryStatus: (a) => fetchInventoryStatus(a.skuIds),
  fetchFreightOptions:  (a) => fetchFreightOptions(a.originPort, a.destinationPort, a.urgency),
};
