import nock from 'nock';
import IPData from './ipdata';

const IP = '8.8.8.8';

describe('lookup()', () => {
  const ipdata = new IPData('test', false);

  // afterEach(() => {
  //   return clearCache(IP);
  // });

  it('should throw an error if the ip is invalid', async () => {
    const ip = '1.1.11';
    await expect(ipdata.lookup(ip)).rejects.toThrowError(`${ip} is an invalid IP address.`);
  });

  it('should return default information when no ip is provided', async () => {
    const info = await ipdata.lookup();
    expect(info).toHaveProperty('ip');
  });

  it('should return default information when null is provided', async () => {
    const info = await ipdata.lookup(null);
    expect(info).toHaveProperty('ip');
  });

  it('should return default information when undefined is provided', async () => {
    const info = await ipdata.lookup(undefined);
    expect(info).toHaveProperty('ip');
  });

  it('should set an ip in the uri', async () => {
    const ip = '8.8.8.8';
    const info = await ipdata.lookup(ip);
    expect(info).toHaveProperty('ip', ip);
  });

  it('should throw an error if a selectField and fields is provided', async () => {
    await expect(ipdata.lookup(null, 'field', ['field'])).rejects.toThrowError(
      'The selectField and fields parameters cannot be used at the same time.',
    );
  });

  describe('selectField', () => {
    it('should throw an error for an invlaid field ', async () => {
      const field = 'field';
      await expect(ipdata.lookup(null, field)).rejects.toThrowError(`${field} is not a valid field.`);
    });

    it('should return a response with only the field', async () => {
      const field = 'asn';
      const info = await ipdata.lookup(null, field);
      expect(info).toHaveProperty('select_field');
    });
  });

  describe('fields', () => {

  });

  // it('should return the response from the cache', async () => {
  //   await ipdata.lookup(IP);
  //   nock.disableNetConnect();
  //   const info = await ipdata.lookup(IP);
  //   expect(info).toHaveProperty('ip', IP);
  //   nock.enableNetConnect();
  // });

  // it('should call onResponse callback', async () => {
  //   const ipdata = new IPData(API_KEY);
  //   const onResponseSpy = jest.fn();
  //   await ipdata.lookup(IP, { onResponse: onResponseSpy });
  //   expect(onResponseSpy).toHaveBeenCalledTimes(1);
  //   expect(onResponseSpy.mock.calls[0][0]).toHaveProperty('status', 200);
  // });
});
