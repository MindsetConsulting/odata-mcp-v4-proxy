# odata-mcp-v4-proxy

Config-driven MCP proxy that exposes **OData V4** APIs as MCP tools.
Fork of [`odata-mcp-proxy`](https://github.com/lemaiwo/odata-mcp-proxy) by
Wouter Lemaire, adapted for V4.

## What changed vs. upstream

`odata-mcp-proxy` is V2-only (uses `$inlinecount`, assumes `d.results[]` envelope,
etc.). This fork:

- **Response shape types** updated for V4 (`value[]`, `@odata.context`,
  `@odata.count`, `@odata.nextLink`, `@odata.etag` — see `src/types/odata.ts`)
- **Query options** updated for V4 (`$count=true`, `$search`, `$apply`,
  `$compute`)
- **Error parser** handles V4 shape (`error.message` as string) and tolerates
  V2's `error.message.value` shape for legacy endpoints
- **Anonymous local auth mode** added to the destination service, so you can
  point the proxy at public OData V4 services (Northwind) without credentials.
  Basic auth mode added too, useful for on-prem S/4 via tunnel.

The **tool registration is unchanged** — it's a thin proxy. Each entity set
becomes `{EntitySet}_list`, `{EntitySet}_get`, etc., and the LLM constructs
V4 query strings itself when calling the tool.

## Quick start — Northwind V4 demo

```bash
cd packages/odata-mcp-v4-proxy
npm install
cp examples/northwind/.env.example .env
npm run dev:northwind
```

Then point an MCP client at `http://localhost:4004/mcp` or run the
Inspector:

```bash
npm run inspect:http
```

## Config format

Same shape as upstream (`api-config.json`):

```jsonc
{
  "server": { "name": "...", "version": "...", "description": "..." },
  "apis": [
    {
      "name": "...",
      "destination": "NORTHWIND_V4",              // BTP destination OR env var prefix
      "pathPrefix": "/V4/Northwind/Northwind.svc", // V4 service root
      "csrfProtected": false,                      // true for SAP V4 endpoints
      "entitySets": [
        {
          "entitySet": "Customers",
          "description": "...",
          "category": "customers",
          "keys": [{ "name": "CustomerID", "type": "string" }],
          "operations": { "list": true, "get": true, "create": false, "update": false, "delete": false },
          "filterableProperties": ["CompanyName", "City"],
          "navigationProperties": [
            { "name": "Orders", "description": "...", "isCollection": true }
          ]
        }
      ]
    }
  ]
}
```

For SAP S/4HANA V4, `pathPrefix` points at the service binding URL:
`/sap/opu/odata4/sap/<service_group>/srvd_a2x/sap/<service>/<version>`

## Local destination auth modes

Prefix environment variables with the destination name, uppercase, with
non-alphanumeric chars replaced by `_`.

| Mode | Set |
|---|---|
| Anonymous | `{PREFIX}_AUTH=none` (or just set `{PREFIX}_BASE_URL` alone) |
| Basic | `{PREFIX}_AUTH=basic` + `{PREFIX}_USERNAME` + `{PREFIX}_PASSWORD` |
| OAuth2 client-credentials | `{PREFIX}_TOKEN_URL` + `{PREFIX}_CLIENT_ID` + `{PREFIX}_CLIENT_SECRET` |

When `VCAP_SERVICES` is present (running on BTP), the SDK resolves the
destination by name via the BTP Destination Service and all local env vars
are ignored.

## Attribution

This project is a fork of [`odata-mcp-proxy`](https://github.com/lemaiwo/odata-mcp-proxy)
by Wouter Lemaire, licensed under MIT. See `LICENSE`.
