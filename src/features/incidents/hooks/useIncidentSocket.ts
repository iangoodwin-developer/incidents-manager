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
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
};

// APP_NOTES: Real-Time Data and Robustness
// *** custom-hook-side-effects
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
  // *** observability-hooks
  const onConnect = options.onConnect ?? (() => console.info('[ws] connected'));
  const onDisconnect = options.onDisconnect ?? (() => console.info('[ws] disconnected'));
  const onError = options.onError ?? ((message: string) => console.warn('[ws] error', message));

  const clearIntervalTimeout = () => {
    if (intervalTimeoutRef.current !== null) {
      window.clearTimeout(intervalTimeoutRef.current);
      intervalTimeoutRef.current = null;
    }
  };

  // *** server-source-of-truth interval-ack
  // APP_NOTES: Real-Time Data and Robustness
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
  // *** useEffectEvent-stable-handler
  const handleMessage = useEffectEvent((event: MessageEvent) => {
    // parse defensively so bad payloads dont crash the app
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    // shared schema validation keeps client/server aligned at runtime
    // APP_NOTES: Shared Contract / Schema Safety
    // *** shared-schema-runtime-validation
    const parsedResult = ServerMessageSchema.safeParse(parsed);
    if (!parsedResult.success) {
      const message = 'Received an unexpected message shape from the server.';
      setLastError(message);
      onError(message);
      return;
    }
    const payload = parsedResult.data;

    if (payload.type === 'init') {
      // if protocol version changes, surface it instead of failing silently
      if (payload.protocolVersion && payload.protocolVersion !== PROTOCOL_VERSION) {
        // APP_NOTES: Shared Contract / Schema Safety
        // *** protocol-version-guard
        const message = `Protocol mismatch: expected ${PROTOCOL_VERSION}, got ${payload.protocolVersion}.`;
        setLastError(message);
        onError(message);
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
      // APP_NOTES: Real-Time Data and Robustness
      // *** server-source-of-truth interval-ack
      // server side ack proves interval change was applied
      // *** todo-interval-ack-tests
      clearIntervalTimeout();
      const pendingInterval = pendingIntervalRef.current;
      pendingIntervalRef.current = null;

      if (pendingInterval === null) {
        // accept server changes initiated elsewhere (another view/tab)
        if (payload.intervalMs !== readingIntervalMs) {
          suppressIntervalRequestRef.current = true;
          setReadingIntervalMs(payload.intervalMs);
        }
        setLastError(null);
        return;
      }

      if (payload.intervalMs !== pendingInterval) {
        // sync local ui to server interval w/out re-requesting
        suppressIntervalRequestRef.current = true;
        setReadingIntervalMs(payload.intervalMs);
        const message = `Server interval is ${payload.intervalMs}ms, expected ${pendingInterval}ms.`;
        setLastError(message);
        onError(message);
        return;
      }
      setLastError(null);
    }

    if (payload.type === 'error') {
      // error channel from server so ui can surface issues
      const message = payload.message ?? 'Unexpected server error.';
      setLastError(message);
      onError(message);
    }
  });

  useEffect(() => {
    // establish persistent websocket connection on mount
    // APP_NOTES: Cleanup / Simplification
    const socketHost = window.location.hostname || 'localhost';
    // *** dependency-injection
    const socketUrl = options.socketUrl ?? `ws://${socketHost}:8080`;
    // allow dependency injection in tests so we can pass a fake socket impl
    const socket = options.socketFactory ? options.socketFactory(socketUrl) : new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setConnectionStatus('connected');
      setLastError(null);
      // send current ui selected interval so server matches client control
      requestServerInterval(readingIntervalMs);
      // lightweight analytics hook for connect events
      onConnect();
    });

    socket.addEventListener('close', () => {
      setConnectionStatus('disconnected');
      // lightweight analytics hook for disconnect events
      onDisconnect();
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
    // APP_NOTES: Todo
    // *** todo-offline-queue
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

/*
APP_NOTES: Routing, Architecture, and Performance
- Added dependency injection to useIncidentSocket (socketUrl/socketFactory) in useIncidentSocket.ts. This is testability via DI.

APP_NOTES: Real-Time Data and Robustness
- Centralized WebSocket state in useIncidentSocket to encapsulate side effects and expose a small API. This matches the "custom hook for side effects" pattern.
- Added server-controlled reading interval with acknowledgments and error handling in useIncidentSocket.ts. This is "server as source of truth" with explicit acks.
- Add lightweight analytics/logging hooks for WebSocket events (connect, disconnect, error) in useIncidentSocket.ts. This is "observability hooks" so you can attach logging without coupling UI logic.

APP_NOTES: Shared Contract / Schema Safety
- Introduced Zod schemas in schema.ts and validated WebSocket messages on both client and server. This represents "shared schema + runtime validation," preventing silent contract drift.
- Added protocol version checks in the client to catch mismatched versions early.

APP_NOTES: Cleanup / Simplification
- Updated WebSocket host to use window.location.hostname for mobile testing, enabling LAN access without changing code per environment.

APP_NOTES: Todo
- Add unit tests for edge cases in getIncidentsByType and for the interval ack flow.
- Add a small "offline mode" state (queue updates while disconnected, retry on reconnect).
*/
