// =============================================================================
// OData V4 Response Wrappers and Query Option Types
//
// These types describe the shape of V4 JSON responses. Because this proxy
// is a thin forwarder (the LLM builds query strings itself), they are mainly
// documentation and are not actively enforced at runtime.
// =============================================================================

/**
 * Standard OData V4 collection response envelope.
 *
 * V4 wraps a collection under `value[]`. When `$count=true` is requested,
 * the server also returns `@odata.count`; server-driven paging supplies
 * `@odata.nextLink`.
 */
export interface ODataCollectionResponse<T> {
  /** Service metadata URL (V4 only) */
  '@odata.context'?: string;
  /** Metadata ETag (V4 only) */
  '@odata.metadataEtag'?: string;
  /** The collection itself */
  value: T[];
  /** Total count of matching entities, returned when $count=true */
  '@odata.count'?: number;
  /** Absolute URL for the next page of results */
  '@odata.nextLink'?: string;
}

/**
 * Standard OData V4 single-entity response envelope.
 *
 * V4 returns the entity properties at the top level with `@odata.*`
 * annotations (context, etag) alongside.
 */
export type ODataSingleResponse<T> = T & {
  '@odata.context'?: string;
  '@odata.etag'?: string;
};

/**
 * OData V4 error response envelope.
 *
 * V4 shape: `{ error: { code, message, target?, details?, innererror? } }`
 * where `message` is a plain string (not the `{ lang, value }` object used
 * by V2). SAP adapts this with additional fields (e.g. `SAP__Messages`).
 */
export interface ODataError {
  error: {
    /** Service-specific or OData error code */
    code: string;
    /** Human-readable error message (string in V4) */
    message: string;
    /** The target of a particular error (e.g. the property name) */
    target?: string;
    /** Zero or more detail entries */
    details?: Array<{
      code: string;
      message: string;
      target?: string;
    }>;
    /** SAP/vendor-specific inner error details */
    innererror?: unknown;
  };
}

/**
 * Common OData V4 system query options.
 *
 * Property names start with `$`. In V4, inline count is requested via
 * `$count=true` (boolean) rather than V2's `$inlinecount=allpages`.
 */
export interface ODataQueryOptions {
  /** Filter expression, e.g. "Status eq 'Active'" */
  $filter?: string;
  /** Comma-separated list of properties to return */
  $select?: string;
  /** Comma-separated navigation properties to expand inline */
  $expand?: string;
  /** Comma-separated sort expressions, e.g. "Name asc, Version desc" */
  $orderby?: string;
  /** Maximum number of entities to return */
  $top?: number;
  /** Number of entities to skip (for paging) */
  $skip?: number;
  /** Request an inline total count in the response */
  $count?: boolean;
  /** Search expression (V4 only) */
  $search?: string;
  /** Response format, e.g. "json" */
  $format?: string;
  /** Aggregation/transformation pipeline (V4 only) */
  $apply?: string;
  /** Computed properties (V4 only) */
  $compute?: string;
}
