export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

/**
 * Subscribe to a backend SSE stream.
 * @param path - SSE endpoint path
 * @param onEvent - callback receiving (eventName, parsedData)
 * @param events - event names to listen for (defaults to global round events)
 * Returns a cleanup function to close the connection.
 */
export function sseSubscribe(
  path: string,
  onEvent: (event: string, data: unknown) => void,
  events: string[] = ['gameStarted', 'deployed', 'roundSettled'],
): () => void {
  const source = new EventSource(`${API_BASE}${path}`);

  const handleEvent = (type: string) => (e: MessageEvent) => {
    try {
      onEvent(type, JSON.parse(e.data));
    } catch {
      onEvent(type, e.data);
    }
  };

  events.forEach((evt) => source.addEventListener(evt, handleEvent(evt)));

  source.onerror = () => {
    // EventSource auto-reconnects; nothing extra needed
  };

  return () => source.close();
}
