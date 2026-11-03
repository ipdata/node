import { createServer, type Server } from 'http';
import type { AddressInfo, Socket } from 'net';
import { once } from 'events';
import { Agent, MockAgent, errors } from 'undici';
import IPData, { EU_BASE_URL, LookupResponse } from './ipdata';

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
});
