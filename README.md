# IPData JavaScript Library

JavaScript library that can be used in a web browser or Node.js application to gather information using https://ipdata.co.

**Table of Contents**
- [Install](#install)
- [Use](#use)
  * [Specify ip](#specify-ip)
  * [Specify api key](#specify-api-key)
  * [Specify language](#specify-language)

# Install

```sh
$ npm install ipdata
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
