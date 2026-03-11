export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function apiFetch(path: string, token: string | null, options?: RequestInit) {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}
