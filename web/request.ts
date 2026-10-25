type ApiErrorBody = { error?: { code?: string; message?: string; nativeRequestState?: unknown } };

export class RequestError extends Error {
  constructor(message: string, readonly code: string, readonly nativeRequestState?: 'not_started') { super(message); }
}

export async function readResponse<T>(response: Response): Promise<T> {
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new RequestError('The server returned an unreadable response. Check its status before trying again.', 'INVALID_RESPONSE'); }
  if (!response.ok) {
    const failure = body as ApiErrorBody;
    throw new RequestError(failure?.error?.message ?? 'The request could not be completed.', failure?.error?.code ?? 'REQUEST_FAILED',
      failure?.error?.nativeRequestState === 'not_started' ? 'not_started' : undefined);
  }
  return body as T;
}

/** Only the app's explicit pre-dispatch receipt releases this request. HTTP status
 * alone (including a proxy/provider 413 or 429) says nothing about side effects. */
export function nativePendingAfterFailure(requestId: string | null, error: unknown): string | null {
  return error instanceof RequestError && error.nativeRequestState === 'not_started' ? null : requestId;
}
