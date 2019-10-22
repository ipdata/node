import isString from 'lodash/isString';
import isIP from 'is-ip';
import axios, { AxiosError } from 'axios';
import urljoin from 'url-join';
import LRU from 'lru-cache';

const CACHE_MAX = 4096; // max number of items
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours
const DEFAULT_IP = '';

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
}

export interface LookupOptions {
  useCache?: boolean;
}

export default class IPData {
  apiKey?: string;
  language?: string;
  private cache = new LRU<string, LookupResponse>({ max: CACHE_MAX, maxAge: CACHE_MAX_AGE });

  constructor(apiKey: string, language?: string) {
    this.apiKey = apiKey;
    this.language = language;
  }

  async lookup(ip: string = DEFAULT_IP, options: LookupOptions = {}): Promise<LookupResponse> {
    const { useCache = true } = options;

    if (ip !== DEFAULT_IP && !isIP(ip)) {
      throw new Error('Invalid IP address.');
    }

    if (!this.cache.has(ip)) {
      let url = urljoin('https://api.ipdata.co/', ip);

      if (isString(this.language)) {
        url = urljoin(url, this.language);
      }

      if (isString(this.apiKey)) {
        url = urljoin(url, `?api-key=${this.apiKey}`);
      }

      try {
        const response = await axios.get(url);
        if (!useCache) {
          return response.data;
        }
        this.cache.set(ip, response.data);
      } catch (e) {
        const { response } = e as AxiosError;
        const { message = 'An error occurred.' } = response.data;
        throw new Error(message);
      }
    }

    return this.cache.get(ip);
  }
}
