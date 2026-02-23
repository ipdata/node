import { isIP as netIsIP } from 'net';
import { LRUCache } from 'lru-cache';

const CACHE_MAX = 4096; // max number of items
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours
const DEFAULT_IP = 'DEFAULT_IP';
const VALID_FIELDS = [
  'ip',
  'is_eu',
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

export interface CacheConfig {
  max?: number;
  ttl?: number;
}

export interface LookupResponse {
  ip: string;
  is_eu: boolean;
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
    blocklists?: { name: string; site: string; type: string }[];
  };
  count: number;
  status: number;
}

export class IPData {
  apiKey: string;
  baseUrl: string;
  cache: LRUCache<string, LookupResponse>;

  constructor(apiKey: string, cacheConfig?: CacheConfig, baseUrl?: string) {
    if (typeof apiKey !== 'string') {
      throw new Error('An API key is required.');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl || BASE_URL;
    this.cache = new LRUCache<string, LookupResponse>({ max: CACHE_MAX, ttl: CACHE_TTL, ...cacheConfig });
  }

  private buildUrl(...pathSegments: string[]): URL {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const path = pathSegments.filter(Boolean).join('/');
    const url = path ? new URL(path, base) : new URL(base);
    url.searchParams.set('api-key', this.apiKey);
    return url;
  }

  async lookup(ip?: string, selectField?: string, fields?: string[]): Promise<LookupResponse> {
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

    const response = await fetch(url.toString());

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

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
