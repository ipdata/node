import keyBy from 'lodash/keyBy';
import IPData from './ipdata';

const TEST_IP = '1.1.1.1';
const DEFAULT_IP_KEY = 'DEFAULT_IP';

describe('constructor()', () => {
  it('should throw an error if an apiKey is not provided', () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    expect(() => new IPData()).toThrow('An API key is required.');
  });

  it('should set the apiKey', () => {
    const ipdata = new IPData(process.env.IPDATA_API_KEY);
    expect(ipdata.apiKey).toEqual(process.env.IPDATA_API_KEY);
  });

  it('should configure the cache by default', () => {
    const ipdata = new IPData(process.env.IPDATA_API_KEY);
    expect(ipdata.cache.max).toEqual(4096);
    expect(ipdata.cache.maxAge).toEqual(1000 * 60 * 60 * 24);
  });

  it('should configure the cache', () => {
    const max = 1;
    const maxAge = 1000;
    const ipdata = new IPData(process.env.IPDATA_API_KEY, { max, maxAge });
    expect(ipdata.cache.max).toEqual(max);
    expect(ipdata.cache.maxAge).toEqual(maxAge);
  });
});

describe('lookup()', () => {
  const ipdata = new IPData(process.env.IPDATA_API_KEY);

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
      const customIPData = new IPData(process.env.IPDATA_API_KEY, { maxAge: -1 });
      await customIPData.lookup();
      const info = ipdata.cache.get(DEFAULT_IP_KEY);
      expect(info).toBeUndefined();
    });
  });

  describe('custom IP address', () => {
    it('should throw an error if the ip address is invalid', async () => {
      const badIP = '1.1.11';
      await expect(ipdata.lookup(badIP)).rejects.toThrow(`${badIP} is an invalid IP address.`);
    });

    it('should return information', async () => {
      const info = await ipdata.lookup(TEST_IP);
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('status');
    });

    it('should cache the information', async () => {
      await ipdata.lookup(TEST_IP);
      const info = ipdata.cache.get(TEST_IP);
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('status');
    });

    it('should not cache the information', async () => {
      const customIPData = new IPData(process.env.IPDATA_API_KEY, { maxAge: -1 });
      await customIPData.lookup(TEST_IP);
      const info = ipdata.cache.get(TEST_IP);
      expect(info).toBeUndefined();
    });
  });

  it('should throw an error if a selectField and fields is provided', async () => {
    await expect(ipdata.lookup(null, 'field', ['field'])).rejects.toThrow(
      'The selectField and fields parameters cannot be used at the same time.',
    );
  });

  describe('selectField', () => {
    it('should throw an error for an invlaid field ', async () => {
      const field = 'field';
      await expect(ipdata.lookup(null, field)).rejects.toThrow(`${field} is not a valid field.`);
    });

    it('should return a response with only the field', async () => {
      const field = 'is_eu';
      const info = await ipdata.lookup(null, field);
      expect(info).toHaveProperty(field, false);
      expect(info).toHaveProperty('status');
    });
  });

  describe('fields', () => {
    it('should throw an error for an invlaid field ', async () => {
      const field = 'field';
      const fields = [field];
      await expect(ipdata.lookup(null, null, fields)).rejects.toThrow(`${field} is not a valid field.`);
    });

    it('should return a response with only the field', async () => {
      const field1 = 'ip';
      const field2 = 'is_eu';
      const fields = [field1, field2];
      const info = await ipdata.lookup(TEST_IP, null, fields);
      expect(info).toHaveProperty(field1, TEST_IP);
      expect(info).toHaveProperty(field2, false);
      expect(info).toHaveProperty('status');
    });
  });
});

describe('bulkLookup()', () => {
  const ipdata = new IPData(process.env.IPDATA_API_KEY);
  const IP1 = TEST_IP;
  const IP2 = '8.8.8.8';

  afterEach(() => {
    return ipdata.cache.reset();
  });

  it('should throw an error if less than 2 ip addresses are provided', async () => {
    const ips = [IP1];
    await expect(ipdata.bulkLookup(ips)).rejects.toThrow('Bulk Lookup requires more than 1 IP Address in the payload.');
  });

  it('should throw an error if an ip address is invalid', async () => {
    const badIP = '1.1.11';
    const ips = [badIP, IP2];
    await expect(ipdata.bulkLookup(ips)).rejects.toThrow(`${badIP} is an invalid IP address.`);
  });

  it('should return info for the ip addresses', async () => {
    const result = await ipdata.bulkLookup([IP1, IP2]);
    const info = keyBy(result, ipInfo => ipInfo.ip);
    expect(info[IP1]).toHaveProperty('ip', IP1);
    expect(info[IP1]).toHaveProperty('status');
    expect(info[IP2]).toHaveProperty('ip', IP2);
    expect(info[IP2]).toHaveProperty('status');
  });

  it('should cache the info', async () => {
    await ipdata.bulkLookup([IP1, IP2]);
    const ip1Info = ipdata.cache.get(IP1);
    const ip2Info = ipdata.cache.get(IP2);
    expect(ip1Info).toHaveProperty('ip', IP1);
    expect(ip1Info).toHaveProperty('status');
    expect(ip2Info).toHaveProperty('ip', IP2);
    expect(ip2Info).toHaveProperty('status');
  });

  it('should use existing cached ips and merge ones that do not exist', async () => {
    const IP3 = '1.0.0.1';
    await ipdata.lookup(IP1);
    expect(ipdata.cache.get(IP1)).not.toBeUndefined();
    const result = await ipdata.bulkLookup([IP1, IP2, IP3]);
    const info = keyBy(result, ipInfo => ipInfo.ip);
    expect(info[IP1]).toHaveProperty('ip', IP1);
    expect(info[IP1]).toHaveProperty('status');
    expect(info[IP2]).toHaveProperty('ip', IP2);
    expect(info[IP2]).toHaveProperty('status');
    expect(info[IP3]).toHaveProperty('ip', IP3);
    expect(info[IP3]).toHaveProperty('status');
  });

  describe('fields', () => {
    it('should throw an error for an invlaid field ', async () => {
      const field = 'field';
      const fields = [field];
      await expect(ipdata.bulkLookup([IP1, IP2], fields)).rejects.toThrow(`${field} is not a valid field.`);
    });

    it('should return a response with only the field', async () => {
      const field1 = 'ip';
      const field2 = 'is_eu';
      const fields = [field1, field2];
      const result = await ipdata.bulkLookup([IP1, IP2], fields);
      const info = keyBy(result, ipInfo => ipInfo.ip);
      expect(info[IP1]).toHaveProperty(field1, IP1);
      expect(info[IP1]).toHaveProperty(field2, false);
      expect(info[IP1]).toHaveProperty('status');
      expect(info[IP2]).toHaveProperty(field1, IP2);
      expect(info[IP2]).toHaveProperty(field2, false);
      expect(info[IP2]).toHaveProperty('status');
    });
  });
});
