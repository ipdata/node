import * as request from 'request-promise';
import * as urljoin from 'url-join';

export interface IPDataLookupResponse {
  ip: string,
  city: string,
  region: string,
  country_name: string,
  country_code: string,
  continent_name: string,
  continent_code: string,
  latitude: number,
  longitude: number,
  asn: string,
  organisation: string,
  postal: string,
  currency: string,
  currency_symbol: string,
  calling_code: string,
  flag: string,
  time_zone: string
}

export async function lookup(ip?: string, apiKey?: string, language?: string): Promise<IPDataLookupResponse> {
  // Regex found on https://www.regular-expressions.info/ip.html
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  if (ip != null && !ipRegex.test(ip)) {
    return Promise.reject(new Error('Please provide a valid ip.'));
  }

  let uri = 'https://api.ipdata.co/';
  let headers = {};

  if (ip) {
    uri = urljoin(uri, ip);
  }

  if (language) {
    uri = urljoin(uri, language);
  }

  if (apiKey) {
    headers['api-key'] = String(apiKey);
  }

  return await request({
    uri: uri,
    headers: headers,
    json: true
  });
}
