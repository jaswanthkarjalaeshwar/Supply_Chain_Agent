const MOCK_FLEET = {
  'Port of Miami': [
    {
      vesselName: 'MSC AURORA',
      containerId: 'MSCU4821093',
      status: 'on_time',
      eta: daysFromNow(2),
      cargo: ['SKU-E001', 'SKU-E003', 'SKU-A005'],
    },
    {
      vesselName: 'MAERSK STOCKHOLM',
      containerId: 'MSKU7734812',
      status: 'delayed',
      eta: daysFromNow(5),
      delayReason: 'Port congestion at Freeport',
      cargo: ['SKU-H002', 'SKU-H004'],
    },
    {
      vesselName: 'CMA CGM BELLINI',
      containerId: 'CMAU1920384',
      status: 'on_time',
      eta: daysFromNow(1),
      cargo: ['SKU-A001', 'SKU-A002', 'SKU-E007'],
    },
    {
      vesselName: 'EVER TRIUMPH',
      containerId: 'EISU3847291',
      status: 'diverted',
      eta: daysFromNow(9),
      delayReason: 'Diverted to Port Everglades due to weather',
      cargo: ['SKU-E010', 'SKU-H007'],
    },
  ],
  'Port of Los Angeles': [
    {
      vesselName: 'COSCO SHIPPING UNIVERSE',
      containerId: 'COSU8812047',
      status: 'on_time',
      eta: daysFromNow(3),
      cargo: ['SKU-E002', 'SKU-E005', 'SKU-E009'],
    },
    {
      vesselName: 'ONE HAWK',
      containerId: 'ONEY6634901',
      status: 'delayed',
      eta: daysFromNow(7),
      delayReason: 'Customs hold at Busan',
      cargo: ['SKU-A003', 'SKU-A006', 'SKU-H001'],
    },
    {
      vesselName: 'MSC VALENTINA',
      containerId: 'MSCU2291847',
      status: 'on_time',
      eta: daysFromNow(2),
      cargo: ['SKU-H003', 'SKU-H005', 'SKU-H006'],
    },
    {
      vesselName: 'EVER GIVEN II',
      containerId: 'EISU9900123',
      status: 'on_time',
      eta: daysFromNow(4),
      cargo: ['SKU-E004', 'SKU-E006', 'SKU-A004'],
    },
    {
      vesselName: 'HAPAG BERLIN EXPRESS',
      containerId: 'HLXU5503281',
      status: 'diverted',
      eta: daysFromNow(11),
      delayReason: 'Rerouted via Panama due to Suez congestion',
      cargo: ['SKU-E008', 'SKU-A007'],
    },
  ],
};

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function genericFleet(portName) {
  return [
    {
      vesselName: 'ZIM INTEGRATED 9',
      containerId: 'ZIMU4412039',
      status: 'on_time',
      eta: daysFromNow(3),
      cargo: ['SKU-E001', 'SKU-H002'],
    },
    {
      vesselName: 'MSC DIANA',
      containerId: 'MSCU9930184',
      status: 'delayed',
      eta: daysFromNow(6),
      delayReason: 'Mechanical issue reported at sea',
      cargo: ['SKU-A001', 'SKU-A003'],
    },
    {
      vesselName: 'MAERSK KINLOSS',
      containerId: 'MSKU1122334',
      status: 'on_time',
      eta: daysFromNow(5),
      cargo: ['SKU-E005', 'SKU-H004'],
    },
  ];
}

export function fetchVesselStatus(portName) {
  const vessels = MOCK_FLEET[portName] ?? genericFleet(portName);
  return { port: portName, vessels, retrievedAt: new Date().toISOString() };
}

export const vesselsTool = {
  type: 'function',
  function: {
    name: 'fetchVesselStatus',
    description:
      'Retrieve the status of cargo vessels currently en route to a given port. Returns vessel names, container IDs, ETAs, delay reasons, and cargo SKU lists.',
    parameters: {
      type: 'object',
      properties: {
        portName: {
          type: 'string',
          description: 'Full port name, e.g. "Port of Miami", "Port of Los Angeles"',
        },
      },
      required: ['portName'],
    },
  },
};
