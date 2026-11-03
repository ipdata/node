import { createServer, type Server } from 'http';
import type { AddressInfo, Socket } from 'net';
import { once } from 'events';
import { Agent, MockAgent, errors } from 'undici';
import IPData, { EU_BASE_URL, LookupResponse } from './ipdata';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version: packageVersion }: { version: string } = require('../package.json');

const TEST_API_KEY = 'test-api-key';
const TEST_IP = '1.1.1.1';
const DEFAULT_IP_KEY = 'DEFAULT_IP';
const API_ORIGIN = 'https://api.ipdata.co';

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
  count: '0',
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

// Satellite ISP: is_satellite is present, is_anycast is not.
const SAMPLE_SATELLITE_DATA = {
  ip: '98.97.34.0',
  is_satellite: true,
  is_eu: false,
  city: 'Seattle',
  country_code: 'US',
  asn: {
    asn: 'AS14593',
    name: 'Space Exploration Technologies Corporation',
    domain: 'spacex.com',
    route: '98.97.32.0/21',
    type: 'business',
  },
  threat: {
    is_tor: false,
    is_vpn: false,
    is_icloud_relay: false,
    is_proxy: false,
    is_datacenter: false,
    is_anonymous: false,
    is_known_attacker: false,
    is_known_abuser: false,
    is_threat: false,
    is_bogon: false,
    blocklists: [],
    scores: { vpn_score: 0, proxy_score: 1, threat_score: 8, trust_score: 97 },
  },
  count: '0',
};

// Anycast address with dated blocklist entries: is_anycast is present, is_satellite is not.
const SAMPLE_ANYCAST_DATA = {
  ip: '8.8.8.8',
  is_anycast: true,
  is_eu: false,
  city: null,
  region: null,
  region_code: null,
  region_type: null,
  country_name: 'United States',
  country_code: 'US',
  continent_name: 'North America',
  continent_code: 'NA',
  latitude: 39.7599983215332,
  longitude: -98.5,
  postal: null,
  calling_code: '1',
  flag: 'https://ipdata.co/flags/us.png',
  emoji_flag: '\u{1F1FA}\u{1F1F8}',
  emoji_unicode: 'U+1F1FA U+1F1F8',
  asn: { asn: 'AS15169', name: 'Google LLC', domain: 'about.google', route: '8.8.8.0/24', type: 'hosting' },
  company: { name: 'Google LLC', domain: 'about.google', network: '8.8.8.0/24', type: 'hosting' },
  languages: [{ name: 'English', native: 'English', code: 'en' }],
  currency: { name: 'US Dollar', code: 'USD', symbol: '$', native: '$', plural: 'US dollars' },
  time_zone: { name: null, abbr: null, offset: null, is_dst: null, current_time: null },
  threat: {
    is_tor: false,
    is_vpn: false,
    is_icloud_relay: false,
    is_proxy: false,
    is_datacenter: true,
    is_anonymous: false,
    is_known_attacker: false,
    is_known_abuser: false,
    is_threat: false,
    is_bogon: false,
    blocklists: [
      {
        days_seen: 1,
        first_seen: '2026-11-02',
        last_seen: '2026-11-02',
        name: 'ipdata',
        site: 'https://ipdata.co',
        type: 'cloud',
      },
      {
        days_seen: 1,
        first_seen: '2026-11-02',
        last_seen: '2026-11-02',
        name: 'ipdata',
        site: 'https://ipdata.co',
        type: 'open_resolvers',
      },
    ],
    scores: { vpn_score: 100, proxy_score: 93, threat_score: 100, trust_score: 2 },
  },
  count: '0',
};

// VPN exit: neither top-level flag is present and the third blocklist entry has no dates.
const SAMPLE_VPN_DATA = {
  ip: '187.13.250.1',
  is_eu: false,
  threat: {
    is_tor: false,
    is_vpn: true,
    is_icloud_relay: false,
    is_proxy: false,
    is_datacenter: true,
    is_anonymous: true,
    is_known_attacker: true,
    is_known_abuser: true,
    is_threat: true,
    is_bogon: false,
    blocklists: [
      {
        days_seen: 2,
        first_seen: '2026-10-31',
        last_seen: '2026-11-02',
        name: 'Gluetun',
        site: 'https://github.com/qdm12/gluetun',
        type: 'vpn',
      },
      {
        days_seen: 1,
        first_seen: '2026-11-02',
        last_seen: '2026-11-02',
        name: 'ipdata',
        site: 'https://ipdata.co',
        type: 'cloud',
      },
      { name: 'ipdata', site: 'https://ipdata.co', type: 'vpn' },
      {
        days_seen: 2,
        first_seen: '2026-10-31',
        last_seen: '2026-11-02',
        name: 'NordVPN',
        site: 'https://nordvpn.com',
        type: 'vpn',
      },
      {
        days_seen: 2,
        first_seen: '2026-10-31',
        last_seen: '2026-11-02',
        name: 'Wikimedia Global Blocklist',
        site: 'https://wikimedia.org',
        type: 'general',
      },
      {
        days_seen: 2,
        first_seen: '2026-10-31',
        last_seen: '2026-11-02',
        name: 'X4BNet',
        site: 'https://github.com/X4BNet/lists_vpn',
        type: 'vpn',
      },
    ],
    scores: { vpn_score: 100, proxy_score: 99, threat_score: 100, trust_score: 0 },
  },
  count: '0',
};

