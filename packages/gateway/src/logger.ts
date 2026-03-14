/**
 * Structured JSON logger for the gateway.
 *
 * All events are emitted as single-line JSON objects with:
 * - event: human-readable event name
 * - sessionId: optional session context
 * - clientId: optional client identifier
 * - timestamp: ISO-8601 UTC timestamp
 *
 * Sensitive data (API keys, large payloads) is NEVER logged.
 *
 * @module
 */

export interface LogEntry {
  event: string;
  sessionId?: string;
  clientId?: string;
  timestamp: string;
  [key: string]: unknown;
}

/** Create a structured log entry and write it to stdout. */
export function log(
  event: string,
  data: Omit<LogEntry, 'event' | 'timestamp'> = {},
): void {
  const entry: LogEntry = {
    event,
    ...data,
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

/** Log an error event to stderr. */
export function logError(
  event: string,
  error: unknown,
  data: Omit<LogEntry, 'event' | 'timestamp'> = {},
): void {
  const entry: LogEntry = {
    event,
    ...data,
    error: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(entry));
}
