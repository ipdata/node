import isString from 'lodash/isString';
import request from 'request-promise';
import urljoin from 'url-join';
import LRU from 'lru-cache';

const cache = new LRU<string, IPDataLookupResponse>({
  max: 4096, // max number of items
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
});

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IPDataLookupResponse {
  ip: string;
  city: string;
  region: string;
  country_name: string;
  country_code: string;
  continent_name: string;
  continent_code: string;
  latitude: number;
  longitude: number;
  asn: string;
  organisation: string;
  postal: string;
  currency: string;
  currency_symbol: string;
  calling_code: string;
  flag: string;
  time_zone: string;
}

export async function lookup(ip?: string, apiKey?: string, language?: string): Promise<IPDataLookupResponse> {
  let lookupIp = isString(ip) ? ip : '';

  if (!cache.has(lookupIp)) {
    const headers = {};
    let uri = urljoin('https://api.ipdata.co/', lookupIp);

    if (language) {
      uri = urljoin(uri, language);
    }

    if (apiKey) {
      uri = urljoin(uri, `?api-key=${apiKey}`);
    }

    const response = request({
      uri,
      headers,
      json: true,
    });
    cache.set(lookupIp, response);
  }

  return cache.get(lookupIp);
}
