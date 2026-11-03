# IPData Node.js Library

[![](https://github.com/ipdata/node/workflows/CI/badge.svg)](https://github.com/ipdata/node/actions)

A Node.js library for the [ipdata](https://ipdata.co) API. Look up IP addresses for geolocation, threat intelligence, company data, and more.

Requires **Node.js 20.18.1** or later. HTTP requests go through [undici](https://undici.nodejs.org), the HTTP client behind Node's built-in `fetch`, so that connections are pooled and reused across lookups and HTTP/2 is negotiated where available.

**Table of Contents**

- [Install](#install)
- [Use](#use)
  - [Import Library](#import-library)
  - [Create an Instance](#create-an-instance)
  - [EU Endpoint](#eu-endpoint)
  - [Lookup](#lookup)
  - [Bulk Lookup](#bulk-lookup)
- [Connection reuse and HTTP/2](#connection-reuse-and-http2)
- [Response Fields](#response-fields)
- [TypeScript](#typescript)

## Install

```sh
npm install ipdata
```

## Use

### Import Library

```js
import IPData from 'ipdata';
```

A named export is also available:

```js
import { IPData } from 'ipdata';
```

CommonJS:

```js
const { IPData } = require('ipdata');
```

### Create an Instance

Create an instance of the `IPData` class with your [API key](https://ipdata.co/).

```js
const ipdata = new IPData('<apiKey>');
```

#### Caching

The library caches up to 4096 responses for 24 hours using an LRU cache by default. You can configure the cache by passing an options object as the second parameter.

Entries are keyed by IP address and by what was requested: a lookup restricted with `selectField` or `fields` is cached separately from a full lookup of the same address, so a filtered result is never returned for a full lookup, or the other way round. Only identical selections share an entry (the order of `fields` does not matter). Full lookups are stored under the address itself, so `ipdata.cache.has('1.1.1.1')` tells you whether a complete record is cached.

```js
const ipdata = new IPData('<apiKey>', {
  max: 1000, // max number of entries
  ttl: 10 * 60 * 1000, // 10 minutes
});
```

To disable caching, set `ttl` to `1`:

```js
const ipdata = new IPData('<apiKey>', { ttl: 1 });
```

### EU Endpoint

By default requests are routed to the global endpoint (`https://api.ipdata.co`). To ensure end-user data stays in the EU, pass the EU endpoint as the third parameter.

```js
import IPData, { EU_BASE_URL } from 'ipdata';

const ipdata = new IPData('<apiKey>', undefined, EU_BASE_URL);
```

You can also pass any custom base URL:

```js
const ipdata = new IPData('<apiKey>', undefined, 'https://eu-api.ipdata.co/');
```

### Lookup

Look up the current machine's IP when called with no arguments:

```js
const info = await ipdata.lookup();
// info.ip === '<your ip>'
```

Pass an IP address to look it up:

```js
const info = await ipdata.lookup('1.1.1.1');
// info.ip === '1.1.1.1'
```

Return a single field:

```js
const info = await ipdata.lookup('1.1.1.1', 'city');
```

Return multiple fields:

```js
const info = await ipdata.lookup('1.1.1.1', undefined, ['ip', 'city']);
```

#### Named Parameters

You can also pass a single object, which is convenient when you only need `fields` or `selectField` without specifying an IP.

```js
// Look up your own IP with specific fields
const info = await ipdata.lookup({ fields: ['ip', 'city'] });

// Look up a specific IP with a single field
const info = await ipdata.lookup({ ip: '1.1.1.1', selectField: 'city' });
```

### Bulk Lookup

Look up multiple IP addresses in a single API call:

```js
const info = await ipdata.bulkLookup(['1.1.1.1', '1.0.0.1']);
// info[0].ip === '1.1.1.1'
```

With field filtering:

```js
const info = await ipdata.bulkLookup(['1.1.1.1', '1.0.0.1'], ['ip', 'city']);
```

## Connection reuse and HTTP/2

An `IPData` instance keeps a persistent HTTPS connection pool (an [undici](https://undici.nodejs.org) `Agent`) for as long as it lives. Create one client per process (or one per API key or endpoint), keep it, and reuse it for every lookup: each new client pays a fresh TLS handshake. Requests to api.ipdata.co are multiplexed over HTTP/2 when the platform negotiates it, and fall back to HTTP/1.1 keep-alive otherwise.

Node.js runs your code on one thread, so a single instance can be shared by every request handler in the process; `worker_threads` and `cluster` workers each need their own instance, because connections cannot be shared across threads or processes. Idle HTTP/1.1 connections are closed after 60 seconds, HTTP/2 sessions are kept alive with a PING every 30 seconds, and neither keeps the event loop alive, so a script exits normally without any extra call. Call `await ipdata.close()` at shutdown when you want the pooled connections released immediately. If you pass your own `dispatcher`, you own it and `close()` leaves it open.

```js
const ipdata = new IPData('<apiKey>');

// ... lookups ...

await ipdata.close();
```

### HTTP options

The optional fourth constructor argument configures the transport:

```js
const ipdata = new IPData('<apiKey>', undefined, undefined, {
  http2: true, // negotiate HTTP/2 via ALPN and fall back to HTTP/1.1 (default: true)
  keepAliveTimeout: 60000, // milliseconds an idle connection is kept before it is closed (default: 60000)
});
```

Use `dispatcher` to send requests through your own [undici dispatcher](https://undici.nodejs.org/#/docs/api/Dispatcher), for example to reach the API through a proxy or to intercept requests in tests. `http2` and `keepAliveTimeout` only apply to the pool the library creates itself.

```js
import { EnvHttpProxyAgent, MockAgent, ProxyAgent } from 'undici';

// Explicit proxy
const ipdata = new IPData('<apiKey>', undefined, undefined, {
  dispatcher: new ProxyAgent('http://proxy.example.com:8080'),
});

// HTTP_PROXY, HTTPS_PROXY and NO_PROXY from the environment
const ipdata = new IPData('<apiKey>', undefined, undefined, { dispatcher: new EnvHttpProxyAgent() });

// Tests: canned responses, no network
const mockAgent = new MockAgent();
mockAgent.disableNetConnect();
mockAgent
  .get('https://api.ipdata.co')
  .intercept({ path: '/1.1.1.1?api-key=<apiKey>', method: 'GET' })
  .reply(200, { ip: '1.1.1.1', is_eu: false });
const ipdata = new IPData('<apiKey>', undefined, undefined, { dispatcher: mockAgent });
```

A request that fails because the server closed a pooled connection before any response byte arrived (connection reset or closed) is sent once more on a fresh connection; this also covers the `POST` made by `bulkLookup()`. HTTP error statuses are never retried.

## Response Fields

The following fields are available for use with `selectField` and `fields`:

`ip`, `is_eu`, `is_satellite`, `is_anycast`, `city`, `region`, `region_code`, `country_name`, `country_code`, `continent_name`, `continent_code`, `latitude`, `longitude`, `asn`, `company`, `organisation`, `postal`, `calling_code`, `flag`, `emoji_flag`, `emoji_unicode`, `carrier`, `languages`, `currency`, `time_zone`, `threat`, `count`

**`asn`** — `{ asn, name, domain, route, type }`

**`company`** — `{ name, domain, network, type }`

**`carrier`** — `{ name, mcc, mnc }`

**`is_satellite`** — `true` when the address belongs to a satellite internet provider. The API includes the key only when it is `true` and omits it otherwise, so treat a missing key as `false` (`info.is_satellite ?? false`).

**`is_anycast`** — `true` when the address is anycast. Also included only when `true`.

**`threat`** — `{ is_tor, is_icloud_relay, is_proxy, is_datacenter, is_anonymous, is_known_attacker, is_known_abuser, is_threat, is_bogon, blocklists }`

Each entry of `threat.blocklists` is `{ name, site, type, first_seen, last_seen, days_seen }`:

- **`first_seen`** — first day the address appeared on that blocklist, as a `YYYY-MM-DD` string (UTC)
- **`last_seen`** — most recent day the address appeared on that blocklist, same format
- **`days_seen`** — number of days the address has appeared on that blocklist (integer)

Some feeds, for example ipdata's own `vpn` list, do not report these three, so an entry may contain only `name`, `site` and `type`. The dates are passed through as strings.

## TypeScript

The library is written in TypeScript and exports the following types:

```ts
import IPData, { EU_BASE_URL, CacheConfig, HttpConfig, LookupParams, LookupResponse } from 'ipdata';
```
