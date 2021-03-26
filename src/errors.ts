/* eslint-disable max-classes-per-file */

import { BulkLookupParams, LookupParams } from './types';

export class IncompatibleFieldCombinationError extends Error {
  constructor() {
    super(`The "selectField" and "fields" parameters cannot be used at the same time.`);
  }
}

export class ApiTransportError extends Error {
  constructor(err?: Error) {
    super(`An error occurred while accessing api: ${err?.message}`);
  }
}

export class BulkLookupError extends Error {
  constructor() {
    super(`Bulk Lookup requires more than 1 IP address in the payload.`);
  }
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(`An API key is required.`);
  }
}

export class InvalidIpError extends Error {
  constructor(public readonly ip?: string) {
    super(`${ip} is an invalid IP address.`);
  }
}

export class InvalidParamsError extends Error {
  constructor(params: string | string[] | BulkLookupParams | LookupParams) {
    super(`Received invalid method params: ${JSON.stringify(params)}`);
  }
}

export class InvalidFieldError extends Error {
  constructor(public readonly field: string) {
    super(`${field} is not a valid field.`);
  }
}

export class InvalidFieldFormatError extends Error {
  constructor(public readonly format: string) {
    super(`Fields should be an ${format}.`);
  }
}