// Every request in this file goes through an undici MockAgent injected via httpConfig.dispatcher, or through a
// loopback server; nothing reaches the network.
const mockAgent = new MockAgent();
mockAgent.disableNetConnect();
const mockPool = mockAgent.get(API_ORIGIN);

function apiPath(path: string, params: Record<string, string> = {}): string {
  const url = new URL(path, API_ORIGIN);
  url.searchParams.set('api-key', TEST_API_KEY);
  Object.keys(params).forEach((name) => {
    url.searchParams.set(name, params[name]);
  });
  return `${url.pathname}${url.search}`;
}

interface MockOptions {
  status?: number;
  params?: Record<string, string>;
}

function mockLookup(path: string, data: unknown, { status = 200, params }: MockOptions = {}): void {
  mockPool
    .intercept({ path: apiPath(path, params), method: 'GET' })
    .reply(status, JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
}

function mockBulkLookup(ips: string[], data: unknown, { status = 200, params }: MockOptions = {}): void {
  mockPool
    .intercept({ path: apiPath('/bulk', params), method: 'POST', body: JSON.stringify(ips) })
    .reply(status, JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  try {
    mockAgent.assertNoPendingInterceptors();
  } finally {
    mockPool.cleanMocks();
  }
});

afterAll(async () => {
  await mockAgent.close();
});

function keyBy(items: LookupResponse[]): Record<string, LookupResponse> {
  return items.reduce<Record<string, LookupResponse>>((acc, item) => {
    acc[item.ip] = item;
    return acc;
  }, {});
}

// Waits long enough for an entry stored with ttl: 1 to expire.
function waitForTtlExpiry(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 5);
  });
}

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

describe('httpConfig', () => {
  it('should create an undici Agent by default', async () => {
    const ipdata = new IPData(TEST_API_KEY);
    expect(ipdata.dispatcher).toBeInstanceOf(Agent);
    await ipdata.close();
  });

  it('should create an undici Agent when http2 and keepAliveTimeout are configured', async () => {
    const ipdata = new IPData(TEST_API_KEY, undefined, undefined, { http2: false, keepAliveTimeout: 1000 });
    expect(ipdata.dispatcher).toBeInstanceOf(Agent);
    await ipdata.close();
  });

  it('should use the injected dispatcher for lookup()', async () => {
    const ipdata = new IPData(TEST_API_KEY, undefined, undefined, { dispatcher: mockAgent });
    const dispatch = jest.spyOn(mockAgent, 'dispatch');
    expect(ipdata.dispatcher).toBe(mockAgent);
    mockLookup('/1.1.1.1', MOCK_IP1_DATA);
    const info = await ipdata.lookup(TEST_IP);
    expect(info).toHaveProperty('ip', TEST_IP);
    expect(dispatch).toHaveBeenCalledTimes(1);
    dispatch.mockRestore();
  });

  it('should use the injected dispatcher for bulkLookup()', async () => {
    const ipdata = new IPData(TEST_API_KEY, undefined, undefined, { dispatcher: mockAgent });
    const dispatch = jest.spyOn(mockAgent, 'dispatch');
    const ips = [TEST_IP, '8.8.8.8'];
    mockBulkLookup(ips, [MOCK_IP1_DATA, MOCK_IP2_DATA]);
    const result = await ipdata.bulkLookup(ips);
    expect(result).toHaveLength(2);
    expect(dispatch).toHaveBeenCalledTimes(1);
    dispatch.mockRestore();
  });

  it('should send sequential lookups through the same dispatcher', async () => {
    const ipdata = new IPData(TEST_API_KEY, undefined, undefined, { dispatcher: mockAgent });
    const dispatch = jest.spyOn(mockAgent, 'dispatch');
    mockLookup('/1.1.1.1', MOCK_IP1_DATA);
    mockLookup('/8.8.8.8', MOCK_IP2_DATA);
    await ipdata.lookup('1.1.1.1');
    await ipdata.lookup('8.8.8.8');
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0]).toHaveProperty('origin', API_ORIGIN);
    expect(dispatch.mock.calls[1][0]).toHaveProperty('origin', API_ORIGIN);
    dispatch.mockRestore();
  });

  describe('close()', () => {
    it('should close the Agent the instance created', async () => {
      const ipdata = new IPData(TEST_API_KEY);
      const agent = ipdata.dispatcher as Agent;
      expect(agent.closed).toBe(false);
      await ipdata.close();
      expect(agent.closed).toBe(true);
      await expect(ipdata.close()).resolves.toBeUndefined();
    });

    it('should not close an injected dispatcher', async () => {
      const agent = new Agent();
      const ipdata = new IPData(TEST_API_KEY, undefined, undefined, { dispatcher: agent });
      const close = jest.spyOn(agent, 'close');
      await ipdata.close();
      expect(close).not.toHaveBeenCalled();
      expect(agent.closed).toBe(false);
      close.mockRestore();
      await agent.close();
    });
  });
});

