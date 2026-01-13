// presentational list component, renders table + drag targets
// stays stateless by receiving handlers from incidents page

import React, { useMemo, useState } from 'react';
import { Alarm, Asset, Incident, Site } from '../../../../shared/types';
import { StatusPill } from '../StatusPill/StatusPill';

const formatTimestamp = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleString();
};

type IncidentsSectionProps = {
  title: string;
  incidents: Incident[];
  sites: Site[];
  assets: Asset[];
  alarms: Alarm[];
  onDropIncident: (incidentId: string) => void;
  onDragStart: (incidentId: string, event: React.DragEvent<HTMLTableRowElement>) => void;
  onMoveIncident: (incidentId: string, target: 'new' | 'active' | 'completed') => void;
  actions: { label: string; target: 'new' | 'active' | 'completed' }[];
};

const IncidentRow = React.memo(
  ({
    incident,
    siteName,
    assetName,
    alarmLabel,
    onDragStart,
    actions,
    onMoveIncident,
  }: {
    incident: Incident;
    siteName: string;
    assetName: string;
    alarmLabel: string;
    onDragStart: (event: React.DragEvent<HTMLTableRowElement>) => void;
    actions: { label: string; target: 'new' | 'active' | 'completed' }[];
    onMoveIncident: (incidentId: string, target: 'new' | 'active' | 'completed') => void;
  }) => {
    // APP_NOTES: UX and UI Behaviors
    // *** row-click-navigation keyboard-support
    return (
      <tr
        draggable
        onDragStart={onDragStart}
        className="incidents-section__row"
        role="button"
        tabIndex={0}
        onClick={() => {
          window.location.hash = `#/incident/${incident.incidentId}`;
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            window.location.hash = `#/incident/${incident.incidentId}`;
          }
        }}
      >
        <td>{incident.priority}</td>
        <td>{siteName}</td>
        <td>{assetName}</td>
        <td>{alarmLabel}</td>
        <td>
          <StatusPill status={incident.stateId} />
        </td>
        <td>{formatTimestamp(incident.createdAt)}</td>
        <td className="incidents-section__actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="incidents-section__action"
              aria-label={`${action.label} for incident ${incident.incidentId}`}
              onClick={(event) => {
                event.stopPropagation();
                onMoveIncident(incident.incidentId, action.target);
              }}
            >
              {action.label}
            </button>
          ))}
        </td>
      </tr>
    );
  }
);

export const IncidentsSection: React.FC<IncidentsSectionProps> = ({
  title,
  incidents,
  sites,
  assets,
  alarms,
  onDropIncident,
  onDragStart,
  onMoveIncident,
  actions,
}) => {
  // build lookup maps so we avoid repeated array searches while rendering rows
  const siteMap = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const alarmMap = useMemo(() => new Map(alarms.map((alarm) => [alarm.alarmId, alarm])), [alarms]);
  const [visibleCount, setVisibleCount] = useState(25);

  // window the rows so render stays snappy w big datasets
  const visibleIncidents = useMemo(
    () => incidents.slice(0, visibleCount),
    [incidents, visibleCount]
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    // read incident id from drag payload and forward to parent
    event.preventDefault();
    const incidentId = event.dataTransfer.getData('text/plain');
    if (incidentId) {
      onDropIncident(incidentId);
    }
  };

  return (
    <section
      className="incidents-section"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <h2 className="incidents-section__title">{title}</h2>
      {incidents.length === 0 ? (
        <p className="incidents-section__empty">No incidents found.</p>
      ) : (
        <div
          className="incidents-section__table"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Site</th>
                <th>Asset</th>
                <th>Alarm</th>
                <th>Status</th>
                <th>Created</th>
                <th>Move</th>
              </tr>
            </thead>
            <tbody>
              {visibleIncidents.map((incident) => {
                const site = siteMap.get(incident.siteId);
                const asset = assetMap.get(incident.assetId);
                const alarm = alarmMap.get(incident.alarmId);
                const alarmLabel = `${alarm?.code ?? 'Unknown'}${alarm?.description ? ` ${alarm.description}` : ''}`;

                return (
                  <IncidentRow
                    key={incident.incidentId}
                    incident={incident}
                    siteName={site?.name ?? 'Unknown'}
                    assetName={asset?.displayName ?? 'Unknown'}
                    alarmLabel={alarmLabel}
                    onDragStart={(event) => onDragStart(incident.incidentId, event)}
                    actions={actions}
                    onMoveIncident={onMoveIncident}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {incidents.length > visibleCount ? (
        <button
          type="button"
          className="incidents-section__show-more"
          onClick={() => setVisibleCount((prev) => prev + 25)}
        >
          Show more
        </button>
      ) : null}
      <p className="incidents-section__hint">Drag incidents into another list to change status.</p>
    </section>
  );
};

/*
APP_NOTES: UX and UI Behaviors
- Row click navigation with keyboard support in IncidentsSection.tsx. This follows "discoverable, accessible navigation."
*/
