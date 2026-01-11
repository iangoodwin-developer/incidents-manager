// shared runtime schema + types for the ws protocol
// server + client both use this so contract stays aligned

import { z } from 'zod';

export const PROTOCOL_VERSION = '1';

export const IncidentReadingSchema = z.object({
  timestamp: z.string(),
  temperature: z.number(),
  pressure: z.number(),
});

export const IncidentSchema = z.object({
  incidentId: z.string(),
  siteId: z.string(),
  assetId: z.string(),
  alarmId: z.string(),
  priority: z.number(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  assignedTo: z.string().nullable().optional(),
  stateId: z.string(),
  escalationLevelId: z.string(),
  incidentTypeIds: z.array(z.string()).optional(),
  readings: z.array(IncidentReadingSchema).optional(),
});

export const CatalogSchema = z.object({
  escalationLevels: z.array(z.object({ id: z.string(), name: z.string() })),
  incidentTypes: z.array(z.object({ id: z.string(), name: z.string() })),
  sites: z.array(z.object({ id: z.string(), name: z.string() })),
  assets: z.array(
    z.object({
      id: z.string(),
      siteId: z.string(),
      displayName: z.string(),
      model: z.string(),
      regionName: z.string(),
    })
  ),
  alarms: z.array(
    z.object({
      alarmId: z.string(),
      code: z.string(),
      description: z.string(),
      legacyId: z.string().optional(),
    })
  ),
});

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    protocolVersion: z.string().optional(),
    incidents: z.array(IncidentSchema).optional(),
    catalog: CatalogSchema.optional(),
  }),
  z.object({
    type: z.literal('incidentAdded'),
    incident: IncidentSchema,
  }),
  z.object({
    type: z.literal('incidentUpdated'),
    incident: IncidentSchema,
  }),
  z.object({
    type: z.literal('readingIntervalUpdated'),
    intervalMs: z.number(),
  }),
  z.object({
    type: z.literal('error'),
    code: z.string().optional(),
    message: z.string().optional(),
  }),
]);

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('addIncident'),
    incident: IncidentSchema,
  }),
  z.object({
    type: z.literal('updateIncident'),
    incident: IncidentSchema,
  }),
  z.object({
    type: z.literal('setReadingInterval'),
    intervalMs: z.number(),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
