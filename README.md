# IPData Node.js Library

[![](https://github.com/ipdata/node/workflows/CI/badge.svg)](https://github.com/ipdata/node/actions)

A Node.js library for the [ipdata](https://ipdata.co) API. Look up IP addresses for geolocation, threat intelligence, company data, and more.

Requires **Node.js 18** or later. Uses the native `fetch` API with zero HTTP dependencies.

**Table of Contents**

- [Install](#install)
- [Use](#use)
  - [Import Library](#import-library)
  - [Create an Instance](#create-an-instance)
  - [EU Endpoint](#eu-endpoint)
  - [Lookup](#lookup)
  - [Bulk Lookup](#bulk-lookup)
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

## Response Fields

The following fields are available for use with `selectField` and `fields`:

`ip`, `is_eu`, `city`, `region`, `region_code`, `country_name`, `country_code`, `continent_name`, `continent_code`, `latitude`, `longitude`, `asn`, `company`, `organisation`, `postal`, `calling_code`, `flag`, `emoji_flag`, `emoji_unicode`, `carrier`, `languages`, `currency`, `time_zone`, `threat`, `count`

**`asn`** — `{ asn, name, domain, route, type }`

**`company`** — `{ name, domain, network, type }`

**`carrier`** — `{ name, mcc, mnc }`

**`threat`** — `{ is_tor, is_icloud_relay, is_proxy, is_datacenter, is_anonymous, is_known_attacker, is_known_abuser, is_threat, is_bogon, blocklists }`

## TypeScript

The library is written in TypeScript and exports the following types:

```ts
import IPData, { EU_BASE_URL, CacheConfig, LookupParams, LookupResponse } from 'ipdata';
```
