export function getAuthToken(): string {
  try {
    const saved = localStorage.getItem('halim_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.token || '';
    }
  } catch {}
  return '';
}

export function getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  try {
    const saved = localStorage.getItem('halim_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.role) {
        headers['X-User-Role'] = parsed.role;
      }
    }
  } catch {}
  return headers;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const finalInit: RequestInit = { ...init };

  const headers = new Headers(finalInit.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  try {
    const saved = localStorage.getItem('halim_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.role && !headers.has('X-User-Role')) {
        headers.set('X-User-Role', parsed.role);
      }
    }
  } catch {}
  finalInit.headers = headers;

  // Resolve base URL if VITE_API_URL is configured (e.g. production external backend)
  let targetUrl: RequestInfo | URL = input;
  const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  if (typeof input === 'string' && baseUrl && input.startsWith('/')) {
    targetUrl = `${baseUrl}${input}`;
  }

  return fetch(targetUrl, finalInit);
}
