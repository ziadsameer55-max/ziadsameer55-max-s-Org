/**
 * Unified API Client for Halim Trading & Distribution Platform
 * 
 * Features:
 * - Centralized Base URL resolution (local dev, Vercel, production Cloud Run/VPS)
 * - Automatic Auth Token & Role injection
 * - In-flight Request Locking (Double-Submit / Double-Click prevention)
 * - Safe response parsing (Zero SyntaxError crash guarantee on 405/500/HTML pages)
 * - Automatic timeout with AbortController
 * - Automatic retry with exponential backoff for GET and idempotent requests
 * - Global 401 Session Expiration handler with event bus
 * - Request ID tracking and structured debugging
 */

export interface ApiRequestOptions extends RequestInit {
  timeout?: number;
  retry?: boolean | number;
  retryDelay?: number;
  skipAuth?: boolean;
  preventDuplicate?: boolean;
  customLockKey?: string;
  params?: Record<string, string | number | boolean | undefined | null>;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  success: boolean;
  status: number;
  data?: T;
  error?: string;
  code?: string;
  requestId?: string;
  isNetworkError?: boolean;
  isAuthExpired?: boolean;
  isTimeout?: boolean;
  rawResponse?: Response;
}

// Global in-flight mutation locks
const activeMutationLocks = new Set<string>();

/**
 * Generate a unique lock key for mutation requests to prevent accidental double-clicks
 */
function createMutationLockKey(method: string, url: string, body?: any): string {
  const normMethod = (method || 'GET').toUpperCase();
  let bodySummary = '';
  if (body) {
    try {
      bodySummary = typeof body === 'string' ? body.slice(0, 80) : JSON.stringify(body).slice(0, 80);
    } catch {}
  }
  return `${normMethod}:${url}:${bodySummary}`;
}

/**
 * Resolves the backend API base URL based on runtime environment
 */
export function getApiBaseUrl(): string {
  // 1. Explicit Vite Environment Variable
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 2. Global Window override (useful for runtime configuration without rebuild)
  if (typeof window !== 'undefined' && (window as any).__API_URL__) {
    const winUrl = String((window as any).__API_URL__).trim();
    if (winUrl) return winUrl.replace(/\/+$/, '');
  }

  // 3. Default relative path (same origin)
  return '';
}

/**
 * Safely retrieve current auth token from localStorage
 */
export function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = localStorage.getItem('halim_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      return (parsed && parsed.token) ? String(parsed.token).trim() : '';
    }
  } catch {}
  return '';
}

/**
 * Safely retrieve current user role from localStorage
 */
export function getUserRole(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = localStorage.getItem('halim_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      return (parsed && parsed.role) ? String(parsed.role).trim() : '';
    }
  } catch {}
  return '';
}

/**
 * Build authorized headers including Bearer token, Role, Content-Type, and Request-ID
 */
export function buildHeaders(
  customHeaders?: HeadersInit,
  hasBody?: boolean,
  skipAuth?: boolean
): Headers {
  const headers = new Headers(customHeaders || {});

  // Generate unique request ID for distributed tracing
  if (!headers.has('X-Request-Id')) {
    const reqId = 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    headers.set('X-Request-Id', reqId);
  }

  // Inject Auth Token
  if (!skipAuth) {
    const token = getAuthToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const role = getUserRole();
    if (role && !headers.has('X-User-Role')) {
      headers.set('X-User-Role', role);
    }
  }

  // Default Accept
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*');
  }

  // Set Content-Type to JSON if body is present and not already specified (and not FormData)
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

/**
 * Standard Arabic error message mapping based on HTTP status code
 */