describe('connection reuse', () => {
  let server: Server;
  let baseUrl: string;
  const sockets: Socket[] = [];
  const requests: string[] = [];

  function nextTurn(): Promise<void> {
    return new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        body += chunk;
      });
      req.on('end', () => {
        requests.push(`${req.method} ${req.url} ${body}`.trim());
        res.setHeader('content-type', 'application/json');
        if (req.method === 'POST') {
          const ips = JSON.parse(body) as string[];
          res.end(JSON.stringify(ips.map((ip) => ({ ...MOCK_IP1_DATA, ip }))));
        } else {
          const ip = new URL(req.url!, baseUrl).pathname.slice(1) || MOCK_DEFAULT_IP_DATA.ip;
          res.end(JSON.stringify({ ...MOCK_IP1_DATA, ip }));
        }
      });
    });
    server.on('connection', (socket) => {
      sockets.push(socket);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });

  beforeEach(() => {
    sockets.length = 0;
    requests.length = 0;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('should send consecutive requests over one connection and release it on close()', async () => {
    const ipdata = new IPData(TEST_API_KEY, undefined, baseUrl);
    await ipdata.lookup('1.1.1.1');
    await nextTurn();
    await ipdata.lookup('8.8.8.8');
    await nextTurn();
    await ipdata.bulkLookup(['1.0.0.1', '9.9.9.9']);
    expect(requests).toEqual([
      `GET /1.1.1.1?api-key=${TEST_API_KEY}`,
      `GET /8.8.8.8?api-key=${TEST_API_KEY}`,
      `POST /bulk?api-key=${TEST_API_KEY} ["1.0.0.1","9.9.9.9"]`,
    ]);
    expect(sockets).toHaveLength(1);
    await ipdata.close();
    if (!sockets[0].destroyed) {
      await once(sockets[0], 'close');
    }
    expect(sockets[0].destroyed).toBe(true);
  });

  it('should not open a connection per request for back-to-back lookups', async () => {
    const ipdata = new IPData(TEST_API_KEY, undefined, baseUrl);
    // undici marks a connection reusable on the event-loop turn after its response completed, so requests awaited
    // strictly back-to-back alternate between two pooled connections; the pool never grows beyond that.
    await ipdata.lookup('1.1.1.1');
    await ipdata.lookup('8.8.8.8');
    await ipdata.lookup('1.0.0.1');
    await ipdata.lookup('9.9.9.9');
    await ipdata.bulkLookup(['4.4.4.4', '5.5.5.5']);
    expect(requests).toHaveLength(5);
    expect(sockets.length).toBeLessThanOrEqual(2);
    await ipdata.close();
  });
});

