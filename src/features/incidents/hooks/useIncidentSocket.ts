// custom hook owns the websocket + exposes a small api
// rest of app just uses the api

import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { Catalog, Incident } from '../../../shared/types';
import { PROTOCOL_VERSION, ServerMessageSchema } from '../../../shared/schema';

export type ConnectionStatus = 'connected' | 'disconnected';

const emptyCatalog: Catalog = {
  escalationLevels: [],
  incidentTypes: [],
  sites: [],
  assets: [],
  alarms: [],
};

type IncidentAction =
  | { type: 'init'; incidents: Incident[] }
  | { type: 'add'; incident: Incident }
  | { type: 'update'; incident: Incident };

// reducer keeps incident list transitions explicit n testable
const incidentsReducer = (state: Incident[], action: IncidentAction) => {
  if (action.type === 'init') {
    return action.incidents;
  }

  if (action.type === 'add') {
    return [action.incident, ...state];
  }

  const exists = state.some((item) => item.incidentId === action.incident.incidentId);
  if (!exists) {
    return [action.incident, ...state];
  }
  return state.map((item) =>
    item.incidentId === action.incident.incidentId ? action.incident : item
  );
};

type UseIncidentSocketOptions = {
  socketUrl?: string;
  socketFactory?: (url: string) => WebSocket;
};

export const useIncidentSocket = (options: UseIncidentSocketOptions = {}) => {
  // store incidents + catalog as reactive state so ui updates
  const [incidents, dispatch] = useReducer(incidentsReducer, []);
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [readingIntervalMs, setReadingIntervalMs] = useState(2000);
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingIntervalRef = useRef<number | null>(null);
  const intervalTimeoutRef = useRef<number | null>(null);
  const suppressIntervalRequestRef = useRef(false);

  const clearIntervalTimeout = () => {
    if (intervalTimeoutRef.current !== null) {
      window.clearTimeout(intervalTimeoutRef.current);
      intervalTimeoutRef.current = null;
    }
  };

  const requestServerInterval = (nextInterval: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      pendingIntervalRef.current = nextInterval;
      clearIntervalTimeout();
      intervalTimeoutRef.current = window.setTimeout(() => {
        setLastError('Server did not confirm the reading interval change.');
      }, 1500);
      socketRef.current.send(
        JSON.stringify({ type: 'setReadingInterval', intervalMs: nextInterval })
      );
    }
  };

  // useEffectEvent keeps handler stable while reading fresh state
  // like user controlled interval that server must confirm
  const handleMessage = useEffectEvent((event: MessageEvent) => {
    // parse defensively so bad payloads dont crash the app
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    // shared schema validation keeps client/server aligned at runtime
    const parsedResult = ServerMessageSchema.safeParse(parsed);
    if (!parsedResult.success) {
      setLastError('Received an unexpected message shape from the server.');
      return;
    }
    const payload = parsedResult.data;

    if (payload.type === 'init') {
      // if protocol version changes, surface it instead of failing silently
      if (payload.protocolVersion && payload.protocolVersion !== PROTOCOL_VERSION) {
        setLastError(`Protocol mismatch: expected ${PROTOCOL_VERSION}, got ${payload.protocolVersion}.`);
      }
      // initial payload carries full catalog + current incident list
      if (payload.incidents) {
        dispatch({ type: 'init', incidents: payload.incidents });
      }
      if (payload.catalog) {
        // merge w defaults so fields dont go undefined if server restarts
        setCatalog({
          ...emptyCatalog,
          ...payload.catalog,
        });
      }
    }

    if (payload.type === 'incidentAdded') {
      // prepend latest incident so ui shows newest first
      const incident = payload.incident;
      if (!incident) {
        return;
      }
      dispatch({ type: 'add', incident });
    }

    if (payload.type === 'incidentUpdated') {
      // merge updates into list so row identity stays stable
      const incident = payload.incident;
      if (!incident) {
        return;
      }
      dispatch({ type: 'update', incident });
    }

    if (payload.type === 'readingIntervalUpdated') {
      // server side ack proves interval change was applied
      clearIntervalTimeout();
      pendingIntervalRef.current = null;
      if (payload.intervalMs !== readingIntervalMs) {
        // sync local ui to server interval w/out re-requesting
        suppressIntervalRequestRef.current = true;
        setReadingIntervalMs(payload.intervalMs);
      }
      setLastError(null);
    }

    if (payload.type === 'error') {
      // error channel from server so ui can surface issues
      setLastError(payload.message ?? 'Unexpected server error.');
    }
  });

  useEffect(() => {
    // establish persistent websocket connection on mount
    const socketHost = window.location.hostname || 'localhost';
    const socketUrl = options.socketUrl ?? `ws://${socketHost}:8080`;
    // allow dependency injection in tests so we can pass a fake socket impl
    const socket = options.socketFactory ? options.socketFactory(socketUrl) : new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setConnectionStatus('connected');
      setLastError(null);
      // send current ui selected interval so server matches client control
      requestServerInterval(readingIntervalMs);
    });

    socket.addEventListener('close', () => {
      setConnectionStatus('disconnected');
    });

    socket.addEventListener('message', handleMessage);

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (suppressIntervalRequestRef.current) {
      suppressIntervalRequestRef.current = false;
      return;
    }
    requestServerInterval(readingIntervalMs);
  }, [readingIntervalMs]);

  // send a brand new incident to the server
  const sendIncident = (incident: Incident) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'addIncident', incident }));
    }
  };

  // send a partial update (eg drag n drop state change) to the server
  const updateIncident = (incident: Incident) => {
    dispatch({ type: 'update', incident });

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'updateIncident', incident }));
    }
  };

  return {
    incidents,
    catalog,
    connectionStatus,
    readingIntervalMs,
    setReadingIntervalMs,
    lastError,
    sendIncident,
    updateIncident,
  };
};
