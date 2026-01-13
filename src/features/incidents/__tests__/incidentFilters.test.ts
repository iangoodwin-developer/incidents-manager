// APP_NOTES: Testing
// *** unit-test-logic
// unit test for core bucketing + filter rules
// protects biz logic w/out coupling to ui

import { getIncidentsByType } from '../logic/incidentFilters';
import { INCIDENT_STATES } from '../../../shared/constants';
import { Incident } from '../../../shared/types';

const buildIncident = (overrides: Partial<Incident>): Incident => ({
  incidentId: overrides.incidentId ?? 'inc-1',
  siteId: overrides.siteId ?? 'site-1',
  assetId: overrides.assetId ?? 'asset-1',
  alarmId: overrides.alarmId ?? 'alarm-1',
  priority: overrides.priority ?? 1,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  stateId: overrides.stateId ?? INCIDENT_STATES.OPEN,
  escalationLevelId: overrides.escalationLevelId ?? 'esc-1',
  assignedTo: overrides.assignedTo,
  incidentTypeIds: overrides.incidentTypeIds,
  readings: overrides.readings,
});

describe('getIncidentsByType', () => {
  // APP_NOTES: Todo
  // *** todo-edge-case-tests
  it('buckets incidents by status and applies escalation/incident type filters', () => {
    const incidents = [
      buildIncident({
        incidentId: 'new-1',
        assignedTo: undefined,
        escalationLevelId: 'esc-1',
        incidentTypeIds: ['type-a'],
      }),
      buildIncident({
        incidentId: 'active-1',
        assignedTo: 'user-1',
        escalationLevelId: 'esc-1',
        incidentTypeIds: ['type-a'],
      }),
      buildIncident({
        incidentId: 'completed-1',
        stateId: INCIDENT_STATES.CLOSED,
        escalationLevelId: 'esc-2',
        incidentTypeIds: ['type-b'],
      }),
    ];

    const filteredNew = getIncidentsByType(incidents, 'new', 'esc-1', ['type-a']);
    const filteredActive = getIncidentsByType(incidents, 'active', 'esc-1', ['type-a']);
    const filteredCompleted = getIncidentsByType(incidents, 'completed', 'esc-2', ['type-b']);

    expect(filteredNew.map((item) => item.incidentId)).toEqual(['new-1']);
    expect(filteredActive.map((item) => item.incidentId)).toEqual(['active-1']);
    expect(filteredCompleted.map((item) => item.incidentId)).toEqual(['completed-1']);
  });
});

/*
APP_NOTES: Testing
- Kept business logic in a pure function (getIncidentsByType) and wrote a unit test for it in incidentFilters.test.ts. This matches "test pure logic, avoid UI coupling."

APP_NOTES: Todo
- Add unit tests for edge cases in getIncidentsByType and for the interval ack flow.
*/
