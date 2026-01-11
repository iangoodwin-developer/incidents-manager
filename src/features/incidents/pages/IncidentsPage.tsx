// main incidents list page w filters + drag drop

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { INCIDENT_STATES } from '../../../shared/constants';
import { Catalog, Incident } from '../../../shared/types';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { IncidentsSection } from '../components/IncidentsSection/IncidentsSection';
import { ConnectionBanner } from '../../../shared/components/ConnectionBanner/ConnectionBanner';
import { ConnectionStatus } from '../hooks/useIncidentSocket';
import { getIncidentsByType } from '../logic/incidentFilters';

type IncidentsPageProps = {
  incidents: Incident[];
  catalog: Catalog;
  connectionStatus: ConnectionStatus;
  updateIncident: (incident: Incident) => void;
  lastError: string | null;
};

export const IncidentsPage: React.FC<IncidentsPageProps> = ({
  incidents,
  catalog,
  connectionStatus,
  updateIncident,
  lastError,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  // track currently selected filters in local state
  const [selectedEscalation, setSelectedEscalation] = useState<string>('');
  const [selectedIncidentType, setSelectedIncidentType] = useState<string>('');
  // when connected but catalog still empty, show loading
  const isLoading = connectionStatus === 'connected' && catalog.escalationLevels.length === 0;

  useEffect(() => {
    // read initial filter state from url so view is shareable
    const escFromUrl = searchParams.get('esc') ?? '';
    const typeFromUrl = searchParams.get('type') ?? '';
    if (escFromUrl) {
      setSelectedEscalation(escFromUrl);
    }
    if (typeFromUrl) {
      setSelectedIncidentType(typeFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // default escalation filter to first known level
    if (!selectedEscalation && catalog.escalationLevels[0]) {
      setSelectedEscalation(catalog.escalationLevels[0].id);
    }
  }, [catalog.escalationLevels, selectedEscalation]);

  useEffect(() => {
    // keep url in sync w current filters
    const next = new URLSearchParams(searchParams);
    if (selectedEscalation) {
      next.set('esc', selectedEscalation);
    } else {
      next.delete('esc');
    }
    if (selectedIncidentType) {
      next.set('type', selectedIncidentType);
    } else {
      next.delete('type');
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, selectedEscalation, selectedIncidentType, setSearchParams]);

  // precompute each list so render stays fast n predictable
  const selectedIncidentTypeIds = selectedIncidentType ? [selectedIncidentType] : [];
  const filteredNew = useMemo(
    () => getIncidentsByType(incidents, 'new', selectedEscalation, selectedIncidentTypeIds),
    [incidents, selectedEscalation, selectedIncidentTypeIds]
  );
  const filteredActive = useMemo(
    () => getIncidentsByType(incidents, 'active', selectedEscalation, selectedIncidentTypeIds),
    [incidents, selectedEscalation, selectedIncidentTypeIds]
  );
  const filteredCompleted = useMemo(
    () => getIncidentsByType(incidents, 'completed', selectedEscalation, selectedIncidentTypeIds),
    [incidents, selectedEscalation, selectedIncidentTypeIds]
  );

  const handleDrop = (target: 'new' | 'active' | 'completed', incidentId: string) => {
    // update local state and send change over ws
    // "active" column is OPEN + assignedTo
    const incident = incidents.find((item) => item.incidentId === incidentId);
    if (!incident) {
      return;
    }

    const updated: Incident = {
      ...incident,
      stateId: target === 'completed' ? INCIDENT_STATES.CLOSED : INCIDENT_STATES.OPEN,
      assignedTo: target === 'new' ? null : (incident.assignedTo ?? 'user-1'),
    };

    updateIncident(updated);
  };

  const handleMove = (incidentId: string, target: 'new' | 'active' | 'completed') => {
    // buttons reuse same handler as drag drop for consistency
    handleDrop(target, incidentId);
  };

  const handleDragStart = (incidentId: string, event: React.DragEvent<HTMLTableRowElement>) => {
    // store incident id in drag payload so target list can read it
    event.dataTransfer.setData('text/plain', incidentId);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="incidents-page">
      <PageHeader
        title="Incidents"
        subtitle="Basic incident overview with live updates."
        statusLabel={`WebSocket: ${connectionStatus}`}
      >
        <div className="incidents-page__filters">
          <label className="incidents-page__field">
            <span className="incidents-page__label">Escalation level</span>
            <select
              value={selectedEscalation}
              onChange={(event) => setSelectedEscalation(event.target.value)}
            >
              {(catalog.escalationLevels ?? []).map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>
          <label className="incidents-page__field">
            <span className="incidents-page__label">Incident types</span>
            <select
              value={selectedIncidentType}
              onChange={(event) => setSelectedIncidentType(event.target.value)}
            >
              <option value="">All</option>
              {(catalog.incidentTypes ?? []).map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <nav className="incidents-page__nav">
            <a href="#/create">Create incident</a>
          </nav>
        </div>
      </PageHeader>

      <ConnectionBanner status={connectionStatus} />
      {lastError ? (
        <div className="app-error" role="alert">
          {lastError}
        </div>
      ) : null}

      {isLoading ? (
        <p className="incidents-page__loading">Loading incidents...</p>
      ) : (
        <main className="incidents-page__content">
          <IncidentsSection
            title="New incidents"
            incidents={filteredNew}
            sites={catalog.sites}
            assets={catalog.assets}
            alarms={catalog.alarms}
            onDropIncident={(id) => handleDrop('new', id)}
            onDragStart={handleDragStart}
            onMoveIncident={handleMove}
            actions={[
              { label: 'Active', target: 'active' },
              { label: 'Completed', target: 'completed' },
            ]}
          />
          <IncidentsSection
            title="Active incidents"
            incidents={filteredActive}
            sites={catalog.sites}
            assets={catalog.assets}
            alarms={catalog.alarms}
            onDropIncident={(id) => handleDrop('active', id)}
            onDragStart={handleDragStart}
            onMoveIncident={handleMove}
            actions={[
              { label: 'New', target: 'new' },
              { label: 'Completed', target: 'completed' },
            ]}
          />
          <IncidentsSection
            title="Completed incidents"
            incidents={filteredCompleted}
            sites={catalog.sites}
            assets={catalog.assets}
            alarms={catalog.alarms}
            onDropIncident={(id) => handleDrop('completed', id)}
            onDragStart={handleDragStart}
            onMoveIncident={handleMove}
            actions={[{ label: 'Reopen', target: 'active' }]}
          />
        </main>
      )}
    </div>
  );
};