export function getStatusFallbackError(status: number): string {
  switch (status) {
    case 400:
      return 'الطلب غير صحيح، يرجى مراجعة البيانات المدخلة والمحاولة مجدداً (400 Bad Request)';
    case 401:
      return 'انتهت صلاحية الجلسة أو يجب تسجيل الدخول مجدداً لمتابعة العملية (401 Unauthorized)';
    case 403:
      return 'عفواً، ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء (403 Forbidden)';
    case 404:
      return 'البيانات أو المسار المطلوب غير موجود في السيرفر (404 Not Found)';
    case 405:
      return 'طريقة الطلب غير مسموح بها (405 Method Not Allowed) - يرجى التأكد من اتصال التطبيق بالسيرفر وتحديث الصفحة';
    case 409:
      return 'تعارض في البيانات، قد يكون الإجراء تم تنفيذه بالفعل من قبل (409 Conflict)';
    case 422:
      return 'بيانات غير مقبولة أو ناقصة، يرجى مراجعة الحقول المطلوبة (422 Unprocessable Entity)';
    case 429:
      return 'تم تجاوز عدد المحاولات المسموح به مؤقتاً، يرجى الانتظار دقيقة واحدة ثم المحاولة (429 Rate Limit)';
    case 500:
      return 'حدث خطأ داخلي في الخادم أثناء معالجة الطلب (500 Internal Server Error)';
    case 502:
    case 503:
    case 504:
      return 'خادم النظام أو بوابة الاتصال غير متاحة حالياً، يرجى إعادة المحاولة بعد قليل';
    default:
      if (status >= 500) {
        return `حدث خطأ في استجابة الخادم (${status})، يرجى المحاولة مرة أخرى`;
      }
      return `حدث خطأ غير متوقع (${status})`;
  }
}

/**
 * Safely parse any API response without EVER throwing SyntaxError: Unexpected token '<'
 */
export async function safeParseResponse<T = any>(
  res: Response,
  requestId?: string
): Promise<ApiResponse<T>> {
  const status = res.status;
  const contentType = res.headers.get('content-type') || '';

  // 1. Detect HTML error pages (e.g. Vercel 405 static page fallback or 502 error gateway)
  if (contentType.includes('text/html')) {
    const rawHtml = await res.text().catch(() => '');
    let errorMsg = getStatusFallbackError(status);

    if (status === 405) {
      errorMsg = 'طريقة الطلب غير مسموح بها (405 Method Not Allowed): الخادم أعاد صفحة HTML ثابتة. يرجى التأكد من تشغيل خادم الـ API أو ضبط VITE_API_URL.';
    } else if (rawHtml.includes('<!DOCTYPE html>') || rawHtml.includes('<html')) {
      errorMsg = status >= 500
        ? `خطأ في خادم النظام (${status}): الخادم غير متاح حالياً أو يمر بإعادة تشغيل.`
        : `تعذر الاتصال بـ API: الخادم أعاد صفحة HTML بدلاً من JSON (${status}).`;
    }

    return {
      ok: false,
      success: false,
      status,
      error: errorMsg,
      requestId,
      rawResponse: res,
    };
  }

  // 2. Read response as text first to prevent JSON parse crash
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return {
      ok: false,
      success: false,
      status,
      error: 'تعذر قراءة استجابة الخادم',
      requestId,
      rawResponse: res,
    };
  }

  // 3. Empty response handling
  if (!rawText || !rawText.trim()) {
    return {
      ok: res.ok,
      success: res.ok,
      status,
      data: undefined,
      error: res.ok ? undefined : getStatusFallbackError(status),
      requestId,
      rawResponse: res,
    };
  }

  // 4. Try parsing as JSON
  try {
    const json = JSON.parse(rawText);
    const hasSuccessProp = typeof json === 'object' && json !== null && 'success' in json;
    const success = hasSuccessProp ? Boolean(json.success) : res.ok;
    const error = !success
      ? (json.message || json.error || getStatusFallbackError(status))
      : undefined;

    return {
      ok: res.ok && success,
      success,
      status,
      data: json as T,
      error,
      code: json.code,
      requestId,
      rawResponse: res,
    };
  } catch {
    // Text was not valid JSON
    return {
      ok: res.ok,
      success: res.ok,
      status,
      data: rawText as unknown as T,
      error: res.ok ? undefined : (rawText.slice(0, 150) || getStatusFallbackError(status)),
      requestId,
      rawResponse: res,
    };
  }
}

/**
 * Dispatches a global session expired notification and triggers cleanup
 */
function handleAuthExpired(status: number, url: string) {
  if (typeof window === 'undefined') return;

  const currentToken = getAuthToken();
  if (!currentToken) return; // already guest

  console.warn(`[apiClient] 401 Session Expired detected on: ${url}`);

  // Dispatch custom event for App.tsx and other components to react gracefully
  window.dispatchEvent(
    new CustomEvent('halim:session-expired', {
      detail: {
        status,
        url,
        message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً للمتابعة',
      },
    })
  );
}

/**
 * Main Centralized API Request Executor
 */
