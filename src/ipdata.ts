import { isIP as netIsIP } from 'net';
import { LRUCache } from 'lru-cache';
import { fetch, Agent, type Dispatcher, type RequestInit, type Response } from 'undici';

const CACHE_MAX = 4096; // max number of items
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours
const KEEP_ALIVE_TIMEOUT = 1000 * 60; // close a pooled connection after 60 seconds idle
const KEEP_ALIVE_MAX_TIMEOUT = 1000 * 60 * 10; // upper bound when the server sends a larger keep-alive hint
const KEEP_ALIVE_PROBE_INTERVAL = 1000 * 30; // HTTP/2 PING and TCP keepalive probe interval
const DEFAULT_IP = 'DEFAULT_IP';
const VALID_FIELDS = [
  'ip',
  'is_eu',
  'is_satellite',
  'is_anycast',
  'city',
  'region',
  'region_code',
  'country_name',
  'country_code',
  'continent_name',
  'continent_code',
  'latitude',
  'longitude',
  'asn',
  'company',
  'organisation',
  'postal',
  'calling_code',
  'flag',
  'emoji_flag',
  'emoji_unicode',
  'carrier',
  'languages',
  'currency',
  'time_zone',
  'threat',
  'count',
  'status',
];
const BASE_URL = 'https://api.ipdata.co/';
export const EU_BASE_URL = 'https://eu-api.ipdata.co/';

function isValidIP(ip: string): boolean {
  return ip === DEFAULT_IP || netIsIP(ip) !== 0;
}

function isValidSelectField(field: string): boolean {
  const index = VALID_FIELDS.indexOf(field);

  if (index === -1) {
    throw new Error(`${field} is not a valid field.`);
  }

  return true;
}

function isValidFields(fields: string[]): boolean {
  if (!Array.isArray(fields)) {
    throw new Error('Fields should be an array.');
  }

  fields.forEach((field) => {
    const index = VALID_FIELDS.indexOf(field);
    if (index === -1) {
      throw new Error(`${field} is not a valid field.`);
    }
  });

  return true;
}

interface TransportError {
  code: string;
  message: string;
}

// fetch() rejects with a TypeError whose cause is the undici or socket error; find the first error carrying a code.
function findTransportError(error: unknown): TransportError | undefined {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    const { code, message, cause } = current as { code?: unknown; message?: unknown; cause?: unknown };

    if (typeof code === 'string') {
      return { code, message: typeof message === 'string' ? message : '' };
    }

    current = cause;
  }

  return undefined;
}

// True for a connection that was reset, closed (EOF) or broken while the request was in flight and before any
// response byte arrived: the usual symptom of a pooled connection the server dropped while it was idle.
function isStaleConnectionError(error: unknown): boolean {
  const transportError = findTransportError(error);

  if (!transportError) {
    return false;
  }

  const { code, message } = transportError;

  if (code === 'ECONNRESET' || code === 'EPIPE') {
    return true;
  }

  return (
    code === 'UND_ERR_SOCKET' &&
    (message === 'other side closed' || message === 'closed' || message.startsWith('HTTP/2: "GOAWAY"'))
  );
}

export interface CacheConfig {
  max?: number;
  ttl?: number;
}

export interface HttpConfig {
  /**
   * undici dispatcher to send requests through (for example a ProxyAgent, an EnvHttpProxyAgent or a MockAgent).
   * The caller owns it: close() leaves it open. http2 and keepAliveTimeout are ignored when it is set.
   */
  dispatcher?: Dispatcher;
  /** Negotiate HTTP/2 via ALPN, falling back to HTTP/1.1 when the server does not offer it. Default: true. */
  http2?: boolean;
  /** Milliseconds a pooled connection may stay idle before it is closed. Default: 60000. */
  keepAliveTimeout?: number;
}

export interface LookupParams {
  ip?: string;
  selectField?: string;
  fields?: string[];
}

