// =============================================================================
// BTP Destination Service
//
// Resolves a destination by name, returning an HttpDestination that can be
// passed directly to the SAP Cloud SDK's executeHttpRequest().
//
// Resolution strategy:
//   1. If running on BTP (VCAP_SERVICES present), use @sap-cloud-sdk/connectivity
//      to resolve the named destination from the Destination Service.
//   2. If running locally (no VCAP_SERVICES), fall back to environment variables.
//      Two local modes are supported:
//        a. OAuth2 client-credentials (default) — requires TOKEN_URL, CLIENT_ID,
//           CLIENT_SECRET. The SDK handles token fetch/cache/refresh.
//        b. Anonymous (opt-in) — for public OData services (e.g. Northwind).
//           Set {PREFIX}_AUTH=none (or omit TOKEN_URL et al) with only BASE_URL.
// =============================================================================

import type { HttpDestination, HttpDestinationOrFetchOptions } from '@sap-cloud-sdk/connectivity';
import { logger } from '../utils/logger.js';

function getEnvVarPrefix(destinationName: string): string {
  return destinationName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

/**
 * Construct an HttpDestination from local environment variables.
 *
 * Required:
 *  - {PREFIX}_BASE_URL       Base URL of the target system
 *
 * For OAuth2 client-credentials (default when TOKEN_URL is set):
 *  - {PREFIX}_TOKEN_URL      OAuth2 token endpoint URL
 *  - {PREFIX}_CLIENT_ID      OAuth2 client ID
 *  - {PREFIX}_CLIENT_SECRET  OAuth2 client secret
 *
 * For anonymous / no-auth (public OData services):
 *  - Either omit TOKEN_URL / CLIENT_ID / CLIENT_SECRET, or set
 *    {PREFIX}_AUTH=none explicitly.
 *
 * For HTTP basic auth (useful for on-prem dev against S/4 over a tunnel):
 *  - {PREFIX}_AUTH=basic
 *  - {PREFIX}_USERNAME
 *  - {PREFIX}_PASSWORD
 */
function resolveLocal(destinationName: string): HttpDestination {
  const prefix = getEnvVarPrefix(destinationName);

  const baseUrl = process.env[`${prefix}_BASE_URL`];
  if (!baseUrl) {
    throw new Error(
      `Local fallback: ${prefix}_BASE_URL environment variable is not set. ` +
      'Provide the base URL of the target system.',
    );
  }
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  const authMode = (process.env[`${prefix}_AUTH`] ?? '').toLowerCase();
  const tokenUrl = process.env[`${prefix}_TOKEN_URL`];
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const username = process.env[`${prefix}_USERNAME`];
  const password = process.env[`${prefix}_PASSWORD`];

  // Explicit anonymous, OR no OAuth creds and no basic creds set.
  const looksAnonymous =
    authMode === 'none' ||
    (authMode === '' && !tokenUrl && !clientId && !clientSecret && !username && !password);

  if (looksAnonymous) {
    logger.info('Destination resolved via local fallback (anonymous / no auth)', {
      destinationName,
      baseUrl: normalizedBaseUrl,
    });
    return {
      url: normalizedBaseUrl,
      authentication: 'NoAuthentication',
    } satisfies HttpDestination;
  }

  if (authMode === 'basic' || (username && password)) {
    if (!username || !password) {
      throw new Error(
        `Local fallback: basic auth selected but ${prefix}_USERNAME or ${prefix}_PASSWORD is not set.`,
      );
    }
    logger.info('Destination resolved via local fallback (basic auth)', {
      destinationName,
      baseUrl: normalizedBaseUrl,
    });
    return {
      url: normalizedBaseUrl,
      authentication: 'BasicAuthentication',
      username,
      password,
    } satisfies HttpDestination;
  }

  // Default: OAuth2 client-credentials
  if (!tokenUrl) {
    throw new Error(
      `Local fallback: ${prefix}_TOKEN_URL environment variable is not set. ` +
      'Provide the OAuth2 token endpoint URL, or set ' +
      `${prefix}_AUTH=none for anonymous or ${prefix}_AUTH=basic for basic auth.`,
    );
  }
  if (!clientId) {
    throw new Error(
      `Local fallback: ${prefix}_CLIENT_ID environment variable is not set.`,
    );
  }
  if (!clientSecret) {
    throw new Error(
      `Local fallback: ${prefix}_CLIENT_SECRET environment variable is not set.`,
    );
  }

  logger.info('Destination resolved via local fallback (OAuth2 client-credentials)', {
    destinationName,
    baseUrl: normalizedBaseUrl,
  });

  return {
    url: normalizedBaseUrl,
    authentication: 'OAuth2ClientCredentials',
    tokenServiceUrl: tokenUrl,
    clientId,
    clientSecret,
  } satisfies HttpDestination;
}

/**
 * Resolve a named BTP destination and return an {@link HttpDestinationOrFetchOptions}
 * that can be passed directly to `executeHttpRequest()`.
 */
export async function resolveDestination(
  destinationName: string,
  jwt?: string,
): Promise<HttpDestinationOrFetchOptions> {
  try {
    const isOnBtp = Boolean(process.env.VCAP_SERVICES);

    if (isOnBtp) {
      logger.info('Using BTP Destination Service (lazy resolution via SDK)', { destinationName });
      return { destinationName, jwt, useCache: true } as HttpDestinationOrFetchOptions;
    }

    return resolveLocal(destinationName);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('Failed to resolve destination', {
      destinationName,
      error: message,
    });

    throw new Error(
      `Failed to resolve destination "${destinationName}": ${message}`,
    );
  }
}
