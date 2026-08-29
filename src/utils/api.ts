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

  // Resolve base URL if VITE_API_URL or runtime window.__API_URL__ is configured
  let targetUrl: RequestInfo | URL = input;
  const rawBaseUrl = (
    import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' && (window as any).__API_URL__) ||
    ''
  ).trim();
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');

  if (typeof input === 'string' && baseUrl && input.startsWith('/')) {
    targetUrl = `${baseUrl}${input}`;
  }

  return fetch(targetUrl, finalInit);
}

/**
 * Safely parses API Response into JSON.
 * Prevents "Unexpected token '<' is not valid JSON" crashes when receiving HTML error pages or SPA fallback.
 */
export async function parseApiResponse<T = any>(res: Response): Promise<{
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}> {
  const status = res.status;
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const json = await res.json();
      return {
        ok: res.ok,
        status,
        data: json,
        error: res.ok ? undefined : json.message || json.error || `خطأ في الخادم (${status})`,
      };
    } catch {
      return {
        ok: false,
        status,
        error: 'تعذر فك تشفير استجابة الخادم (JSON Parsing Error)',
      };
    }
  }

  const rawText = await res.text();
  if (rawText.includes('<!DOCTYPE html>') || rawText.includes('<html')) {
    return {
      ok: false,
      status,
      error: 'تعذر الاتصال بـ API: الخادم أعاد صفحة HTML (يرجى التأكد من تشغيل السيرفر أو ضبط VITE_API_URL)',
    };
  }

  return {
    ok: res.ok,
    status,
    error: rawText || `خطأ غير متوقع (${status})`,
  };
}

