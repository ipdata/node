export interface IPDataParams {
  'api-key': string;
  fields?: string;
}

export interface LookupParams {
  ip?: string;
  selectField?: string;
  fields?: string[];
}

export interface BulkLookupParams {
  ips: string[];
  fields?: string[];
}

export interface IPDataProvider {
  lookup(params?: string | LookupParams): Promise<LookupResponse>;

  bulkLookup(params: string[] | BulkLookupParams): Promise<LookupResponse[]>;
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

  status?: number;
  statusMessage?: string;
}

export type LookupError = Error & { response?: { data: LookupResponse; statusCode: number; statusMessage?: string } };

export interface Env extends Record<string, string> {
  IPDATA_API_KEY?: string;
}
