import IPData, { EU_BASE_URL, LookupResponse } from './ipdata';

const TEST_API_KEY = 'test-api-key';
const TEST_IP = '1.1.1.1';
const DEFAULT_IP_KEY = 'DEFAULT_IP';

const MOCK_IP1_DATA = {
  ip: '1.1.1.1',
  is_eu: false,
  city: 'Los Angeles',
  region: 'California',
  region_code: 'CA',
  country_name: 'United States',
  country_code: 'US',
  continent_name: 'North America',
  continent_code: 'NA',
  latitude: 34.0522,
  longitude: -118.2437,
  postal: '90001',
  calling_code: '1',
  flag: 'https://ipdata.co/flags/us.png',
  emoji_flag: '\u{1F1FA}\u{1F1F8}',
  emoji_unicode: 'U+1F1FA U+1F1F8',
  carrier: { name: 'Cloudflare', mcc: '', mnc: '' },
  asn: { asn: 'AS13335', name: 'Cloudflare, Inc.', domain: 'cloudflare.com', route: '1.1.1.0/24', type: 'hosting' },
  company: { name: 'Cloudflare, Inc.', domain: 'cloudflare.com', network: '1.1.1.0/24', type: 'hosting' },
  languages: [{ name: 'English', native: 'English', code: 'en' }],
  currency: { name: 'US Dollar', code: 'USD', symbol: '$', native: '$', plural: 'US dollars' },
  time_zone: {
    name: 'America/Los_Angeles',
    abbr: 'PST',
    offset: '-0800',
    is_dst: false,
    current_time: '2024-01-01T00:00:00-08:00',
  },
  threat: {
    is_tor: false,
    is_proxy: false,
    is_anonymous: false,
    is_known_attacker: false,
    is_known_abuser: false,
    is_threat: false,
    is_bogon: false,
    is_icloud_relay: false,
    is_datacenter: true,
    blocklists: [],
  },
  count: 0,
};

const MOCK_IP2_DATA = {
  ...MOCK_IP1_DATA,
  ip: '8.8.8.8',
  is_eu: true,
  city: 'Mountain View',
};

const MOCK_IP3_DATA = {
  ...MOCK_IP1_DATA,
  ip: '1.0.0.1',
  city: 'South Brisbane',
};

const MOCK_DEFAULT_IP_DATA = {
  ...MOCK_IP1_DATA,
  ip: '203.0.113.1',
};

function mockFetchResponse(data: any, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

const mockFetch = jest.fn() as jest.Mock;
global.fetch = mockFetch;

describe('constructor()', () => {
  it('should throw an error if an apiKey is not provided', () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(() => new IPData()).toThrow('An API key is required.');
  });

  it('should set the apiKey', () => {
    const ipdata = new IPData(TEST_API_KEY);
    expect(ipdata.apiKey).toEqual(TEST_API_KEY);
  });

  it('should configure the cache by default', () => {
    const ipdata = new IPData(TEST_API_KEY);
    expect(ipdata.cache.max).toBe(4096);
    expect(ipdata.cache.ttl).toEqual(1000 * 60 * 60 * 24);
  });

  it('should configure the cache', () => {
    const max = 1;
    const ttl = 1000;
    const ipdata = new IPData(TEST_API_KEY, { max, ttl });
    expect(ipdata.cache.max).toEqual(max);
    expect(ipdata.cache.ttl).toEqual(ttl);
  });

  it('should use the default base URL', () => {
    const ipdata = new IPData(TEST_API_KEY);
    expect(ipdata.baseUrl).toBe('https://api.ipdata.co/');
  });

  it('should accept a custom base URL', () => {
    const ipdata = new IPData(TEST_API_KEY, undefined, EU_BASE_URL);
    expect(ipdata.baseUrl).toBe('https://eu-api.ipdata.co/');
  });
});