export interface LookupResponse {
  ip: string;
  is_eu: boolean;
  /** true for satellite ISP addresses. The API includes the key only when it is true and omits it otherwise. */
  is_satellite?: boolean;
  /** true for anycast addresses. The API includes the key only when it is true and omits it otherwise. */
  is_anycast?: boolean;
  city?: string;
  region?: string;
  region_code?: string;
  country_name: string;
  country_code: string;
  continent_name: string;
  continent_code: string;
  latitude: number;
  longitude: number;
  postal?: string;
  calling_code: string;
  flag: string;
  emoji_flag: string;
  emoji_unicode: string;
  carrier?: {
    name: string;
    mcc: string;
    mnc: string;
  };
  asn: {
    asn: string;
    name: string;
    domain: string;
    route: string;
    type: string;
  };
  company?: {
    name: string;
    domain: string;
    network: string;
    type: string;
  };
  languages: { name: string; native: string; code?: string }[];
  currency: {
    name: string;
    code: string;
    symbol: string;
    native: string;
    plural: string;
  };
  time_zone: {
    name: string;
    abbr: string;
    offset: string;
    is_dst: boolean;
    current_time: string;
  };
  threat: {
    is_tor: boolean;
    is_proxy: boolean;
    is_anonymous: boolean;
    is_known_attacker: boolean;
    is_known_abuser: boolean;
    is_threat: boolean;
    is_bogon: boolean;
    is_icloud_relay?: boolean;
    is_datacenter?: boolean;
    blocklists?: {
      name: string;
      site: string;
      type: string;
      /** First day the address was seen on this list, as a YYYY-MM-DD string (UTC). Some feeds omit the dates. */
      first_seen?: string;
      /** Most recent day the address was seen on this list, as a YYYY-MM-DD string (UTC). */
      last_seen?: string;
      /** Number of days the address has been seen on this list. Omitted together with the dates. */
      days_seen?: number;
    }[];
  };
  count: number;
  status: number;
}

export class IPData {
  apiKey: string;
  baseUrl: string;
  cache: LRUCache<string, LookupResponse>;
  /** The dispatcher every request goes through: the injected one, or the Agent this instance created and owns. */
  readonly dispatcher: Dispatcher;
  private readonly ownedAgent?: Agent;