describe('stale pooled connection', () => {
  const ipdata = new IPData(TEST_API_KEY, undefined, undefined, { dispatcher: mockAgent });
  const path = apiPath('/1.1.1.1');

  afterEach(() => {
    ipdata.cache.clear();
  });

  it('should retry a lookup once when the connection closed before any response arrived', async () => {
    mockPool.intercept({ path, method: 'GET' }).replyWithError(new errors.SocketError('other side closed'));
    mockLookup('/1.1.1.1', MOCK_IP1_DATA);
    const info = await ipdata.lookup(TEST_IP);
    expect(info).toHaveProperty('ip', TEST_IP);
    expect(info).toHaveProperty('status', 200);
  });

  it('should retry a bulk lookup once when the connection was reset before any response arrived', async () => {
    const ips = [TEST_IP, '8.8.8.8'];
    mockPool
      .intercept({ path: apiPath('/bulk'), method: 'POST', body: JSON.stringify(ips) })
      .replyWithError(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }));
    mockBulkLookup(ips, [MOCK_IP1_DATA, MOCK_IP2_DATA]);
    const result = await ipdata.bulkLookup(ips);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('status', 200);
  });

  it('should not retry more than once', async () => {
    mockPool.intercept({ path, method: 'GET' }).replyWithError(new errors.SocketError('other side closed')).times(2);
    await expect(ipdata.lookup(TEST_IP)).rejects.toMatchObject({
      message: 'fetch failed',
      cause: { code: 'UND_ERR_SOCKET' },
    });
  });

  it('should not retry other transport errors', async () => {
    mockPool
      .intercept({ path, method: 'GET' })
      .replyWithError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
    await expect(ipdata.lookup(TEST_IP)).rejects.toMatchObject({
      message: 'fetch failed',
      cause: { code: 'ECONNREFUSED' },
    });
  });

  it('should not retry an HTTP error status', async () => {
    mockLookup('/1.1.1.1', { message: 'Internal error' }, { status: 500 });
    const info = await ipdata.lookup(TEST_IP);
    expect(info).toHaveProperty('status', 500);
    expect(info).toHaveProperty('message', 'Internal error');
  });
});

