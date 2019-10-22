import nock from 'nock';
import IPData from './ipdata';

const API_KEY = 'test';

describe('lookup()', () => {
  it('should return information when the ip is undefined', async () => {
    const ipdata = new IPData(API_KEY);
    const info = await ipdata.lookup();
    expect(info).toHaveProperty('ip');
  });

  it('should throw an error if the ip is null', () => {
    const ipdata = new IPData(API_KEY);
    expect(ipdata.lookup(null)).rejects.toThrowError('Invalid IP address.');
  });

  it('should set an ip in the uri', async () => {
    const ip = '8.8.8.8';
    const ipdata = new IPData(API_KEY);
    const info = await ipdata.lookup(ip);
    expect(info).toHaveProperty('ip', ip);
  });

  it('should return the response from the cache', async () => {
    const ip = '8.8.8.8';
    const ipdata = new IPData(API_KEY);
    await ipdata.lookup(ip);

    nock.disableNetConnect();
    const info = await ipdata.lookup(ip);
    expect(info).toHaveProperty('ip', ip);
    nock.enableNetConnect();
  });
});
