import { lookup } from './ipdata';
import { expect } from 'chai';

describe('lookup()', () => {
  it('should throw an error if ip is undefined', async () => {
    try {
      await lookup(undefined);
    } catch (e) {
      expect(e).to.be.instanceof(Error);
      expect(e.message).to.equal('Please provide a valid ip.');
    }
  });

  it('should throw an error if ip is null', async () => {
    try {
      await lookup(null);
    } catch (e) {
      expect(e).to.be.instanceof(Error);
      expect(e.message).to.equal('Please provide a valid ip.');
    }
  });

  it('should throw an error for an invalid ip', async () => {
    try {
      await lookup('000.0000.00.00');
    } catch (e) {
      expect(e).to.be.instanceof(Error);
      expect(e.message).to.equal('Please provide a valid ip.');
    }
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
});
