// tiny websocket server, all data in mem
// kept it simple so realtime flow is easy to talk thru

// ts-node here so node can load shared ts schema
// keeps the ws contract in one place for client + server
require('ts-node/register');

const { WebSocketServer } = require('ws');
const { ClientMessageSchema, PROTOCOL_VERSION } = require('../src/shared/schema');

const PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : 8080;
const MAX_READINGS = 24;
const DEFAULT_READING_INTERVAL_MS = 2000;
const MIN_READING_INTERVAL_MS = 250;

// ref data (catalog) for labels + dropdowns
const escalationLevels = [
  { id: 'esc-1', name: 'Level 1' },
  { id: 'esc-2', name: 'Level 2' }
];

const incidentTypes = [
  { id: 'type-electrical', name: 'Electrical' },
  { id: 'type-cooling', name: 'Cooling' },
  { id: 'type-controls', name: 'Controls' },
  { id: 'type-facilities', name: 'Facilities' }
];

const sites = [
  { id: 'site-1', name: 'North Campus Plant' },
  { id: 'site-2', name: 'Harbor District Facility' }
];

const assets = [
  { id: 'asset-1', siteId: 'site-1', displayName: 'Chiller CH-11', model: 'Trane RTAC 250', regionName: 'Mechanical Room 3' },
  { id: 'asset-2', siteId: 'site-1', displayName: 'AHU AH-19', model: 'Carrier 39HQ', regionName: 'Roof Zone 2' },
  { id: 'asset-3', siteId: 'site-2', displayName: 'Boiler BL-03', model: 'Cleaver-Brooks CB-500', regionName: 'Basement Plant 5' },
  { id: 'asset-4', siteId: 'site-2', displayName: 'Cooling Tower CT-21', model: 'BAC FXV', regionName: 'South Yard 1' }
];

const alarms = [
  { alarmId: 'alarm-100', code: 'HV-100', description: 'High condenser pressure', legacyId: '100' },
  { alarmId: 'alarm-220', code: 'HV-220', description: 'Supply air temp deviation', legacyId: '220' },
  { alarmId: 'alarm-310', code: 'HV-310', description: 'Boiler flame failure', legacyId: '310' },
  { alarmId: 'alarm-420', code: 'HV-420', description: 'BAS comms loss', legacyId: '420' }
];

const INCIDENT_ID_PATTERN = /^[a-z0-9-]{3,32}$/i;

// seed incidents w/ a lil reading history
const incidents = [
  {
    incidentId: 'inc-1001',
    siteId: 'site-1',
    assetId: 'asset-1',
    alarmId: 'alarm-100',
    priority: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    stateId: 'OPEN',
    escalationLevelId: 'esc-1',
    incidentTypeIds: ['type-electrical']
  },
  {
    incidentId: 'inc-1002',
    siteId: 'site-2',
    assetId: 'asset-3',
    alarmId: 'alarm-310',
    priority: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    assignedTo: 'user-2',
    stateId: 'OPEN',
    escalationLevelId: 'esc-1',
    incidentTypeIds: ['type-cooling']
  },
  {
    incidentId: 'inc-1003',
    siteId: 'site-2',
    assetId: 'asset-4',
    alarmId: 'alarm-420',
    priority: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    assignedTo: 'user-1',
    stateId: 'OPEN',
    escalationLevelId: 'esc-2',
    incidentTypeIds: ['type-controls']
  },
  {
    incidentId: 'inc-1004',
    siteId: 'site-1',
    assetId: 'asset-2',
    alarmId: 'alarm-220',
    priority: 1,
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    assignedTo: 'user-1',
    stateId: 'CLOSED',
    escalationLevelId: 'esc-2',
    incidentTypeIds: ['type-facilities']
  }
];

// make a temp/pressure reading w some random drift
const createReading = previous => {
  const temperatureBase = previous ? previous.temperature : 68 + Math.random() * 12;
  const pressureBase = previous ? previous.pressure : 18 + Math.random() * 6;
  const temperature = Number((temperatureBase + (Math.random() * 4 - 2)).toFixed(1));
  const pressure = Number((pressureBase + (Math.random() * 2 - 1)).toFixed(2));

  return {
    timestamp: new Date().toISOString(),
    temperature,
    pressure
  };
};

const seedReadings = () => {
  incidents.forEach(incident => {
    const readings = [];
    for (let i = 0; i < MAX_READINGS; i += 1) {
      const previous = readings[readings.length - 1];
      readings.push(createReading(previous));
    }
    incident.readings = readings;
  });
};

seedReadings();

const wss = new WebSocketServer({ port: PORT });
let readingIntervalMs = DEFAULT_READING_INTERVAL_MS;
let readingIntervalId = null;

const broadcast = message => {
  const payload = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
};

const sendError = (socket, code, message) => {
  socket.send(JSON.stringify({ type: 'error', code, message }));
};

wss.on('connection', socket => {
  // first connect -> send everything ui needs
  socket.send(
    JSON.stringify({
      type: 'init',
      protocolVersion: PROTOCOL_VERSION,
      incidents,
      catalog: {
        escalationLevels,
        incidentTypes,
        sites,
        assets,
        alarms
      }
    })
  );

  socket.on('message', data => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      return;
    }

    // shared schema validation so we only accept known shapes
    const parsed = ClientMessageSchema.safeParse(message);
    if (!parsed.success) {
      sendError(socket, 'INVALID_MESSAGE', 'Message did not match the expected schema.');
      return;
    }

    if (parsed.data.type === 'addIncident') {
      const incident = parsed.data.incident;
      // backend validation so bad ids dont get in
      if (!INCIDENT_ID_PATTERN.test(String(incident.incidentId ?? ''))) {
        sendError(socket, 'INVALID_INCIDENT_ID', 'Incident ID must be 3-32 characters: letters, numbers, or hyphens.');
        return;
      }
      const previousReading = incident.readings?.[incident.readings.length - 1];
      if (!incident.readings || incident.readings.length === 0) {
        incident.readings = [createReading(previousReading)];
      }
      incidents.unshift(incident);
      broadcast({ type: 'incidentAdded', incident });
    }

    if (parsed.data.type === 'updateIncident') {
      const incident = parsed.data.incident;
      const index = incidents.findIndex(item => item.incidentId === incident.incidentId);
      if (index >= 0) {
        incidents[index] = incident;
      } else {
        incidents.unshift(incident);
      }
      broadcast({ type: 'incidentUpdated', incident });
    }

    if (parsed.data.type === 'setReadingInterval') {
      const nextInterval = Math.max(MIN_READING_INTERVAL_MS, Number(parsed.data.intervalMs));
      readingIntervalMs = nextInterval;
      if (readingIntervalId) {
        clearInterval(readingIntervalId);
      }
      readingIntervalId = startReadingInterval();
      broadcast({ type: 'readingIntervalUpdated', intervalMs: readingIntervalMs });
    }
  });
});

const startReadingInterval = () =>
  setInterval(() => {
    incidents.forEach(incident => {
      const readings = incident.readings ?? [];
      const previous = readings[readings.length - 1];
      const nextReading = createReading(previous);
      const nextReadings = [...readings, nextReading].slice(-MAX_READINGS);
      incident.readings = nextReadings;
      broadcast({ type: 'incidentUpdated', incident });
    });
  }, readingIntervalMs);

// push new reading for each incident on a fixed interval (fake live data)
readingIntervalId = startReadingInterval();

console.log(`WebSocket server listening on ws://localhost:${PORT}`);
