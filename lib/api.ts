export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.minebean.com';

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

export async function apiMutate<T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API ${path}: ${res.status}` }));
    throw new Error(err.error || `API ${path}: ${res.status}`);
  }
  return res.json();
}