describe('lookup()', () => {
  const ipdata = new IPData(TEST_API_KEY);

  afterEach(() => {
    ipdata.cache.clear();
    mockFetch.mockReset();
  });

  describe('default IP address', () => {
    it('should return information', async () => {
      mockFetch.mockReturnValueOnce(mockFetchResponse(MOCK_DEFAULT_IP_DATA));
      const info = await ipdata.lookup();
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should return information when null is provided', async () => {
      mockFetch.mockReturnValueOnce(mockFetchResponse(MOCK_DEFAULT_IP_DATA));
      const info = await ipdata.lookup(undefined);
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should return information when undefined is provided', async () => {
      mockFetch.mockReturnValueOnce(mockFetchResponse(MOCK_DEFAULT_IP_DATA));
      const info = await ipdata.lookup(undefined);
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should cache the information', async () => {
      mockFetch.mockReturnValueOnce(mockFetchResponse(MOCK_DEFAULT_IP_DATA));
      await ipdata.lookup();
      const info = ipdata.cache.get(DEFAULT_IP_KEY);
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should not cache the information', async () => {
      const customIPData = new IPData(TEST_API_KEY, { ttl: 1 });
      mockFetch.mockReturnValueOnce(mockFetchResponse(MOCK_DEFAULT_IP_DATA));
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
      mockFetch.mockReturnValueOnce(mockFetchResponse(MOCK_IP1_DATA));
      const info = await ipdata.lookup(TEST_IP);
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('status');
    });

    it('should cache the information', async () => {
      mockFetch.mockReturnValueOnce(mockFetchResponse(MOCK_IP1_DATA));
      await ipdata.lookup(TEST_IP);
      const info = ipdata.cache.get(TEST_IP);
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('status');
    });

    it('should not cache the information', async () => {
      const customIPData = new IPData(TEST_API_KEY, { ttl: 1 });
      mockFetch.mockReturnValueOnce(mockFetchResponse(MOCK_IP1_DATA));
      await customIPData.lookup(TEST_IP);
      const info = ipdata.cache.get(TEST_IP);
      expect(info).toBeUndefined();
    });
  });

  it('should throw an error if a selectField and fields is provided', async () => {
    await expect(ipdata.lookup(undefined, 'field', ['field'])).rejects.toThrow(
      'The selectField and fields parameters cannot be used at the same time.',
    );
  });

  describe('selectField', () => {
    it('should throw an error for an invlaid field', async () => {
      const field = 'field';
      await expect(ipdata.lookup(undefined, field)).rejects.toThrow(`${field} is not a valid field.`);
    });

    it('should return a response with only the field', async () => {
      const field = 'is_eu';
      mockFetch.mockReturnValueOnce(mockFetchResponse(false));
      const info = await ipdata.lookup(undefined, field);
      expect(info).toHaveProperty(field, false);
      expect(info).toHaveProperty('status');
    });
  });

  describe('fields', () => {
    it('should throw an error for an invlaid field', async () => {
      const field = 'field';
      const fields = [field];
      await expect(ipdata.lookup(undefined, undefined, fields)).rejects.toThrow(`${field} is not a valid field.`);
    });

    it('should return a response with only the field', async () => {
      const field1 = 'ip';
      const field2 = 'is_eu';
      const fields = [field1, field2];
      mockFetch.mockReturnValueOnce(mockFetchResponse({ ip: TEST_IP, is_eu: false }));
      const info = await ipdata.lookup(TEST_IP, undefined, fields);
      expect(info).toHaveProperty(field1, TEST_IP);
      expect(info).toHaveProperty(field2, false);
      expect(info).toHaveProperty('status');
    });
  });

  describe('company field', () => {
    it('should accept company as a valid select field', async () => {
      const companyData = {
        name: 'Cloudflare, Inc.',
        domain: 'cloudflare.com',
        network: '1.1.1.0/24',
        type: 'hosting',
      };
      mockFetch.mockReturnValueOnce(mockFetchResponse(companyData));
      const info = await ipdata.lookup(TEST_IP, 'company');
      expect(info).toHaveProperty('company');
      expect(info).toHaveProperty('status');
    });

    it('should accept company in fields array', async () => {
      const fields = ['ip', 'company'];
      mockFetch.mockReturnValueOnce(mockFetchResponse({ ip: TEST_IP, company: MOCK_IP1_DATA.company }));
      const info = await ipdata.lookup(TEST_IP, undefined, fields);
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('status');
    });
  });

  describe('new API fields', () => {
    it('should return threat object with new fields', async () => {
      mockFetch.mockReturnValueOnce(mockFetchResponse(MOCK_IP1_DATA));
      const info = await ipdata.lookup(TEST_IP);
      expect(info).toHaveProperty('threat');
      expect(info.threat).toHaveProperty('is_icloud_relay');
      expect(info.threat).toHaveProperty('is_datacenter');
      expect(info.threat).toHaveProperty('blocklists');
    });

    it('should return languages with code field', async () => {
      mockFetch.mockReturnValueOnce(mockFetchResponse(MOCK_IP1_DATA));
      const info = await ipdata.lookup(TEST_IP);
      expect(info.languages.length).toBeGreaterThan(0);
      expect(info.languages[0]).toHaveProperty('code');
    });
  });
});

