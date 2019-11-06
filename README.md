# IPData JavaScript Library

[![](https://github.com/ConnerTechnology/ipdata-js-library/workflows/CI/badge.svg)](https://github.com/ConnerTechnology/ipdata-js-library/actions)

JavaScript library that can be used in a web browser or Node.js application to gather information for an IP address using https://ipdata.co.

**Table of Contents**

- [Install](#install)
- [Use](#use)
  - [Import Library](#import-library)
  - [Create an Instance](#create-an-instance)
  - [Lookup](#lookup)
  - [Bulk Lookup](#bulk-lookup)

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
  maxAge: 10 * 60 * 1000, // max age in ms (i.e. 10 minutes)
};
const ipdata = new IPData('<apiKey>', cacheConfig);
```

**Note:** To disable the cache pass `-1` as the `maxAge`.

```js
const cacheConfig = {
  maxAge: -1, // disable the cache
};
const ipdata = new IPData('<apiKey>', cacheConfig);
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
