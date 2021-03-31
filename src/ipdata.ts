import got from 'got';
import LRU from 'lru-cache';
import { URL } from 'url';
import { BASE_URL, CACHE_MAX, CACHE_MAX_AGE, DEFAULT_IP } from './constants';
import { BulkLookupError, IncompatibleFieldCombinationError, InvalidIpError } from './errors';
import { BulkLookupParams, CacheConfig, IPDataProvider, LookupParams, LookupResponse } from './types';
import {
  debug,
  getApiUrl,
  handleLookupError,
  isValidFields,
  isValidIP,
  isValidSelectField,
  parseApiKey,
  resolveBulkLookupParams,
  resolveLookupParams,
} from './utils';

/**
 * IPData Node API
 *
 * @class
 * @classdesc Retrieves intelligence of a specified ip address from the IPData api.
 * @requires {got}
 * @see https://github.com/sindresorhus/got
 */
export class IPData implements IPDataProvider {
  /**
   * Client provided API key for authentication.
   * @type {string}
   */
  public apiKey: string;

  /**
   * Active LRU cache to reduce queries.
   *
   * @type {LRU<string, LookupResponse>}
   */
  public cache: LRU<string, LookupResponse>;

  /**
   * Constructor
   * Accepts api key and optional cache config.
   *
   * @param {string} apiKey
   * @param {CacheConfig} cacheConfig
   */
  public constructor(apiKey?: string, cacheConfig?: CacheConfig) {
    // Allows auto-resolution of api key from dotenv if none provided in constructor.
    this.apiKey = parseApiKey(apiKey);
    // Establish a new cache instance to reduce repeat lookups if already known.
    this.cache = new LRU<string, LookupResponse>({ max: CACHE_MAX, maxAge: CACHE_MAX_AGE, ...cacheConfig });
  }

  /**
   * Performs remote lookup on the IPData api.
   *
   * @param {string | LookupParams | undefined} ipOrParams
   * @return {Promise<LookupResponse>}
   */
  public async lookup(ipOrParams: string | LookupParams = {}): Promise<LookupResponse> {
    // Allow users to specify a single string IP as shorthand, or a set of optional named params.
    const { ip, selectField, fields } = resolveLookupParams(ipOrParams);
    debug(`Lookup params received: `, { ip, selectField, fields });
    const url = getApiUrl(this.apiKey, ip);

    // Abort if user has provided an invalid or empty IP.
    if (ip && !isValidIP(ip)) {
      throw new InvalidIpError(ip);
    }

    // Check the LRU cache to minimize superfluous requests.
    if (this.cache.has(ip || DEFAULT_IP)) {
      debug(`Found ip ${ip} in cache.`);
      return this.cache.get(ip || DEFAULT_IP);
    }

    // The api will not accept both a select field and a field array.
    if (selectField && fields) {
      throw new IncompatibleFieldCombinationError();
    }

    if (selectField && isValidSelectField(selectField)) {
      debug(`Appending ${selectField} to url path.`);
      url.pathname = `${url.pathname}/${selectField}`;
    }

    // Ensure requested fields are valid before adding to query string.
    if (fields && isValidFields(fields)) {
      debug(`Appending fields to request: `, fields);
      url.searchParams.append('fields', fields.join(','));
    }

    try {
      // Send the finalised request to the API via the Got library.
      debug(`Dispatching request ${url.pathname}.`);
      const { body, statusCode, statusMessage } = await got.get<LookupResponse>(url.toString(), {
        responseType: 'json',
      });

      const data: LookupResponse = { ...body, status: statusCode, statusMessage };

      this.cache.set(ip || DEFAULT_IP, data);
      return this.cache.get(ip || DEFAULT_IP);
    } catch (e) {
      return handleLookupError(e);
    }
  }

  /**
   * Performs a bulk lookup request against the IPData api.
   *
   * @param {string[] | BulkLookupParams} ipOrParams
   * @return {Promise<LookupResponse[]>}
   */
  public async bulkLookup(ipOrParams: string[] | BulkLookupParams): Promise<LookupResponse[]> {
    // Destructure params and allow a short-hand IP string as well as named params.
    const { ips, fields } = resolveBulkLookupParams(ipOrParams);
    const responses: LookupResponse[] = [];
    const bulk = [];

    // Start a URL instance based on the the "/bulk" api stub.
    const url: URL = new URL('bulk', BASE_URL);
    url.searchParams.append('api-key', this.apiKey);

    // Bulk lookups must request at least 2 IPs.
    if (ips.length < 2) {
      throw new BulkLookupError();
    }

    ips.forEach(ip => {
      // Abort if user has provided an invalid IP.
      if (!isValidIP(ip)) {
        throw new InvalidIpError(ip);
      }

      // Check the LRU cache to minimize superfluous requests.
      if (this.cache.has(ip)) {
        debug(`Found ip ${ip} in cache.`);
        responses.push(this.cache.get(ip));
      } else {
        debug(`Did not find ip ${ip} in cache, adding to request.`);
        bulk.push(ip);
      }
    });

    // Add any specified valid fields to the query string.
    if (fields && isValidFields(fields)) {
      debug(`Appending fields to request: `, fields);
      url.searchParams.append('fields', fields.join(','));
    }

    try {
      if (bulk.length > 0) {
        debug(`Dispatching request ${url.pathname}.`);
        const { body, statusCode, statusMessage } = await got.post<LookupResponse[]>(url.toString(), {
          json: bulk,
          responseType: 'json',
        });
        body.forEach(info => {
          this.cache.set(info.ip, { ...info, status: statusCode, statusMessage });
          responses.push(this.cache.get(info.ip));
        });
      }
      return responses;
    } catch (e) {
      return [handleLookupError(e)];
    }
  }
}
