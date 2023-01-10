import isString from 'lodash/isString';
import isArray from 'lodash/isArray';
import isIP from 'is-ip';
import axios, { AxiosError } from 'axios';
import urljoin from 'url-join';
import LRU from 'lru-cache';

const CACHE_MAX = 4096; // max number of items
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours
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

function isValidIP(ip: string): boolean {
  return ip === DEFAULT_IP || isIP(ip);
}

function isValidSelectField(field: string): boolean {
  const index = VALID_FIELDS.indexOf(field);

  if (index === -1) {
    throw new Error(`${field} is not a valid field.`);
  }

  return true;
}

function isValidFields(fields: string[]): boolean {
  if (!isArray(fields)) {
    throw new Error('Fields should be an array.');
  }

  fields.forEach(field => {
    const index = VALID_FIELDS.indexOf(field);
    if (index === -1) {
      throw new Error(`${field} is not a valid field.`);
    }
  });

  return true;
}

export interface CacheConfig {
  max?: number;
  maxAge?: number;
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
  asn: {
    asn: string;
    name: string;
    domain: string;
    route: string;
    type: string;
  };
  languages: { name: string; native: string }[];
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
  };
  count: number;
  status: number;
}

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
interface IPDataParams {
  'api-key': string;
  fields?: string;
}

export default class IPData {
  apiKey: string;
  cache: LRU<string, LookupResponse>;

  constructor(apiKey: string, cacheConfig?: CacheConfig) {
    if (!isString(apiKey)) {
      throw new Error('An API key is required.');
    }

    this.apiKey = apiKey;
    this.cache = new LRU<string, LookupResponse>({ max: CACHE_MAX, maxAge: CACHE_MAX_AGE, ...cacheConfig });
  }

  async lookup(ip?: string, selectField?: string, fields?: string[]): Promise<LookupResponse> {
    const params: IPDataParams = { 'api-key': this.apiKey };
    let url = ip ? urljoin(BASE_URL, ip) : BASE_URL;

    if (ip && !isValidIP(ip)) {
      throw new Error(`${ip} is an invalid IP address.`);
    }

    if (this.cache.has(ip || DEFAULT_IP)) {
      return this.cache.get(ip || DEFAULT_IP);
    }

    if (selectField && fields) {
      throw new Error('The selectField and fields parameters cannot be used at the same time.');
    }

    if (selectField && isValidSelectField(selectField)) {
      url = urljoin(url, selectField);
    }

    if (fields && isValidFields(fields)) {
      params.fields = fields.join(',');
    }

    try {
      const response = await axios.get(url, { params });
      let data: LookupResponse = { ...response.data, status: response.status };

      if (selectField) {
        data = { [selectField]: response.data, status: response.status } as LookupResponse;
      }

      this.cache.set(ip || DEFAULT_IP, data);
      return this.cache.get(ip || DEFAULT_IP);
    } catch (e) {
      const { response } = e as AxiosError;
      if (response) {
        return { ...response.data as {}, status: response.status } as LookupResponse;
      }
      throw e;
    }
  }

  async bulkLookup(ips: string[], fields?: string[]): Promise<LookupResponse[]> {
    const params: IPDataParams = { 'api-key': this.apiKey };
    const responses: LookupResponse[] = [];
    const bulk = [];

    if (ips.length < 2) {
      throw new Error('Bulk Lookup requires more than 1 IP Address in the payload.');
    }

    ips.forEach(ip => {
      if (!isValidIP(ip)) {
        throw new Error(`${ip} is an invalid IP address.`);
      }

      if (this.cache.has(ip)) {
        responses.push(this.cache.get(ip));
      } else {
        bulk.push(ip);
      }
    });

    if (fields && isValidFields(fields)) {
      params.fields = fields.join(',');
    }

    try {
      if (bulk.length > 0) {
        const response = await axios.post(urljoin(BASE_URL, 'bulk'), bulk, { params });
        response.data.forEach(info => {
          this.cache.set(info.ip, { ...info, status: response.status });
          responses.push(this.cache.get(info.ip));
        });
      }
      return responses;
    } catch (e) {
      const { response } = e as AxiosError;
      if (response) {
        return [{ ...response.data as {}, status: response.status }] as LookupResponse[];
      }
      throw e;
    }
  }
}
