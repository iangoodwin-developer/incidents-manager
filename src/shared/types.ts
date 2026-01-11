// centralized ts types shared across the app
// keeping them in one place makes data contracts easier to reason about

export type EscalationLevel = { id: string; name: string };
export type IncidentType = { id: string; name: string };
export type Site = { id: string; name: string };
export type Asset = {
  id: string;
  siteId: string;
  displayName: string;
  model: string;
  regionName: string;
};
export type Alarm = { alarmId: string; code: string; description: string; legacyId?: string };

// single time series data point for an incident
// intentionally small so it can be streamed a lot
export type IncidentReading = {
  timestamp: string;
  temperature: number;
  pressure: number;
};

export type Incident = {
  incidentId: string;
  siteId: string;
  assetId: string;
  alarmId: string;
  priority: number;
  createdAt: string;
  updatedAt?: string;
  assignedTo?: string | null;
  stateId: string;
  escalationLevelId: string;
  incidentTypeIds?: string[];
  readings?: IncidentReading[];
};

export type Catalog = {
  escalationLevels: EscalationLevel[];
  incidentTypes: IncidentType[];
  sites: Site[];
  assets: Asset[];
  alarms: Alarm[];
};
