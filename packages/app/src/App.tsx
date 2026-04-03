/**
 * InfiniCanvas — Excalidraw-powered collaborative canvas.
 *
 * Mounts Excalidraw as the drawing engine and wires it to our
 * WebSocket gateway for real-time AI↔human collaboration.
 *
 * @module
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Excalidraw, exportToBlob, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

// Excalidraw types — using any for now to avoid deep import issues
type ExcalidrawImperativeAPI = any;
import { SettingsPanel } from './components/panels/SettingsPanel.js';
import { Settings } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────

const SETTINGS_STORAGE_KEY = 'infinicanvas:settings';

interface AppSettings {
  gatewayUrl: string;
  apiKey: string;
}

// ── Gateway connection hook ────────────────────────────────

function useGatewaySync(api: ExcalidrawImperativeAPI | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const suppressRemoteUpdate = useRef(false);
  const lastSentElements = useRef<string>('');

  // Keep apiRef in sync
  apiRef.current = api;
  const connect = useCallback(() => {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const settings: AppSettings = JSON.parse(raw);
    if (!settings.gatewayUrl || !settings.apiKey) return;

    setStatus('connecting');
    const ws = new WebSocket(settings.gatewayUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      ws.send(JSON.stringify({
        type: 'join',
        sessionId: 'local-dev',
        auth: { apiKey: settings.apiKey },
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'state-sync' && apiRef.current) {
        // Initial state from gateway — load existing elements
        const excalElements = msg.excalidrawElements ?? [];
        if (excalElements.length > 0) {
          suppressRemoteUpdate.current = true;
          const converted = convertToExcalidrawElements(excalElements as any[]);
          apiRef.current.updateScene({ elements: converted as any[] });
          suppressRemoteUpdate.current = false;
        }
      }

      if (msg.type === 'scene-update' && apiRef.current) {
        // Remote change from another client (AI or human)
        suppressRemoteUpdate.current = true;
        const converted = convertToExcalidrawElements(msg.elements as any[]);
        apiRef.current.updateScene({ elements: converted as any[] });
        suppressRemoteUpdate.current = false;
      }

      if (msg.type === 'screenshot-request') {
        // AI wants a screenshot — export via Excalidraw API
        if (apiRef.current) {
          const elements = apiRef.current.getSceneElements();
          if (elements.length > 0) {
            exportToBlob({
              elements,
              appState: apiRef.current.getAppState(),
              files: apiRef.current.getFiles(),
              mimeType: 'image/png',
            }).then((blob: Blob) => {
              const reader = new FileReader();
              reader.onload = () => {
                ws.send(JSON.stringify({
                  type: 'screenshot-response',
                  requestId: msg.requestId,
                  imageBase64: reader.result as string,
                  width: 1920,
                  height: 1080,
                }));
              };
              reader.readAsDataURL(blob);
            }).catch(() => {
              ws.send(JSON.stringify({
                type: 'screenshot-response',
                requestId: msg.requestId,
                imageBase64: '',
                width: 0,
                height: 0,
              }));
            });
          }
        }
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
    };

    ws.onerror = () => {
      setStatus('disconnected');
    };
  }, []);

  // Connect on mount and when API becomes available
  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  // Reconnect on settings change
  useEffect(() => {
    const handler = () => {
      wsRef.current?.close();
      setTimeout(connect, 100);
    };
    window.addEventListener('infinicanvas:settings-changed', handler);
    return () => window.removeEventListener('infinicanvas:settings-changed', handler);
  }, [connect]);

  // Send local changes to gateway
  const onLocalChange = useCallback((elements: readonly any[]) => {
    if (suppressRemoteUpdate.current) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Simple debounce: only send if elements actually changed
    const serialized = JSON.stringify(elements);
    if (serialized === lastSentElements.current) return;
    lastSentElements.current = serialized;

    ws.send(JSON.stringify({
      type: 'scene-update',
      elements,
    }));
  }, []);

  return { status, onLocalChange };
}

// ── App component ──────────────────────────────────────────

export default function App() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const gateway = useGatewaySync(api);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Excalidraw
        excalidrawAPI={(excalidrawApi) => setApi(excalidrawApi)}
        onChange={(elements) => {
          gateway.onLocalChange(elements);
        }}
      />

      {/* Connection status indicator */}
      <div style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 100,
      }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: gateway.status === 'connected' ? '#4caf50'
            : gateway.status === 'connecting' ? '#ff9800' : '#999',
        }} />
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: '#666',
          }}
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
