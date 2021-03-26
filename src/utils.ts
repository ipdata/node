import debugFactory, { Debugger } from 'debug';
import isIP from 'is-ip';
import { URL } from 'url';
import { BASE_URL, DEFAULT_IP, env, VALID_FIELDS } from './constants';
import {
  ApiTransportError,
  InvalidFieldError,
  InvalidFieldFormatError,
  InvalidParamsError,
  MissingApiKeyError,
} from './errors';
import { BulkLookupParams, LookupError, LookupParams, LookupResponse } from './types';

/**
 * Instantiates a new debug instance.
 */
export const debug: Debugger = debugFactory('ipdata');

/**
 * Parses lookup method signature to allow shorthand ip string call.
 *
 * @param {string | LookupParams} ipOrParams
 * @return {LookupParams}
 */
export function resolveLookupParams(ipOrParams: string | LookupParams | undefined): LookupParams {
  if (typeof ipOrParams === 'string') {
    return { ip: ipOrParams };
  }
  return ipOrParams || {};
}

/**
 * Parses bulk lookup method signature to allow shorthand ip string call.
 * @param {string | BulkLookupParams} ipOrParams
 * @return {BulkLookupParams}
 */
export function resolveBulkLookupParams(ipOrParams: string[] | BulkLookupParams): BulkLookupParams {
  if (Array.isArray(ipOrParams) && typeof ipOrParams[0] === 'string') {
    return { ips: ipOrParams };
  }
  if (ipOrParams && typeof ipOrParams === 'object' && Object.keys(ipOrParams).includes('ips')) {
    return ipOrParams as BulkLookupParams;
  }
  throw new InvalidParamsError(ipOrParams);
}

/**
 * Parses or rejects the api key provided.
 *
 * @param {string} apiKey
 */
export function parseApiKey(apiKey?: string): string {
  if (typeof apiKey === 'string' && apiKey.length) {
    debug(`Using api key with length: ${apiKey.length}`);
    return apiKey;
  }
  if (!apiKey && env.APIDATA_API_KEY) {
    debug(`Using api key from environment variables.`);
    return `${env.APIDATA_API_KEY}`;
  }
  throw new MissingApiKeyError();
}

/**
 * Handles lookup transport errors.
 *
 * @param {LookupError} error
 * @return {LookupResponse}
 */
export function handleLookupError(error?: LookupError): LookupResponse {
  if (error && error.response) {
    const { response } = error;
    if (response) {
      return { ...response.data, status: response.statusCode, statusMessage: response.statusMessage };
    }
  }
  throw new ApiTransportError(error);
}

/**
 * Verifies if input is a valid ip.
 *
 * @param {string} ip
 * @return {boolean}
 */
export function isValidIP(ip: string): boolean {
  return ip === DEFAULT_IP || isIP(ip);
}

/**
 * Verifies if a specified select field is valid.
 *
 * @param {string} field
 * @return {boolean}
 */
export function isValidSelectField(field: string): boolean {
  const index = VALID_FIELDS.indexOf(field);

  if (index === -1) {
    throw new Error(`${field} is not a valid field.`);
  }

  return true;
}

/**
 * Verifies if a specified set of fields are valid.
 *
 * @param {string[]} fields
 * @return {boolean}
 */
export function isValidFields(fields: string[]): boolean {
  if (!Array.isArray(fields)) {
    throw new InvalidFieldFormatError('array');
  }

  fields.forEach(field => {
    const index = VALID_FIELDS.indexOf(field);
    if (index === -1) {
      throw new InvalidFieldError(field);
    }
  });

  return true;
}

/**
 * Generates a new URL object directed at the API.
 *
 * @param {string} apiKey
 * @param {string} stub
 * @return {URL}
 */
export function getApiUrl(apiKey: string, stub?: string): URL {
  const url: URL = stub ? new URL(stub, BASE_URL) : new URL(BASE_URL);
  url.searchParams.append('api-key', apiKey);
  return url;
}
