import { lookup } from './ipdata';
import { expect } from 'chai';
import * as nock from 'nock';

describe('lookup()', () => {
  it('should throw an error for an empty string', async () => {
    try {
      await lookup('');
      throw new Error('This test should fail.');
    } catch (e) {
      expect(e).to.be.instanceof(Error);
      expect(e.message).to.equal('Please provide a valid ip.');
    }
  });

  it('should throw an error for an invalid ip', async () => {
    try {
      await lookup('000.0000.00.00');
      throw new Error('This test should fail.');
    } catch (e) {
      expect(e).to.be.instanceof(Error);
      expect(e.message).to.equal('Please provide a valid ip.');
    }
  });

  it('should throw an error for a private ip', async () => {
    try {
      await lookup('203.0.113.0');
      throw new Error('This test should fail.');
    } catch (e) {
      expect(e.message).to.equal('400 - "203.0.113.0 is a private IP address"');
    }
  });

  it('should return information when the ip is undefined', async () => {
    const result = await lookup(undefined);
    expect(result).to.not.be.undefined;
  });

  it('should return information when the ip is null', async () => {
    const result = await lookup(null);
    expect(result).to.not.be.undefined;
  });

  it('should return information for a valid ip', async () => {
    const result = await lookup('8.8.8.8');
    expect(result).to.deep.equal({
      asn: 'AS15169',
      calling_code: '1',
      city: '',
      continent_code: 'NA',
      continent_name: 'North America',
      country_code: 'US',
      country_name: 'United States',
      currency: 'USD',
      currency_symbol: '$',
      flag: 'https://ipdata.co/flags/us.png',
      ip: '8.8.8.8',
      latitude: 37.751,
      longitude: -97.822,
      organisation: 'Google LLC',
      postal: '',
      region: '',
      time_zone: ''
    });
  });

  it('should set an api-key header if an apiKey is provided', async () => {
    const apiKey = 'testapikey';
    const response = {};
    const scope = nock('https://api.ipdata.co', {
      reqheaders: {
        'api-key': apiKey
      }
    })
      .get('/')
      .reply(200, response);

    const ipInfo = await lookup(undefined, apiKey);
    expect(ipInfo).to.deep.equal(response);
  });

  it('should set an ip and language in the uri', async () => {
    const ip = '8.8.8.8';
    const language = 'test';
    const response = {};
    const scope = nock('https://api.ipdata.co')
      .get(`/${ip}/${language}`)
      .reply(200, response);

    const ipInfo = await lookup(ip, undefined, language);
    expect(ipInfo).to.deep.equal(response);
  });

  it('should set the language in the uri', async () => {
    const language = 'test';
    const response = {};
    const scope = nock('https://api.ipdata.co')
      .get(`/${language}`)
      .reply(200, response);

    const ipInfo = await lookup(undefined, undefined, language);
    expect(ipInfo).to.deep.equal(response);
  });
});
