# IPData JavaScript Library

[![](https://github.com/thomasconner/ipdata-js-library/workflows/CI/badge.svg)](https://github.com/thomasconner/ipdata-js-library/actions)

JavaScript library that can be used in a web browser or Node.js application to gather information for an IP address using https://ipdata.co.

**Table of Contents**

- [Install](#install)
- [Use](#use)
  - [Import Library](#import-library)
  - [Create an Instance](#create-an-instance)
  - [EU Endpoint](#eu-endpoint)
  - [Lookup](#lookup)
  - [Bulk Lookup](#bulk-lookup)
- [Response Fields](#response-fields)

## Install

```sh
$ npm install ipdata
```

## Use

### Import library

Import the library.

```js
import IPData from 'ipdata';
```

**Note:** If you are using `require()` then you will need to use the default value exported from the library.

```js
const IPData = require('ipdata').default;
```

### Create an Instance

Create an instance of the `IPData` class and pass your api key for IPData as the first parameter.

```js
const ipdata = new IPData('<apiKey>');
```

The library will cache 4096 ip addresses responses for 24 hours using a LRU cache by default. You can configure the cache by passing an object as the second paramenter.

```js
const cacheConfig = {
  max: 1000, // max size
  ttl: 10 * 60 * 1000, // time-to-live in ms (i.e. 10 minutes)
};
const ipdata = new IPData('<apiKey>', cacheConfig);
```

**Note:** To disable the cache pass `1` as the `ttl` (1ms effectively disables caching).

```js
const cacheConfig = {
  ttl: 1, // disable the cache
};
const ipdata = new IPData('<apiKey>', cacheConfig);
```

### EU Endpoint

By default requests are routed to the global endpoint (`https://api.ipdata.co`). To ensure end user data stays in the EU, pass the EU endpoint as the third parameter.

```js
import IPData, { EU_BASE_URL } from 'ipdata';

const ipdata = new IPData('<apiKey>', undefined, EU_BASE_URL);
```

You can also pass a custom base URL if needed.

```js
const ipdata = new IPData('<apiKey>', undefined, 'https://eu-api.ipdata.co/');
```

### Lookup

The library will lookup the ip address of the host computer if no ip address is provided.

```js
ipdata.lookup()
  .then(function(info) {
    // info.ip === '<hostcomputerip>'
    // ...
  });
```

You can pass an ip address as the first parameter to the `lookup()` method to lookup information about the ip address using IPData.

```js
const ip = '1.1.1.1';
ipdata.lookup(ip)
  .then(function(info) {
    // info.ip === 1.1.1.1
    // ...
  });
```

You can specify only a select field to be returned when looking up an ip address by passing a field as the second parameter to the `lookup()` method.

```js
const ip = '1.1.1.1';
const selectField = 'ip';
ipdata.lookup(ip, selectField)
  .then(function(info) {
    // info.select_field === 1.1.1.1
    // ...
  });
```

You can specify only certain fields to be returned when looking up an ip address by passing an array of fields as the third parameter to the `lookup()` method.

```js
const ip = '1.1.1.1';
const fields = ['ip', 'city'];
ipdata.lookup(ip, null, fields)
  .then(function(info) {
    // ...
  });
```

### Bulk Lookup

You can lookup multiple ip addresses with one API call using the `bulkLookup()` method.

```js
const ips = ['1.1.1.1', '1.0.0.1'];
ipdata.bulkLookup(ips)
  .then(function(info) {
    // info[0].ip === 1.1.1.1
    // ...
  });
```

You can specify only certain fields to be returned when looking up multiple ip addresses by passing an array of fields as the second parameter to the `bulkLookup()` method.

```js
const ips = ['1.1.1.1', '1.0.0.1'];
const fields = ['ip', 'city'];
ipdata.bulkLookup(ips, fields)
  .then(function(info) {
    // ...
  });
```

## Response Fields

The following fields are available for use with `selectField` and `fields` parameters:

`ip`, `is_eu`, `city`, `region`, `region_code`, `country_name`, `country_code`, `continent_name`, `continent_code`, `latitude`, `longitude`, `asn`, `company`, `organisation`, `postal`, `calling_code`, `flag`, `emoji_flag`, `emoji_unicode`, `carrier`, `languages`, `currency`, `time_zone`, `threat`, `count`

The `company` field returns an object with `name`, `domain`, `network`, and `type` properties.

The `carrier` field returns an object with `name`, `mcc`, and `mnc` properties.

The `threat` field returns an object with `is_tor`, `is_icloud_relay`, `is_proxy`, `is_datacenter`, `is_anonymous`, `is_known_attacker`, `is_known_abuser`, `is_threat`, `is_bogon`, and `blocklists` properties.
