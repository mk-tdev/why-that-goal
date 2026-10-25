let csrf: string | undefined;
export function setSessionCsrf(value?: string) {
  csrf = value;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public retryAfter: number,
    public requestId: string | null,
  ) {
    super(`API request failed (${status})`);
  }
}
export async function securedFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (csrf && init.method && init.method !== 'GET') headers.set('X-CSRF-Token', csrf);
  const response = await fetch(input, { ...init, headers, credentials: 'same-origin' });
  if (response.status === 401 && typeof window !== 'undefined')
    window.dispatchEvent(new Event('wtg-session-expired'));
  if (!response.ok)
    throw new ApiError(
      response.status,
      Math.max(1, Math.min(60, Number(response.headers.get('Retry-After')) || 1)),
      response.headers.get('X-Request-Id'),
    );
  return response;
}