export async function executeApiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    timeout = 25000,
    retry = (options.method === 'GET' || !options.method) ? 2 : 0,
    retryDelay = 600,
    skipAuth = false,
    preventDuplicate = (options.method && options.method !== 'GET' && options.method !== 'HEAD'),
    customLockKey,
    params,
    ...fetchOptions
  } = options;

  // 1. Build Full Target URL
  const baseUrl = getApiBaseUrl();
  let fullUrl = endpoint;

  if (baseUrl && endpoint.startsWith('/')) {
    fullUrl = `${baseUrl}${endpoint}`;
  }

  // Append Query Parameters if provided
  if (params && typeof params === 'object') {
    const urlObj = new URL(fullUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        urlObj.searchParams.set(key, String(val));
      }
    });
    fullUrl = baseUrl && endpoint.startsWith('/') ? urlObj.toString() : urlObj.pathname + urlObj.search;
  }

  // 2. Double-Click / In-Flight Request Locking for Mutations
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const lockKey = customLockKey || (preventDuplicate ? createMutationLockKey(method, fullUrl, fetchOptions.body) : null);

  if (lockKey && activeMutationLocks.has(lockKey)) {
    console.warn(`[apiClient] In-flight request locked to prevent duplicate submission: ${lockKey}`);
    return {
      ok: false,
      success: false,
      status: 429,
      error: 'الطلب قيد التنفيذ بالفعل، يرجى الانتظار لحين اكتماله...',
      code: 'REQUEST_IN_FLIGHT',
    };
  }

  if (lockKey) {
    activeMutationLocks.add(lockKey);
  }

  // 3. Prepare Body & Headers
  let body = fetchOptions.body;
  const isPlainObject = body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob);
  if (isPlainObject) {
    body = JSON.stringify(body);
  }

  const headers = buildHeaders(fetchOptions.headers, Boolean(body), skipAuth);
  const requestId = headers.get('X-Request-Id') || undefined;

  // 4. Retry Loop with Exponential Backoff
  const maxRetries = typeof retry === 'number' ? Math.max(0, retry) : (retry ? 2 : 0);
  let attempt = 0;
  let lastErrorResponse: ApiResponse<T> | null = null;

  try {
    while (attempt <= maxRetries) {
      attempt++;

      // Create AbortController with Timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(fullUrl, {
          ...fetchOptions,
          method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check 401 Auth Expiration
        if (response.status === 401 && !skipAuth) {
          handleAuthExpired(response.status, fullUrl);
        }

        const parsed = await safeParseResponse<T>(response, requestId);

        // If successful or client error (4xx) other than 429, do not retry
        if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
          return parsed;
        }

        // 5xx Server Error or 429: Eligible for retry if attempts remain and method is idempotent
        lastErrorResponse = parsed;
        if (attempt <= maxRetries && (method === 'GET' || method === 'HEAD')) {
          await new Promise((res) => setTimeout(res, retryDelay * Math.pow(2, attempt - 1)));
          continue;
        }

        return parsed;
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);

        const isTimeout = fetchErr.name === 'AbortError';
        const isNetworkErr = !isTimeout;

        const errorMsg = isTimeout
          ? 'انتهت مهلة انتظار السيرفر (Timeout) - تعذر استلام الرد في الوقت المحدد، يرجى المحاولة مجدداً'
          : 'تعذر الاتصال بالخادم - يرجى التحقق من اتصال الإنترنت واستقرار الشبكة';

        lastErrorResponse = {
          ok: false,
          success: false,
          status: isTimeout ? 408 : 0,
          error: errorMsg,
          isNetworkError: isNetworkErr,
          isTimeout,
          requestId,
        };

        if (attempt <= maxRetries && (method === 'GET' || method === 'HEAD')) {
          await new Promise((res) => setTimeout(res, retryDelay * Math.pow(2, attempt - 1)));
          continue;
        }

        return lastErrorResponse;
      }
    }

    return lastErrorResponse || {
      ok: false,
      success: false,
      status: 0,
      error: 'فشل تنفيذ الطلب بعد عدة محاولات',
      requestId,
    };
  } finally {
    if (lockKey) {
      activeMutationLocks.delete(lockKey);
    }
  }
}

/**
 * High-level API Client Object
 */
export const apiClient = {
  get: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    executeApiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    executeApiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    executeApiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    executeApiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    executeApiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  fetch: executeApiRequest,
  getBaseUrl: getApiBaseUrl,
  getAuthToken,
  getUserRole,
};

export default apiClient;
