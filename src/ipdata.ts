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

export function lookup(ip?: string, apiKey?: string, language?: string): Promise<IPDataLookupResponse> {
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

  return request({
    uri: uri,
    headers: headers,
    json: true
  });
}
