export function fetchFreightOptions(originPort, destinationPort, urgency = 'normal') {
  const hi = urgency === 'high';
  const md = urgency === 'medium';

  return [
    {
      forwarder: 'DHL Global Freight',
      mode: 'air',
      transitDays: hi ? 2 : md ? 3 : 5,
      costEstimateUsd: hi ? 28800 : md ? 21000 : 16000,
      reliability: 0.97,
      notes: hi
        ? 'Priority next-flight-out with customs pre-clearance, door-to-door tracking'
        : 'Standard air freight, 2-day customs processing at destination',
    },
    {
      forwarder: 'Maersk Spot Premium',
      mode: 'sea-express',
      transitDays: hi ? 10 : md ? 14 : 20,
      costEstimateUsd: hi ? 5800 : md ? 4100 : 2900,
      reliability: 0.88,
      notes: hi
        ? 'Guaranteed space on next departure, premium lane bypass'
        : `Next available sailing from ${originPort}, standard booking`,
    },
    {
      forwarder: 'Union Pacific / BNSF Intermodal',
      mode: 'rail',
      transitDays: hi ? 5 : md ? 7 : 10,
      costEstimateUsd: hi ? 11700 : md ? 8450 : 6500,
      reliability: 0.93,
      notes: `Reroute via inland hub — avoids ${originPort} congestion entirely. Connects to ${destinationPort} distribution center.`,
    },
  ];
}

export const freightTool = {
  type: 'function',
  function: {
    name: 'fetchFreightOptions',
    description:
      'Retrieve alternative freight forwarder options for rerouting cargo between two ports or cities. Returns air, sea-express, and rail alternatives with cost and transit time. Call this after identifying delayed or diverted vessels.',
    parameters: {
      type: 'object',
      properties: {
        originPort: {
          type: 'string',
          description: 'The origin port or city, e.g. "Port of Miami", "Shenzhen"',
        },
        destinationPort: {
          type: 'string',
          description: 'The destination port or distribution center, e.g. "Atlanta DC", "Chicago Hub"',
        },
        urgency: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Urgency level — high urgency favors air freight with premium pricing',
        },
      },
      required: ['originPort', 'destinationPort', 'urgency'],
    },
  },
};