describe('lookup()', () => {
  const ipdata = new IPData(TEST_API_KEY, undefined, undefined, { dispatcher: mockAgent });

  afterEach(() => {
    ipdata.cache.clear();
  });

  describe('default IP address', () => {
    it('should return information', async () => {
      mockLookup('/', MOCK_DEFAULT_IP_DATA);
      const info = await ipdata.lookup();
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should return information when null is provided', async () => {
      mockLookup('/', MOCK_DEFAULT_IP_DATA);
      const info = await ipdata.lookup(undefined);
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should return information when undefined is provided', async () => {
      mockLookup('/', MOCK_DEFAULT_IP_DATA);
      const info = await ipdata.lookup(undefined);
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should cache the information', async () => {
      mockLookup('/', MOCK_DEFAULT_IP_DATA);
      await ipdata.lookup();
      const info = ipdata.cache.get(DEFAULT_IP_KEY);
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should not cache the information', async () => {
      const customIPData = new IPData(TEST_API_KEY, { ttl: 1 }, undefined, { dispatcher: mockAgent });
      mockLookup('/', MOCK_DEFAULT_IP_DATA);
      await customIPData.lookup();
      await waitForTtlExpiry();
      expect(customIPData.cache.get(DEFAULT_IP_KEY)).toBeUndefined();
      // The entry has expired, so the next lookup is sent to the API again.
      mockLookup('/', MOCK_DEFAULT_IP_DATA);
      const info = await customIPData.lookup();
      expect(info).toHaveProperty('ip', MOCK_DEFAULT_IP_DATA.ip);
    });
  });

  describe('custom IP address', () => {
    it('should throw an error if the ip address is invalid', async () => {
      const badIP = '1.1.11';
      await expect(ipdata.lookup(badIP)).rejects.toThrow(`${badIP} is an invalid IP address.`);
    });

    it('should return information', async () => {
      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      const info = await ipdata.lookup(TEST_IP);
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('status');
    });

    it('should cache the information', async () => {
      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      await ipdata.lookup(TEST_IP);
      const info = ipdata.cache.get(TEST_IP);
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('status');
    });

    it('should not cache the information', async () => {
      const customIPData = new IPData(TEST_API_KEY, { ttl: 1 }, undefined, { dispatcher: mockAgent });
      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      await customIPData.lookup(TEST_IP);
      await waitForTtlExpiry();
      expect(customIPData.cache.get(TEST_IP)).toBeUndefined();
      // The entry has expired, so the next lookup is sent to the API again.
      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      const info = await customIPData.lookup(TEST_IP);
      expect(info).toHaveProperty('ip', TEST_IP);
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
      mockLookup('/is_eu', false);
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
      mockLookup('/1.1.1.1', { ip: TEST_IP, is_eu: false }, { params: { fields: fields.join(',') } });
      const info = await ipdata.lookup(TEST_IP, undefined, fields);
      expect(info).toHaveProperty(field1, TEST_IP);
      expect(info).toHaveProperty(field2, false);
      expect(info).toHaveProperty('status');
    });
  });

  describe('cache keys', () => {
    it('should not serve a selectField result to a full lookup of the same address', async () => {
      mockLookup('/1.1.1.1/city', 'Los Angeles');
      const city = await ipdata.lookup(TEST_IP, 'city');
      expect(city).toEqual({ city: 'Los Angeles', status: 200 });
      expect(ipdata.cache.has(TEST_IP)).toBe(false);

      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      const info = await ipdata.lookup(TEST_IP);
      expect(info).toHaveProperty('country_name', 'United States');
      expect(ipdata.cache.get(TEST_IP)).toBe(info);
    });

    it('should not serve a fields result to a full lookup of the same address', async () => {
      mockLookup('/1.1.1.1', { ip: TEST_IP, city: 'Los Angeles' }, { params: { fields: 'ip,city' } });
      const partial = await ipdata.lookup(TEST_IP, undefined, ['ip', 'city']);
      expect(partial).toEqual({ ip: TEST_IP, city: 'Los Angeles', status: 200 });
      expect(ipdata.cache.has(TEST_IP)).toBe(false);

      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      const info = await ipdata.lookup(TEST_IP);
      expect(info).toHaveProperty('country_name', 'United States');
    });

    it('should not serve a full result to a filtered lookup of the same address', async () => {
      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      await ipdata.lookup(TEST_IP);

      mockLookup('/1.1.1.1/city', 'Los Angeles');
      const city = await ipdata.lookup(TEST_IP, 'city');
      expect(city).toEqual({ city: 'Los Angeles', status: 200 });

      mockLookup('/1.1.1.1', { ip: TEST_IP }, { params: { fields: 'ip' } });
      const partial = await ipdata.lookup(TEST_IP, undefined, ['ip']);
      expect(partial).toEqual({ ip: TEST_IP, status: 200 });
    });

    it('should serve repeated identical filtered lookups from the cache', async () => {
      mockLookup('/1.1.1.1/city', 'Los Angeles');
      const first = await ipdata.lookup(TEST_IP, 'city');
      const second = await ipdata.lookup({ ip: TEST_IP, selectField: 'city' });
      expect(second).toBe(first);

      mockLookup('/1.1.1.1', { ip: TEST_IP, city: 'Los Angeles' }, { params: { fields: 'ip,city' } });
      const partial = await ipdata.lookup(TEST_IP, undefined, ['ip', 'city']);
      // The same fields in another order select the same data, so the entry is shared.
      const reordered = await ipdata.lookup(TEST_IP, undefined, ['city', 'ip']);
      expect(reordered).toBe(partial);
    });

    it('should cache different selections of the same address separately', async () => {
      mockLookup('/1.1.1.1/city', 'Los Angeles');
      mockLookup('/1.1.1.1/is_eu', false);
      const city = await ipdata.lookup(TEST_IP, 'city');
      const isEu = await ipdata.lookup(TEST_IP, 'is_eu');
      expect(city).toEqual({ city: 'Los Angeles', status: 200 });
      expect(isEu).toEqual({ is_eu: false, status: 200 });
    });

    it('should key lookups of the default address by selection as well', async () => {
      mockLookup('/is_eu', false);
      await ipdata.lookup(undefined, 'is_eu');
      expect(ipdata.cache.has(DEFAULT_IP_KEY)).toBe(false);

      mockLookup('/', MOCK_DEFAULT_IP_DATA);
      const info = await ipdata.lookup();
      expect(info).toHaveProperty('ip', MOCK_DEFAULT_IP_DATA.ip);
      expect(ipdata.cache.get(DEFAULT_IP_KEY)).toBe(info);
    });

    it('should validate the parameters before consulting the cache', async () => {
      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      await ipdata.lookup(TEST_IP);
      await expect(ipdata.lookup(TEST_IP, 'field')).rejects.toThrow('field is not a valid field.');
      await expect(ipdata.lookup(TEST_IP, undefined, ['field'])).rejects.toThrow('field is not a valid field.');
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
      mockLookup('/1.1.1.1/company', companyData);
      const info = await ipdata.lookup(TEST_IP, 'company');
      expect(info).toHaveProperty('company');
      expect(info).toHaveProperty('status');
    });

    it('should accept company in fields array', async () => {
      const fields = ['ip', 'company'];
      mockLookup('/1.1.1.1', { ip: TEST_IP, company: MOCK_IP1_DATA.company }, { params: { fields: fields.join(',') } });
      const info = await ipdata.lookup(TEST_IP, undefined, fields);
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('status');
    });
  });

  describe('named params', () => {
    it('should return information with no params', async () => {
      mockLookup('/', MOCK_DEFAULT_IP_DATA);
      const info = await ipdata.lookup({});
      expect(info).toHaveProperty('ip');
      expect(info).toHaveProperty('status');
    });

    it('should return information with ip param', async () => {
      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      const info = await ipdata.lookup({ ip: TEST_IP });
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('status');
    });

    it('should return a selectField response', async () => {
      mockLookup('/is_eu', false);
      const info = await ipdata.lookup({ selectField: 'is_eu' });
      expect(info).toHaveProperty('is_eu', false);
      expect(info).toHaveProperty('status');
    });

    it('should return a fields response', async () => {
      mockLookup('/1.1.1.1', { ip: TEST_IP, is_eu: false }, { params: { fields: 'ip,is_eu' } });
      const info = await ipdata.lookup({ ip: TEST_IP, fields: ['ip', 'is_eu'] });
      expect(info).toHaveProperty('ip', TEST_IP);
      expect(info).toHaveProperty('is_eu', false);
      expect(info).toHaveProperty('status');
    });

    it('should throw if selectField and fields are both provided', async () => {
      await expect(ipdata.lookup({ selectField: 'ip', fields: ['ip'] })).rejects.toThrow(
        'The selectField and fields parameters cannot be used at the same time.',
      );
    });
  });

  describe('new API fields', () => {
    it('should return threat object with new fields', async () => {
      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      const info = await ipdata.lookup(TEST_IP);
      expect(info).toHaveProperty('threat');
      expect(info.threat).toHaveProperty('is_icloud_relay');
      expect(info.threat).toHaveProperty('is_datacenter');
      expect(info.threat).toHaveProperty('blocklists');
    });

    it('should return languages with code field', async () => {
      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      const info = await ipdata.lookup(TEST_IP);
      expect(info.languages.length).toBeGreaterThan(0);
      expect(info.languages[0]).toHaveProperty('code');
    });
  });

  describe('is_satellite, is_anycast and blocklist dates', () => {
    it('should expose is_satellite for a satellite ISP and leave is_anycast undefined', async () => {
      mockLookup('/98.97.34.0', SAMPLE_SATELLITE_DATA);
      const info = await ipdata.lookup('98.97.34.0');
      expect(info.is_satellite).toBe(true);
      expect(info.is_anycast).toBeUndefined();
      expect(info.is_anycast ?? false).toBe(false);
      expect(info.threat.blocklists).toEqual([]);
    });

    it('should expose is_anycast and dated blocklist entries for an anycast address', async () => {
      mockLookup('/8.8.8.8', SAMPLE_ANYCAST_DATA);
      const info = await ipdata.lookup('8.8.8.8');
      expect(info.is_anycast).toBe(true);
      expect(info.is_satellite).toBeUndefined();
      expect(info.is_satellite ?? false).toBe(false);
      expect(info.threat.blocklists).toHaveLength(2);
      expect(info.threat.blocklists![0]).toEqual({
        days_seen: 1,
        first_seen: '2026-11-02',
        last_seen: '2026-11-02',
        name: 'ipdata',
        site: 'https://ipdata.co',
        type: 'cloud',
      });
      expect(typeof info.threat.blocklists![1].first_seen).toBe('string');
      expect(typeof info.threat.blocklists![1].days_seen).toBe('number');
    });

    it('should leave both flags undefined and tolerate a blocklist entry without dates', async () => {
      mockLookup('/187.13.250.1', SAMPLE_VPN_DATA);
      const info = await ipdata.lookup('187.13.250.1');
      expect(info.is_satellite).toBeUndefined();
      expect(info.is_anycast).toBeUndefined();
      expect(info.threat.blocklists).toHaveLength(6);
      const undated = info.threat.blocklists![2];
      expect(undated).toEqual({ name: 'ipdata', site: 'https://ipdata.co', type: 'vpn' });
      expect(undated.first_seen).toBeUndefined();
      expect(undated.last_seen).toBeUndefined();
      expect(undated.days_seen).toBeUndefined();
      expect(info.threat.blocklists![0]).toMatchObject({
        name: 'Gluetun',
        days_seen: 2,
        first_seen: '2026-10-31',
        last_seen: '2026-11-02',
      });
    });

    it('should pass unknown keys through unchanged', async () => {
      mockLookup('/98.97.34.0', { ...SAMPLE_SATELLITE_DATA, future_field: 'kept' });
      const info = await ipdata.lookup('98.97.34.0');
      expect(info).toHaveProperty('future_field', 'kept');
      expect(info).toHaveProperty('is_satellite', true);
    });

    it('should accept is_satellite and is_anycast as select fields', async () => {
      mockLookup('/98.97.34.0/is_satellite', true);
      const satellite = await ipdata.lookup('98.97.34.0', 'is_satellite');
      expect(satellite).toHaveProperty('is_satellite', true);
      mockLookup('/8.8.8.8/is_anycast', true);
      const anycast = await ipdata.lookup({ ip: '8.8.8.8', selectField: 'is_anycast' });
      expect(anycast).toHaveProperty('is_anycast', true);
    });

    it('should accept is_satellite and is_anycast in the fields array', async () => {
      const fields = ['ip', 'is_satellite', 'is_anycast'];
      mockLookup('/8.8.8.8', { ip: '8.8.8.8', is_anycast: true }, { params: { fields: fields.join(',') } });
      const info = await ipdata.lookup('8.8.8.8', undefined, fields);
      expect(info).toHaveProperty('ip', '8.8.8.8');
      expect(info).toHaveProperty('is_anycast', true);
      expect(info.is_satellite).toBeUndefined();
    });
  });

  describe('is_vpn, scores, region_type and nullable fields', () => {
    it('should expose threat.is_vpn and threat.scores', async () => {
      mockLookup('/187.13.250.1', SAMPLE_VPN_DATA);
      const info = await ipdata.lookup('187.13.250.1');
      expect(info.threat.is_vpn).toBe(true);
      expect(info.threat.scores).toEqual({ vpn_score: 100, proxy_score: 99, threat_score: 100, trust_score: 0 });
      expect<number | undefined>(info.threat.scores?.trust_score).toBe(0);
    });

    it('should pass count through as the string the API sends', async () => {
      mockLookup('/98.97.34.0', SAMPLE_SATELLITE_DATA);
      const info = await ipdata.lookup('98.97.34.0');
      expect<string>(info.count).toBe('0');
      expect(info.threat.is_vpn).toBe(false);
      expect(info.threat.scores).toEqual({ vpn_score: 0, proxy_score: 1, threat_score: 8, trust_score: 97 });
    });

    it('should expose null location fields for an address without a location', async () => {
      mockLookup('/8.8.8.8', SAMPLE_ANYCAST_DATA);
      const info = await ipdata.lookup('8.8.8.8');
      expect(info.city).toBeNull();
      expect(info.region).toBeNull();
      expect(info.region_code).toBeNull();
      expect(info.region_type).toBeNull();
      expect(info.postal).toBeNull();
      expect(info.time_zone).toEqual({ name: null, abbr: null, offset: null, is_dst: null, current_time: null });
    });
  });
});

