// separate page for creating a new incident w/out list filters
// keeps creation flow focused and easy to demo

import React, { useEffect, useRef, useState } from 'react';
import { Catalog, Incident } from '../../../shared/types';
import { INCIDENT_STATE_OPTIONS, INCIDENT_STATES, IncidentState } from '../../../shared/constants';
import { ConnectionStatus } from '../hooks/useIncidentSocket';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { ConnectionBanner } from '../../../shared/components/ConnectionBanner/ConnectionBanner';

const createEmptyForm = () => ({
  incidentId: '',
  siteId: '',
  assetId: '',
  alarmId: '',
  priority: 1,
  stateId: INCIDENT_STATES.OPEN as IncidentState,
  escalationLevelId: '',
  incidentTypeId: '',
});

type IncidentFormState = ReturnType<typeof createEmptyForm>;

interface CreateIncidentPageProps {
  catalog: Catalog;
  connectionStatus: ConnectionStatus;
  sendIncident: (incident: Incident) => void;
  lastError: string | null;
};

const isIncidentIdValid = (value: string) => /^[a-z0-9-]{3,32}$/i.test(value);

export const CreateIncidentPage: React.FC<CreateIncidentPageProps> = ({
  catalog,
  connectionStatus,
  sendIncident,
  lastError,
}) => {
  // form state lives locally so inputs stay controlled
  const [formState, setFormState] = useState<IncidentFormState>(createEmptyForm());
  const [incidentIdError, setIncidentIdError] = useState<string | null>(null);
  const isSubmitDisabled = Boolean(incidentIdError);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isSubmitFloating, setIsSubmitFloating] = useState(false);

  useEffect(() => {
    // prefill dropdowns w first catalog entries once data is loaded
    if (
      !(catalog.escalationLevels ?? []).length &&
      !(catalog.incidentTypes ?? []).length &&
      !(catalog.sites ?? []).length &&
      !(catalog.assets ?? []).length &&
      !(catalog.alarms ?? []).length
    ) {
      return;
    }

    setFormState((prev) => ({
      ...prev,
      siteId: prev.siteId || (catalog.sites ?? [])[0]?.id || '',
      assetId: prev.assetId || (catalog.assets ?? [])[0]?.id || '',
      alarmId: prev.alarmId || (catalog.alarms ?? [])[0]?.alarmId || '',
      escalationLevelId: prev.escalationLevelId || (catalog.escalationLevels ?? [])[0]?.id || '',
      incidentTypeId: prev.incidentTypeId || (catalog.incidentTypes ?? [])[0]?.id || '',
    }));
  }, [catalog]);

  useEffect(() => {
    // show floating submit btn when real one scrolls off screen
    const button = submitButtonRef.current;
    if (!button) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsSubmitFloating(!entry.isIntersecting);
      },
      { root: null, threshold: 0.1 }
    );

    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  const handleFormChange = (field: keyof IncidentFormState, value: string) => {
    // normalize numeric inputs so payload stays typed right
    setFormState((prev) => {
      if (field === 'priority') {
        return { ...prev, [field]: Number(value) };
      }
      return { ...prev, [field]: value };
    });

    if (field === 'incidentId') {
      // frontend validation keeps obvious errors out before we send to server
      const trimmed = value.trim();
      setIncidentIdError(
        trimmed && !isIncidentIdValid(trimmed)
          ? 'Use 3-32 characters: letters, numbers, or hyphens.'
          : null
      );
    }
  };

  const submitIncident = (event: React.FormEvent<HTMLFormElement>) => {
    // build new incident payload and send it thru websocket
    event.preventDefault();
    const trimmedId = formState.incidentId.trim();
    if (trimmedId && !isIncidentIdValid(trimmedId)) {
      setIncidentIdError('Use 3-32 characters: letters, numbers, or hyphens.');
      return;
    }
    const incidentId = trimmedId || `inc-${Date.now()}`;
    const newIncident: Incident = {
      incidentId,
      siteId: formState.siteId,
      assetId: formState.assetId,
      alarmId: formState.alarmId,
      priority: formState.priority,
      createdAt: new Date().toISOString(),
      stateId: formState.stateId,
      escalationLevelId: formState.escalationLevelId,
      incidentTypeIds: formState.incidentTypeId ? [formState.incidentTypeId] : [],
    };

    sendIncident(newIncident);

    // reset only fields that feel safe to clear for quick entry
    setFormState((prev) => ({
      ...prev,
      incidentId: '',
      priority: 1,
    }));
    setIncidentIdError(null);
  };

  return (
    <div className="create-page">
      <PageHeader title="Create incident" statusLabel={`WebSocket: ${connectionStatus}`}>
        <nav className="create-page__nav">
          <a href="#/">Back to incidents</a>
        </nav>
      </PageHeader>

      <ConnectionBanner status={connectionStatus} />
      {lastError ? (
        <div className="app-error" role="alert">
          {lastError}
        </div>
      ) : null}

      <main className="create-page__content">
        <form onSubmit={submitIncident} className="create-page__form">
          <label className="create-page__field">
            <span className="create-page__label">Incident ID (optional)</span>
            <input
              type="text"
              value={formState.incidentId}
              onChange={(event) => handleFormChange('incidentId', event.target.value)}
              aria-invalid={incidentIdError ? 'true' : 'false'}
              aria-describedby={incidentIdError ? 'incident-id-error' : undefined}
            />
            {incidentIdError ? (
              <span id="incident-id-error" className="create-page__error" role="alert">
                {incidentIdError}
              </span>
            ) : null}
          </label>
          <label className="create-page__field">
            <span className="create-page__label">Site</span>
            <select
              value={formState.siteId}
              onChange={(event) => handleFormChange('siteId', event.target.value)}
            >
              {(catalog.sites ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="create-page__field">
            <span className="create-page__label">Asset</span>
            <select
              value={formState.assetId}
              onChange={(event) => handleFormChange('assetId', event.target.value)}
            >
              {(catalog.assets ?? []).map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="create-page__field">
            <span className="create-page__label">Alarm</span>
            <select
              value={formState.alarmId}
              onChange={(event) => handleFormChange('alarmId', event.target.value)}
            >
              {(catalog.alarms ?? []).map((alarm) => (
                <option key={alarm.alarmId} value={alarm.alarmId}>
                  {alarm.code}
                </option>
              ))}
            </select>
          </label>
          <label className="create-page__field">
            <span className="create-page__label">Priority</span>
            <input
              type="number"
              min={1}
              max={5}
              value={formState.priority}
              onChange={(event) => handleFormChange('priority', event.target.value)}
            />
          </label>
          <label className="create-page__field">
            <span className="create-page__label">State</span>
            <select
              value={formState.stateId}
              onChange={(event) => handleFormChange('stateId', event.target.value)}
            >
              {INCIDENT_STATE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="create-page__field">
            <span className="create-page__label">Escalation level</span>
            <select
              value={formState.escalationLevelId}
              onChange={(event) => handleFormChange('escalationLevelId', event.target.value)}
            >
              {(catalog.escalationLevels ?? []).map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>
          <label className="create-page__field">
            <span className="create-page__label">Incident type</span>
            <select
              value={formState.incidentTypeId}
              onChange={(event) => handleFormChange('incidentTypeId', event.target.value)}
            >
              {(catalog.incidentTypes ?? []).map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <button
            ref={submitButtonRef}
            type="submit"
            className="create-page__button"
            disabled={isSubmitDisabled}
            aria-disabled={isSubmitDisabled ? 'true' : 'false'}
          >
            Send incident
          </button>
        </form>
      </main>
      <div
        className={`create-page__floating-actions${isSubmitFloating ? ' create-page__floating-actions--visible' : ''
          }`}
        aria-hidden={isSubmitFloating ? 'false' : 'true'}
      >
        <button
          type="submit"
          className="create-page__button create-page__button--floating"
          disabled={isSubmitDisabled}
          aria-disabled={isSubmitDisabled ? 'true' : 'false'}
          onClick={(event) => {
            if (isSubmitDisabled) {
              event.preventDefault();
            }
          }}
        >
          Send incident
        </button>
      </div>
    </div>
  );
};