  constructor(apiKey: string, cacheConfig?: CacheConfig, baseUrl?: string, httpConfig?: HttpConfig) {
    if (typeof apiKey !== 'string') {
      throw new Error('An API key is required.');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl || BASE_URL;
    this.cache = new LRUCache<string, LookupResponse>({ max: CACHE_MAX, ttl: CACHE_TTL, ...cacheConfig });

    if (httpConfig?.dispatcher) {
      this.dispatcher = httpConfig.dispatcher;
    } else {
      // One connection pool per instance, kept for its whole lifetime: TCP + TLS are negotiated once and every
      // request is multiplexed over HTTP/2 or sent on a kept-alive HTTP/1.1 connection.
      this.ownedAgent = new Agent({
        allowH2: httpConfig?.http2 ?? true,
        keepAliveTimeout: httpConfig?.keepAliveTimeout ?? KEEP_ALIVE_TIMEOUT,
        keepAliveMaxTimeout: KEEP_ALIVE_MAX_TIMEOUT,
        pingInterval: KEEP_ALIVE_PROBE_INTERVAL,
        connect: { keepAliveInitialDelay: KEEP_ALIVE_PROBE_INTERVAL },
      });
      this.dispatcher = this.ownedAgent;
    }
  }

  /**
   * Closes the connection pool this instance created. Call it once at shutdown; a dispatcher supplied through
   * httpConfig is not touched. Idle pooled connections never keep the event loop alive, so this is optional.
   */
  async close(): Promise<void> {
    if (this.ownedAgent && !this.ownedAgent.closed) {
      await this.ownedAgent.close();
    }
  }

  private async request(url: URL, init?: RequestInit): Promise<Response> {
    const options: RequestInit = { ...init, dispatcher: this.dispatcher };

    try {
      return await fetch(url.toString(), options);
    } catch (error) {
      // undici does not retry a request that failed before any response byte arrived, for example because the
      // server closed the pooled connection while it was idle. That connection has already been discarded, so
      // send the request exactly once more. HTTP error statuses are responses, not failures, and never get here.
      if (!isStaleConnectionError(error)) {
        throw error;
      }

      return fetch(url.toString(), options);
    }
  }

  private buildUrl(...pathSegments: string[]): URL {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const path = pathSegments.filter(Boolean).join('/');
    const url = path ? new URL(path, base) : new URL(base);
    url.searchParams.set('api-key', this.apiKey);
    return url;
  }

  async lookup(params: LookupParams): Promise<LookupResponse>;
  async lookup(ip?: string, selectField?: string, fields?: string[]): Promise<LookupResponse>;
  async lookup(
    ipOrParams?: string | LookupParams,
    positionalSelectField?: string,
    positionalFields?: string[],
  ): Promise<LookupResponse> {
    let ip: string | undefined;
    let selectField: string | undefined;
    let fields: string[] | undefined;

    if (typeof ipOrParams === 'object' && ipOrParams !== null) {
      ({ ip, selectField, fields } = ipOrParams);
    } else if (typeof ipOrParams === 'string') {
      ip = ipOrParams;
      selectField = positionalSelectField;
      fields = positionalFields;
    } else {
      selectField = positionalSelectField;
      fields = positionalFields;
    }

    if (ip && !isValidIP(ip)) {
      throw new Error(`${ip} is an invalid IP address.`);
    }

    if (this.cache.has(ip || DEFAULT_IP)) {
      return this.cache.get(ip || DEFAULT_IP)!;
    }

    if (selectField && fields) {
      throw new Error('The selectField and fields parameters cannot be used at the same time.');
    }

    let urlPath = ip || '';

    if (selectField && isValidSelectField(selectField)) {
      urlPath = urlPath ? `${urlPath}/${selectField}` : selectField;
    }

    const url = this.buildUrl(urlPath);

    if (fields && isValidFields(fields)) {
      url.searchParams.set('fields', fields.join(','));
    }

    const response = await this.request(url);

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as object;
      return { ...errorData, status: response.status } as LookupResponse;
    }

    const responseData: unknown = await response.json();
    let data: LookupResponse;

    if (selectField) {
      data = { [selectField]: responseData, status: response.status } as unknown as LookupResponse;
    } else {
      data = { ...(responseData as Record<string, unknown>), status: response.status } as LookupResponse;
    }

    this.cache.set(ip || DEFAULT_IP, data);
    return this.cache.get(ip || DEFAULT_IP)!;
  }

  async bulkLookup(ips: string[], fields?: string[]): Promise<LookupResponse[]> {
    const responses: LookupResponse[] = [];
    const bulk: string[] = [];

    if (ips.length < 2) {
      throw new Error('Bulk Lookup requires more than 1 IP Address in the payload.');
    }

    ips.forEach((ip) => {
      if (!isValidIP(ip)) {
        throw new Error(`${ip} is an invalid IP address.`);
      }

      if (this.cache.has(ip)) {
        responses.push(this.cache.get(ip)!);
      } else {
        bulk.push(ip);
      }
    });

    if (fields && isValidFields(fields)) {
      // validation only — fields are passed as query params below
    }

    if (bulk.length > 0) {
      const url = this.buildUrl('bulk');

      if (fields) {
        url.searchParams.set('fields', fields.join(','));
      }

      const response = await this.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(bulk),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as object;
        return { ...errorData, status: response.status } as unknown as LookupResponse[];
      }

      const responseData = (await response.json()) as LookupResponse[];
      responseData.forEach((info) => {
        this.cache.set(info.ip, { ...info, status: response.status });
        responses.push(this.cache.get(info.ip)!);
      });
    }

    return responses;
  }
}

export default IPData;
