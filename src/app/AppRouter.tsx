// react router based routing w lazy loaded views

import React, { Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Catalog, Incident } from '../shared/types';
import { useIncidentSocket, ConnectionStatus } from '../features/incidents/hooks/useIncidentSocket';

const CreateIncidentPage = React.lazy(() =>
  import('../features/incidents/pages/CreateIncidentPage').then((module) => ({
    default: module.CreateIncidentPage,
  }))
);
const IncidentsPage = React.lazy(() =>
  import('../features/incidents/pages/IncidentsPage').then((module) => ({
    default: module.IncidentsPage,
  }))
);
const IncidentDetailPage = React.lazy(() =>
  import('../features/incidents/pages/IncidentDetailPage').then((module) => ({
    default: module.IncidentDetailPage,
  }))
);

type SharedRouteProps = {
  incidents: Incident[];
  catalog: Catalog;
  connectionStatus: ConnectionStatus;
};

const IncidentDetailRoute: React.FC<
  SharedRouteProps & {
    readingIntervalMs: number;
    setReadingIntervalMs: (value: number) => void;
    lastError: string | null;
  }
> = ({
  incidents,
  catalog,
  connectionStatus,
  readingIntervalMs,
  setReadingIntervalMs,
  lastError,
}) => {
  const { incidentId } = useParams();
  const incident = incidents.find((item) => item.incidentId === incidentId);
  return (
    <IncidentDetailPage
      incident={incident}
      catalog={catalog}
      connectionStatus={connectionStatus}
      readingIntervalMs={readingIntervalMs}
      setReadingIntervalMs={setReadingIntervalMs}
      lastError={lastError}
    />
  );
};

const IncidentsRoute: React.FC<
  SharedRouteProps & {
    updateIncident: (incident: Incident) => void;
    lastError: string | null;
  }
> = ({ incidents, catalog, connectionStatus, updateIncident, lastError }) => (
  <IncidentsPage
    incidents={incidents}
    catalog={catalog}
    connectionStatus={connectionStatus}
    updateIncident={updateIncident}
    lastError={lastError}
  />
);

const CreateIncidentRoute: React.FC<
  Omit<SharedRouteProps, 'incidents'> & {
    sendIncident: (incident: Incident) => void;
    lastError: string | null;
  }
> = ({ catalog, connectionStatus, sendIncident, lastError }) => (
  <CreateIncidentPage
    catalog={catalog}
    connectionStatus={connectionStatus}
    sendIncident={sendIncident}
    lastError={lastError}
  />
);

export const AppRouter: React.FC = () => {
  const {
    incidents,
    catalog,
    connectionStatus,
    sendIncident,
    updateIncident,
    readingIntervalMs,
    setReadingIntervalMs,
    lastError,
  } = useIncidentSocket();

  return (
    <HashRouter>
      <Suspense fallback={<p className="app__loading">Loading view...</p>}>
        <Routes>
          <Route
            path="/"
            element={
              <IncidentsRoute
                incidents={incidents}
                catalog={catalog}
                connectionStatus={connectionStatus}
                updateIncident={updateIncident}
                lastError={lastError}
              />
            }
          />
          <Route
            path="/create"
            element={
              <CreateIncidentRoute
                catalog={catalog}
                connectionStatus={connectionStatus}
                sendIncident={sendIncident}
                lastError={lastError}
              />
            }
          />
          <Route
            path="/incident/:incidentId"
            element={
              <IncidentDetailRoute
                incidents={incidents}
                catalog={catalog}
                connectionStatus={connectionStatus}
                readingIntervalMs={readingIntervalMs}
                setReadingIntervalMs={setReadingIntervalMs}
                lastError={lastError}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};
