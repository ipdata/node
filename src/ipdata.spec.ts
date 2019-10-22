import { lookup } from './ipdata';
import { expect } from 'chai';
import nock from 'nock';

describe('lookup()', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should return information when the ip is undefined', async () => {
    const response = {};
    const scope = nock('https://api.ipdata.co')
      .get(`/`)
      .reply(200, response);
    const ipInfo = await lookup(undefined);
    expect(ipInfo).to.deep.equal(response);
  });

  it('should return information when the ip is null', async () => {
    const response = {};
    const scope = nock('https://api.ipdata.co')
      .get(`/`)
      .reply(200, response);
    const ipInfo = await lookup(null);
    expect(ipInfo).to.deep.equal(response);
  });

  it('should set an ip in the uri', async () => {
    const ip = '8.8.8.8';
    const response = {};
    const scope = nock('https://api.ipdata.co')
      .get(`/${ip}`)
      .reply(200, response);
    const ipInfo = await lookup(ip);
    expect(ipInfo).to.deep.equal(response);
  });

  it('should return the response from the cache', async () => {
    const ip = '8.8.8.8';
    const response = {};
    const ipInfo = await lookup(ip);
    expect(ipInfo).to.deep.equal(response);
  });

  it('should set an apiKey in the uri if an apiKey is provided', async () => {
    const apiKey = 'testapikey';
    const response = {};
    const scope = nock('https://api.ipdata.co')
      .get('/')
      .query({ 'api-key': apiKey })
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
