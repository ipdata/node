/* eslint-disable @typescript-eslint/ban-ts-ignore */

import { config } from 'dotenv';
import { env } from './constants';
import {
  BulkLookupError,
  IncompatibleFieldCombinationError,
  InvalidFieldError,
  InvalidIpError,
  MissingApiKeyError,
} from './errors';
import { IPData } from './ipdata';

const TEST_IP = '1.1.1.1';
const DEFAULT_IP_KEY = 'DEFAULT_IP';
const backupKey = `${env.IPDATA_API_KEY}`;
config();

describe('constructor()', () => {
  it('should throw an error if an apiKey is not provided', async () => {
    env.IPDATA_API_KEY = undefined;
    // @ts-ignore
    expect(() => new IPData()).toThrow(new MissingApiKeyError().message);
    env.IPDATA_API_KEY = backupKey;
    // Env needs time to reset.
    await new Promise(resolve => {
      setTimeout(resolve, 200);
    });
  });

  it('should set the apiKey', () => {
    const ipdata = new IPData(env.IPDATA_API_KEY);
    expect(`${ipdata.apiKey}`).toEqual(`${env.IPDATA_API_KEY}`);
  });

  it('should configure the cache by default', () => {
    const ipdata = new IPData(env.IPDATA_API_KEY);
    expect(ipdata.cache.max).toEqual(4096);
    expect(ipdata.cache.maxAge).toEqual(1000 * 60 * 60 * 24);
  });

  it('should configure the cache', () => {
    const max = 1;
    const maxAge = 1000;
    const ipdata = new IPData(env.IPDATA_API_KEY, { max, maxAge });
    expect(ipdata.cache.max).toEqual(max);
    expect(ipdata.cache.maxAge).toEqual(maxAge);
  });
});

describe('lookup()', () => {
  const ipdata = new IPData(env.IPDATA_API_KEY);

  afterEach(() => {
    return ipdata.cache.reset();
  });

  describe('default IP address', () => {
    it('should return information', async () => {
      const info = await ipdata.lookup();
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should return information when null is provided', async () => {
      const info = await ipdata.lookup(null);
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should return information when undefined is provided', async () => {
      const info = await ipdata.lookup(undefined);
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should cache the information', async () => {
      await ipdata.lookup();
      const info = ipdata.cache.get(DEFAULT_IP_KEY);
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should not cache the information', async () => {
      const customIPData = new IPData(env.IPDATA_API_KEY, { maxAge: -1 });
      await customIPData.lookup();
      const info = ipdata.cache.get(DEFAULT_IP_KEY);
      expect(info).toBeUndefined();
    });
  });

  describe('custom IP address', () => {
    it('should throw an error if the ip address is invalid', async () => {
      const badIP = '1.1.11';
      await expect(ipdata.lookup({ ip: badIP })).rejects.toThrow(new InvalidIpError(badIP).message);
    });

    it('should return information', async () => {
      const info = await ipdata.lookup({ ip: TEST_IP });
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('status');
    });

    it('should cache the information', async () => {
      await ipdata.lookup({ ip: TEST_IP });
      const info = ipdata.cache.get(TEST_IP);
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('status');
    });

    it('should not cache the information', async () => {
      const customIPData = new IPData(env.IPDATA_API_KEY, { maxAge: -1 });
      await customIPData.lookup({ ip: TEST_IP });
      const info = ipdata.cache.get(TEST_IP);
      expect(info).toBeUndefined();
    });
  });

  it('should throw an error if a selectField and fields is provided', async () => {
    await expect(ipdata.lookup({ selectField: 'field', fields: ['field'] })).rejects.toThrow(
      new IncompatibleFieldCombinationError().message,
    );
  });

  describe('selectField', () => {
    it('should throw an error for an invalid field ', async () => {
      const selectField = 'field';
      // @ts-ignore
      await expect(ipdata.lookup({ selectField })).rejects.toThrow(new InvalidFieldError(selectField).message);
    });

    it('should return a response with only the field', async () => {
      const selectField = 'is_eu';
      // @ts-ignore
      const info = await ipdata.lookup({ selectField });
      expect(info).toHaveProperty(selectField, false);
      expect(info).toHaveProperty('status');
    });
  });

  describe('fields', () => {
    it('should throw an error for an invalid field ', async () => {
      const selectField = 'field';
      const fields = [selectField];
      await expect(ipdata.lookup({ fields })).rejects.toThrow(new InvalidFieldError(selectField).message);
    });

    it('should return a response with only the field', async () => {
      const field1 = 'ip';
      const field2 = 'is_eu';
      const fields = [field1, field2];
      const info = await ipdata.lookup({ ip: TEST_IP, fields });
      expect(info).toHaveProperty(field1, TEST_IP);
      expect(info).toHaveProperty(field2, false);
      expect(info).toHaveProperty('status');
    });
  });
});

describe('bulkLookup()', () => {
  const ipdata = new IPData(env.IPDATA_API_KEY);
  const IP1 = TEST_IP;
  const IP2 = '8.8.8.8';

  afterEach(() => {
    return ipdata.cache.reset();
  });

  it('should throw an error if less than 2 ip addresses are provided', async () => {
    const ips = [IP1];
    await expect(ipdata.bulkLookup({ ips })).rejects.toThrow(new BulkLookupError().message);
  });

  it('should throw an error if an ip address is invalid', async () => {
    const badIP = '1.1.11';
    const ips = [badIP, IP2];
    await expect(ipdata.bulkLookup({ ips })).rejects.toThrow(new InvalidIpError(badIP).message);
  });

  it('should return info for the ip addresses', async () => {
    const ips = [IP1, IP2];
    const result = await ipdata.bulkLookup({ ips });
    for (let i = 0; i < ips.length; i += 1) {
      const info = result[i];
      expect(info).toHaveProperty('ip', ips[i]);
      expect(info).toHaveProperty('status');
    }
  });

  it('should cache the info', async () => {
    const ips = [IP1, IP2];
    await ipdata.bulkLookup({ ips });
    for (let i = 0; i < ips.length; i += 1) {
      const info = ipdata.cache.get(ips[i]);
      expect(info).toHaveProperty('ip', ips[i]);
      expect(info).toHaveProperty('status');
    }
  });

  it('should use existing cached ips and merge ones that do not exist', async () => {
    const IP3 = '1.0.0.1';
    await ipdata.lookup({ ip: IP1 });
    expect(ipdata.cache.get(IP1)).not.toBeUndefined();
    const ips = [IP1, IP2, IP3];
    const result = await ipdata.bulkLookup({ ips });
    for (let i = 0; i < ips.length; i += 1) {
      const info = result[i];
      expect(info).toHaveProperty('ip', ips[i]);
      expect(info).toHaveProperty('status');
    }
  });

  describe('fields', () => {
    it('should throw an error for an invalid field ', async () => {
      const field = 'field';
      const fields = [field];
      await expect(ipdata.bulkLookup({ ips: [IP1, IP2], fields })).rejects.toThrow(
        new InvalidFieldError(field).message,
      );
    });

    it('should return a response with only the field', async () => {
      const field1 = 'ip';
      const field2 = 'is_eu';
      const fields = [field1, field2];
      const ips = [IP1, IP2];
      const result = await ipdata.bulkLookup({ ips, fields });
      for (let i = 0; i < ips.length; i += 1) {
        const info = result[i];
        expect(info).toHaveProperty(field1, ips[i]);
        expect(info).toHaveProperty(field2, false);
        expect(info).toHaveProperty('status');
      }
    });
  });
});