describe('bulkLookup()', () => {
  const ipdata = new IPData(TEST_API_KEY);
  const IP1 = TEST_IP;
  const IP2 = '8.8.8.8';

  afterEach(() => {
    ipdata.cache.clear();
    mockFetch.mockReset();
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
    mockFetch.mockReturnValueOnce(mockFetchResponse([MOCK_IP1_DATA, MOCK_IP2_DATA]));
    const result = await ipdata.bulkLookup([IP1, IP2]);
    const info = keyBy(result);
    expect(info[IP1]).toHaveProperty('ip', IP1);
    expect(info[IP1]).toHaveProperty('status');
    expect(info[IP2]).toHaveProperty('ip', IP2);
    expect(info[IP2]).toHaveProperty('status');
  });

  it('should cache the info', async () => {
    mockFetch.mockReturnValueOnce(mockFetchResponse([MOCK_IP1_DATA, MOCK_IP2_DATA]));
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
    mockFetch.mockReturnValueOnce(mockFetchResponse(MOCK_IP1_DATA));
    await ipdata.lookup(IP1);
    expect(ipdata.cache.get(IP1)).toBeDefined();
    mockFetch.mockReturnValueOnce(mockFetchResponse([MOCK_IP2_DATA, MOCK_IP3_DATA]));
    const result = await ipdata.bulkLookup([IP1, IP2, IP3]);
    const info = keyBy(result);
    expect(info[IP1]).toHaveProperty('ip', IP1);
    expect(info[IP1]).toHaveProperty('status');
    expect(info[IP2]).toHaveProperty('ip', IP2);
    expect(info[IP2]).toHaveProperty('status');
    expect(info[IP3]).toHaveProperty('ip', IP3);
    expect(info[IP3]).toHaveProperty('status');
  });

  describe('fields', () => {
    it('should throw an error for an invlaid field', async () => {
      const field = 'field';
      const fields = [field];
      await expect(ipdata.bulkLookup([IP1, IP2], fields)).rejects.toThrow(`${field} is not a valid field.`);
    });

    it('should return a response with only the field', async () => {
      const field1 = 'ip';
      const field2 = 'is_eu';
      const fields = [field1, field2];
      mockFetch.mockReturnValueOnce(
        mockFetchResponse([
          { ip: IP1, is_eu: false },
          { ip: IP2, is_eu: true },
        ]),
      );
      const result = await ipdata.bulkLookup([IP1, IP2], fields);
      const info = keyBy(result);
      expect(info[IP1]).toHaveProperty(field1, IP1);
      expect(info[IP1]).toHaveProperty(field2, false);
      expect(info[IP1]).toHaveProperty('status');
      expect(info[IP2]).toHaveProperty(field1, IP2);
      expect(info[IP2]).toHaveProperty(field2, true);
      expect(info[IP2]).toHaveProperty('status');
    });
  });
});

function keyBy(items: LookupResponse[]): Record<string, LookupResponse> {
  const result: Record<string, LookupResponse> = {};
  for (const item of items) {
    result[item.ip] = item;
  }
  return result;
}
