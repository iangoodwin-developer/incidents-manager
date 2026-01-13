// react router based routing w lazy loaded views

import React, { Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Catalog, Incident } from '../shared/types';
// APP_NOTES: Routing, Architecture, and Performance
// *** feature-first modularization
import { useIncidentSocket, ConnectionStatus } from '../features/incidents/hooks/useIncidentSocket';
import { ErrorBoundary } from '../shared/components/ErrorBoundary/ErrorBoundary';

// APP_NOTES: Routing, Architecture, and Performance
// *** route-based code splitting
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
      {/* *** todo-loading-icon */}
      <Suspense fallback={<p className="app__loading">Loading view...</p>}>
        <Routes>
          <Route
            path="/"
            element={
              // *** fault isolation per route
              // APP_NOTES: Routing, Architecture, and Performance
              <ErrorBoundary>
                <IncidentsRoute
                  incidents={incidents}
                  catalog={catalog}
                  connectionStatus={connectionStatus}
                  updateIncident={updateIncident}
                  lastError={lastError}
                />
              </ErrorBoundary>
            }
          />
          <Route
            path="/create"
            element={
              // *** fault isolation per route
              // APP_NOTES: Routing, Architecture, and Performance
              <ErrorBoundary>
                <CreateIncidentRoute
                  catalog={catalog}
                  connectionStatus={connectionStatus}
                  sendIncident={sendIncident}
                  lastError={lastError}
                />
              </ErrorBoundary>
            }
          />
          <Route
            path="/incident/:incidentId"
            element={
              // *** fault isolation per route
              // APP_NOTES: Routing, Architecture, and Performance
              <ErrorBoundary>
                <IncidentDetailRoute
                  incidents={incidents}
                  catalog={catalog}
                  connectionStatus={connectionStatus}
                  readingIntervalMs={readingIntervalMs}
                  setReadingIntervalMs={setReadingIntervalMs}
                  lastError={lastError}
                />
              </ErrorBoundary>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

/*
APP_NOTES: Routing, Architecture, and Performance
- React.lazy/Suspense for code splitting in AppRouter.tsx. This follows "route-based code splitting" to reduce initial bundle size and improve load time.
- Organized the codebase into feature-based folders (src/features, src/shared, src/app). This is "feature-first modularization," which improves scalability and ownership.
- Add an error boundary per route (catch UI crashes + show a fallback) in AppRouter.tsx. This is "fault isolation per route" so one page crash does not take down the entire app.

APP_NOTES: Todo
- Add a loading icon on pages.
*/
