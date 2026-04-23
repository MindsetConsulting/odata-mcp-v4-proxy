import dotenv from 'dotenv';
import xsenv from '@sap/xsenv';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';
import type { EntitySetDefinition } from '../tools/registry.js';

// Load default-env.json first (populates VCAP_SERVICES for local BTP dev),
// then load .env for any remaining overrides.
xsenv.loadEnv();
dotenv.config();

const configSchema = z.object({
  mcpTransport: z.enum(['http', 'stdio']).default('http'),

  port: z.coerce.number().int().min(1).max(65535).default(4004),

  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  enabledApiCategories: z.string().default('all'),

  requestTimeout: z.coerce.number().int().positive().default(60000),

  apiConfigFile: z.string().default('api-config.json'),
});

type RawConfig = z.infer<typeof configSchema>;

export interface Config extends Omit<RawConfig, 'enabledApiCategories'> {
  enabledApiCategories: string[];
}

function parseCategories(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function loadConfig(): Config {
  const rawInput = {
    mcpTransport: process.env.MCP_TRANSPORT,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    enabledApiCategories: process.env.ENABLED_API_CATEGORIES,
    requestTimeout: process.env.REQUEST_TIMEOUT,
    apiConfigFile: process.env.API_CONFIG_FILE,
  };

  const result = configSchema.safeParse(rawInput);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Configuration validation failed:\n${issues}\n\nCheck your environment variables or .env file.`,
    );
  }

  const validated: RawConfig = result.data;

  return {
    ...validated,
    enabledApiCategories: parseCategories(validated.enabledApiCategories),
  };
}

export const config: Config = loadConfig();

// ─── API Configuration (loaded from static JSON) ────────────────────────────

/**
 * A single API backend: its BTP destination name, OData path prefix,
 * and the entity sets it exposes.
 *
 * For OData V4 the `pathPrefix` typically points at a service binding, e.g.
 *   "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001"
 * or for public services:
 *   "/V4/Northwind/Northwind.svc"
 */
export interface ApiDefinition {
  /** Logical name for this API (used for logging). */
  name: string;
  /** BTP Destination name (or local env var prefix) used to authenticate requests. */
  destination: string;
  /** OData V4 service path prefix (appended to the destination base URL). */
  pathPrefix: string;
  /** Entity sets exposed by this API. */
  entitySets: EntitySetDefinition[];
  /**
   * Whether mutating requests require a CSRF token (default: true).
   * SAP V4 services typically require CSRF; public services (Northwind) do not.
   */
  csrfProtected?: boolean;
}

export interface ApiConfig {
  server: {
    name: string;
    version: string;
    description: string;
  };
  apis: ApiDefinition[];
}

function loadApiConfig(filename: string): ApiConfig {
  let filePath: string;

  if (isAbsolute(filename)) {
    filePath = filename;
  } else {
    const cwdPath = join(process.cwd(), filename);
    if (existsSync(cwdPath)) {
      filePath = cwdPath;
    } else {
      const packageConfigDir = dirname(fileURLToPath(import.meta.url));
      filePath = join(packageConfigDir, filename);
    }
  }

  return JSON.parse(readFileSync(filePath, 'utf-8')) as ApiConfig;
}

export const apiConfig: ApiConfig = loadApiConfig(config.apiConfigFile);
