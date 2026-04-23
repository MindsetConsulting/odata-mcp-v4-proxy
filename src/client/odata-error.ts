import type { ODataError } from '../types/odata.js';

/**
 * Structured error thrown when an OData API call fails.
 */
export class ODataApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly odataCode?: string,
    public readonly odataMessage?: string,
    public readonly target?: string,
  ) {
    super(message);
    this.name = 'ODataApiError';
  }
}

/**
 * Extract a human-readable string from an OData error `message` field.
 *
 * V4 spec: `message` is a plain string.
 * V2 spec: `message` is `{ lang: string, value: string }`.
 * Some SAP implementations mix the two. We handle both defensively.
 */
function extractMessage(message: unknown): string | undefined {
  if (typeof message === 'string') {
    return message;
  }
  if (message && typeof message === 'object' && 'value' in message) {
    const value = (message as { value?: unknown }).value;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

/**
 * Parse an OData V4 error response and return a structured {@link ODataApiError}.
 *
 * Accepts either a pre-parsed object (from axios/SDK response) or a raw JSON
 * string. Tolerates the V2 `message: { value }` shape as well so a fork user
 * pointing at a V2-legacy endpoint still gets readable messages.
 *
 * V4 error format:
 * ```json
 * { "error": { "code": "NotFound", "message": "Entity not found", "target": "id" } }
 * ```
 */
export function parseODataError(
  httpStatus: number,
  responseData: unknown,
): ODataApiError {
  if (!responseData) {
    return new ODataApiError(
      `OData API request failed with HTTP ${httpStatus}`,
      httpStatus,
    );
  }

  const toError = (parsed: ODataError): ODataApiError => {
    const code = parsed.error?.code;
    const message = extractMessage(parsed.error?.message);
    const target = parsed.error?.target;
    return new ODataApiError(
      message ?? `OData API request failed with HTTP ${httpStatus}`,
      httpStatus,
      code,
      message,
      target,
    );
  };

  if (typeof responseData === 'object') {
    return toError(responseData as ODataError);
  }

  if (typeof responseData === 'string') {
    try {
      return toError(JSON.parse(responseData) as ODataError);
    } catch {
      return new ODataApiError(
        `OData API request failed with HTTP ${httpStatus}: ${responseData.substring(0, 500)}`,
        httpStatus,
      );
    }
  }

  return new ODataApiError(
    `OData API request failed with HTTP ${httpStatus}`,
    httpStatus,
  );
}
