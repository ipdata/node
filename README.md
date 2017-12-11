# IPData JavaScript Library

[![Build Status](https://travis-ci.org/thomasconner/ipdata-js-library.svg?branch=master)](https://travis-ci.org/thomasconner/ipdata-js-library)

JavaScript library that can be used in a web browser or Node.js application to gather information using https://ipdata.co.

**Table of Contents**
- [Install](#install)
- [Import the library](#import-the-library)
- [Use](#use)
  * [Specify ip](#specify-ip)
  * [Specify api key](#specify-api-key)
  * [Specify language](#specify-language)

# Install

```sh
$ npm install ipdata
```

# Import the library

Import the library under a namespace.

```js
import * as ipdata from 'ipdata';
// ipdata.lookup()
```

Import just the lookup function.

```js
import { lookup } from 'ipdata';
// lookup()
```

Require the library.

```js
var ipdata = require('ipdata');
// ipdata.lookup()
```

# Use

The library by default will lookup the ip of the host computer.

```js
lookup()
  .then(function(info) {
    // info.ip === '<hostcomputerip>'
    // ...
  })
```

## Specify ip

You can provide an ip address to lookup.

```js
lookup('8.8.8.8')
  .then(function(info) {
    // info.ip === 8.8.8.8
    // ...
  })
```

## Specify api key

You can provide an api key.

```js
lookup('8.8.8.8', 'apiKey')
  .then(function(info) {
    // info.ip === 8.8.8.8
    // ...
  })
```

## Specify language

You can provide a language.

```js
lookup('8.8.8.8', undefined, 'language')
  .then(function(info) {
    // info.ip === 8.8.8.8
    // ...
  })
```
