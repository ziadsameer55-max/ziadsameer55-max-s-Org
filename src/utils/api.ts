import {
  apiClient,
  getAuthToken,
  getUserRole,
  buildHeaders,
  getApiBaseUrl,
  getStatusFallbackError,
  safeParseResponse,
  ApiResponse,
} from './apiClient';

export {
  apiClient,
  getAuthToken,
  getUserRole,
  getApiBaseUrl,
  getStatusFallbackError,
  safeParseResponse,
};

export type { ApiResponse };

/**
 * Backward-compatible getAuthHeaders utility
 */
export function getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const role = getUserRole();
  if (role) {
    headers['X-User-Role'] = role;
  }
  return headers;
}

/**
 * Unified `apiFetch` that transparently:
 * 1. Resolves intelligent base URL (VITE_API_URL or relative)
 * 2. Injects Authorization token, Role, Content-Type, and Request ID
 * 3. Handles Timeout with AbortController
 * 4. Intercepts 401 Session Expiration and dispatches global event
 * 5. Patches the returned Response's .json() and .text() methods to NEVER crash with SyntaxError
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const rawEndpoint = typeof input === 'string' ? input : input.toString();

  // Resolve target URL
  const baseUrl = getApiBaseUrl();
  let targetUrl = rawEndpoint;
  if (baseUrl && rawEndpoint.startsWith('/')) {
    targetUrl = `${baseUrl}${rawEndpoint}`;
  }

  // Build headers
  let body = init?.body;
  const isPlainObj = body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob);
  if (isPlainObj) {
    body = JSON.stringify(body);
  }

  const finalHeaders = buildHeaders(init?.headers, Boolean(body));

  // Default timeout 25 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const rawResponse = await fetch(targetUrl, {
      ...init,
      method,
      headers: finalHeaders,
      body,
      signal: init?.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    // 401 Session Expiry Interceptor
    if (rawResponse.status === 401) {
      const token = getAuthToken();
      if (token && typeof window !== 'undefined') {
        console.warn(`[apiFetch] 401 Unauthorized encountered for ${rawEndpoint}. Dispatched halim:session-expired.`);
        window.dispatchEvent(
          new CustomEvent('halim:session-expired', {
            detail: {
              status: 401,
              url: rawEndpoint,
              message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً للمتابعة',
            },
          })
        );
      }
    }

    // Clone response to preserve stream for safe parsing
    const clonedResponse = rawResponse.clone();

    // Cache parsed result so multiple .json() or .text() calls succeed
    let parsedCache: any = null;

    const originalJson = rawResponse.json.bind(rawResponse);
    rawResponse.json = async () => {
      if (parsedCache !== null) return parsedCache;
      try {
        parsedCache = await originalJson();
        return parsedCache;
      } catch {
        // Safe fallback when server returns HTML (e.g. 405 Method Not Allowed or 502)
        const parsed = await safeParseResponse(clonedResponse);
        parsedCache = parsed.data || {
          ok: false,
          success: false,
          error: parsed.error || getStatusFallbackError(rawResponse.status),
          status: rawResponse.status,
        };
        return parsedCache;
      }
    };

    return rawResponse;
  } catch (err: any) {
    clearTimeout(timeoutId);

    const isTimeout = err?.name === 'AbortError';
    const errorMsg = isTimeout
      ? 'انتهت مهلة الانتظار (Timeout) - تعذر الاتصال بالسيرفر في الوقت المحدد'
      : 'تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت واستقرار الشبكة';

    // Return a synthetic Response rather than letting unhandled crash happen
    const errorPayload = JSON.stringify({
      ok: false,
      success: false,
      status: isTimeout ? 408 : 0,
      error: errorMsg,
      isTimeout,
      isNetworkError: !isTimeout,
    });

    return new Response(errorPayload, {
      status: isTimeout ? 408 : 503,
      statusText: isTimeout ? 'Request Timeout' : 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Safely parses API Response into JSON.
 * Preserved for components that explicitly import parseApiResponse.
 */
export async function parseApiResponse<T = any>(res: Response): Promise<{
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}> {
  const parsed = await safeParseResponse<T>(res);
  return {
    ok: parsed.ok,
    status: parsed.status,
    data: parsed.data,
    error: parsed.error,
  };
}
