// pure filtering helpers for incidents
// keeping this logic isolated makes it easy to test + reuse

import { INCIDENT_STATES } from '../../../shared/constants';
import { Incident } from '../../../shared/types';

export type IncidentBucket = 'new' | 'active' | 'completed';

// apply both filter controls (escalation/incident type) + bucket rules
export const getIncidentsByType = (
  incidents: Incident[],
  type: IncidentBucket,
  escalationLevelId?: string,
  incidentTypeIds?: string[]
) => {
  // filter controls first, then bucket rules
  const matchesFilter = (incident: Incident) => {
    if (escalationLevelId && incident.escalationLevelId !== escalationLevelId) {
      return false;
    }
    if (incidentTypeIds?.length) {
      const incidentTypes = incident.incidentTypeIds ?? [];
      const matchesIncidentType = incidentTypeIds.some((typeId) => incidentTypes.includes(typeId));
      if (!matchesIncidentType) {
        return false;
      }
    }
    return true;
  };

  return incidents.filter((incident) => {
    if (!matchesFilter(incident)) {
      return false;
    }
    if (type === 'new') {
      return incident.stateId === INCIDENT_STATES.OPEN && !incident.assignedTo;
    }
    if (type === 'active') {
      return incident.stateId === INCIDENT_STATES.OPEN && !!incident.assignedTo;
    }
    return incident.stateId === INCIDENT_STATES.CLOSED;
  });
};
