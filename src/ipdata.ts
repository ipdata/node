import * as request from 'request-promise';

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

export async function lookup(ip?: string, apiKey?: string): Promise<IPDataLookupResponse> {
  // Regex found on https://www.regular-expressions.info/ip.html
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  if (ip != null && !ipRegex.test(ip)) {
    return Promise.reject(new Error('Please provide a valid ip.'));
  }

  return await request({
    uri: `https://api.ipdata.co/${ip ? ip : ''}`,
    json: true
  });
}