describe('bulkLookup()', () => {
  const ipdata = new IPData(TEST_API_KEY, undefined, undefined, { dispatcher: mockAgent });
  const IP1 = TEST_IP;
  const IP2 = '8.8.8.8';

  afterEach(() => {
    ipdata.cache.clear();
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
    mockBulkLookup([IP1, IP2], [MOCK_IP1_DATA, MOCK_IP2_DATA]);
    const result = await ipdata.bulkLookup([IP1, IP2]);
    const info = keyBy(result);
    expect(info[IP1]).toHaveProperty('ip', IP1);
    expect(info[IP1]).toHaveProperty('status');
    expect(info[IP2]).toHaveProperty('ip', IP2);
    expect(info[IP2]).toHaveProperty('status');
  });

  it('should cache the info', async () => {
    mockBulkLookup([IP1, IP2], [MOCK_IP1_DATA, MOCK_IP2_DATA]);
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
    mockLookup('/1.1.1.1', MOCK_IP1_DATA);
    await ipdata.lookup(IP1);
    expect(ipdata.cache.get(IP1)).toBeDefined();
    mockBulkLookup([IP2, IP3], [MOCK_IP2_DATA, MOCK_IP3_DATA]);
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
      mockBulkLookup(
        [IP1, IP2],
        [
          { ip: IP1, is_eu: false },
          { ip: IP2, is_eu: true },
        ],
        { params: { fields: fields.join(',') } },
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

  describe('cache keys', () => {
    it('should cache a fields result separately from a full lookup', async () => {
      const fields = ['ip', 'is_eu'];
      mockBulkLookup(
        [IP1, IP2],
        [
          { ip: IP1, is_eu: false },
          { ip: IP2, is_eu: true },
        ],
        { params: { fields: fields.join(',') } },
      );
      await ipdata.bulkLookup([IP1, IP2], fields);
      expect(ipdata.cache.has(IP1)).toBe(false);
      expect(ipdata.cache.has(IP2)).toBe(false);

      // Neither a full lookup nor a full bulk lookup is served the filtered entries.
      mockLookup('/1.1.1.1', MOCK_IP1_DATA);
      const single = await ipdata.lookup(IP1);
      expect(single).toHaveProperty('country_name', 'United States');

      mockBulkLookup([IP2], [MOCK_IP2_DATA]);
      const info = keyBy(await ipdata.bulkLookup([IP1, IP2]));
      expect(info[IP1]).toBe(single);
      expect(info[IP2]).toHaveProperty('country_name', 'United States');
      expect(ipdata.cache.get(IP2)).toBe(info[IP2]);
    });

    it('should reuse cached entries only for the same fields', async () => {
      const fields = ['ip', 'is_eu'];
      mockLookup('/1.1.1.1', { ip: IP1, is_eu: false }, { params: { fields: fields.join(',') } });
      await ipdata.lookup(IP1, undefined, fields);
      mockLookup('/8.8.8.8', MOCK_IP2_DATA);
      await ipdata.lookup(IP2);

      // IP1 is served from its entry for these fields; the full entry of IP2 does not match, so IP2 is requested.
      mockBulkLookup([IP2], [{ ip: IP2, is_eu: true }], { params: { fields: fields.join(',') } });
      const info = keyBy(await ipdata.bulkLookup([IP1, IP2], fields));
      expect(info[IP1]).toEqual({ ip: IP1, is_eu: false, status: 200 });
      expect(info[IP2]).toEqual({ ip: IP2, is_eu: true, status: 200 });
    });

    it('should not cache entries that do not include the ip field', async () => {
      const fields = ['is_eu'];
      mockBulkLookup([IP1, IP2], [{ is_eu: false }, { is_eu: true }], { params: { fields: fields.join(',') } });
      const result = await ipdata.bulkLookup([IP1, IP2], fields);
      expect(result).toEqual([
        { is_eu: false, status: 200 },
        { is_eu: true, status: 200 },
      ]);
      expect(ipdata.cache.size).toBe(0);

      // A lookup of the default address with the same fields is not served one of those entries.
      mockLookup('/', { is_eu: false }, { params: { fields: fields.join(',') } });
      const info = await ipdata.lookup({ fields });
      expect(info).toEqual({ is_eu: false, status: 200 });
    });
  });

  describe('is_satellite, is_anycast and blocklist dates', () => {
    const SATELLITE_IP = '98.97.34.0';
    const ANYCAST_IP = '8.8.8.8';

    it('should return the new fields per item', async () => {
      const ips = [SATELLITE_IP, ANYCAST_IP];
      mockBulkLookup(ips, [SAMPLE_SATELLITE_DATA, SAMPLE_ANYCAST_DATA]);
      const info = keyBy(await ipdata.bulkLookup(ips));
      expect(info[SATELLITE_IP].is_satellite).toBe(true);
      expect(info[SATELLITE_IP].is_anycast).toBeUndefined();
      expect(info[SATELLITE_IP].threat.blocklists).toEqual([]);
      expect(info[ANYCAST_IP].is_anycast).toBe(true);
      expect(info[ANYCAST_IP].is_satellite).toBeUndefined();
      expect(info[ANYCAST_IP].threat.blocklists![1]).toMatchObject({
        type: 'open_resolvers',
        days_seen: 1,
        first_seen: '2026-11-02',
        last_seen: '2026-11-02',
      });
    });

    it('should accept is_satellite and is_anycast in the fields array', async () => {
      const ips = [SATELLITE_IP, ANYCAST_IP];
      const fields = ['ip', 'is_satellite', 'is_anycast'];
      mockBulkLookup(
        ips,
        [
          { ip: SATELLITE_IP, is_satellite: true },
          { ip: ANYCAST_IP, is_anycast: true },
        ],
        { params: { fields: fields.join(',') } },
      );
      const info = keyBy(await ipdata.bulkLookup(ips, fields));
      expect(info[SATELLITE_IP]).toHaveProperty('is_satellite', true);
      expect(info[SATELLITE_IP].is_anycast).toBeUndefined();
      expect(info[ANYCAST_IP]).toHaveProperty('is_anycast', true);
      expect(info[ANYCAST_IP].is_satellite).toBeUndefined();
    });
  });
});

describe('User-Agent', () => {
  const ipdata = new IPData(TEST_API_KEY, undefined, undefined, { dispatcher: mockAgent });
  const userAgent = `ipdata-node/${packageVersion}`;

  afterEach(() => {
    ipdata.cache.clear();
  });

  it('should be derived from the package version', () => {
    expect(packageVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should identify the library on lookup()', async () => {
    mockPool
      .intercept({ path: apiPath('/1.1.1.1'), method: 'GET', headers: { 'user-agent': userAgent } })
      .reply(200, JSON.stringify(MOCK_IP1_DATA), { headers: { 'content-type': 'application/json' } });
    const info = await ipdata.lookup(TEST_IP);
    expect(info).toHaveProperty('ip', TEST_IP);
  });

  it('should identify the library on bulkLookup()', async () => {
    const ips = [TEST_IP, '8.8.8.8'];
    mockPool
      .intercept({
        path: apiPath('/bulk'),
        method: 'POST',
        body: JSON.stringify(ips),
        headers: { 'user-agent': userAgent, 'content-type': 'application/json', accept: 'application/json' },
      })
      .reply(200, JSON.stringify([MOCK_IP1_DATA, MOCK_IP2_DATA]), { headers: { 'content-type': 'application/json' } });
    const result = await ipdata.bulkLookup(ips);
    expect(result).toHaveLength(2);
  });
});
