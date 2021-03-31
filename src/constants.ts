import { config, DotenvParseOutput } from 'dotenv';
import { Env } from './types';

export const env: DotenvParseOutput & Env = config().parsed;

export const CACHE_MAX = env.CACHE_MAX_SIZE ? parseInt(env.CACHE_MAX_SIZE, 10) : 4096; // max number of items
export const CACHE_MAX_AGE: number = env.CACHE_MAX_AGE ? parseInt(env.CACHE_MAX_AGE, 10) : 1000 * 60 * 60 * 24; // 24 hours
export const DEFAULT_IP = env.DEFAULT_IP || 'DEFAULT_IP';
export const BASE_URL = env.BASE_URL || 'https://api.ipdata.co/';
export const VALID_FIELDS = [
  'ip',
  'is_eu',
  'city',
  'region',
  'region_code',
  'country_name',
  'country_code',
  'continent_name',
  'continent_code',
  'latitude',
  'longitude',
  'asn',
  'organisation',
  'postal',
  'calling_code',
  'flag',
  'emoji_flag',
  'emoji_unicode',
  'carrier',
  'languages',
  'currency',
  'time_zone',
  'threat',
  'count',
  'status',
];
