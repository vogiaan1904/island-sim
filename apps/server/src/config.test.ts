import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, configFromEnv } from './config.ts';

describe('configFromEnv', () => {
  it('keeps the defaults when nothing is set', () => {
    expect(configFromEnv({})).toEqual(DEFAULT_CONFIG);
    expect(DEFAULT_CONFIG.tickMs * DEFAULT_CONFIG.catchUpCapTicks).toBe(24 * 60 * 60_000);
  });

  it('reads the deployment settings', () => {
    const config = configFromEnv({
      ISLAND_HOST: '0.0.0.0',
      ISLAND_PORT: '9000',
      ISLAND_ORIGIN: 'https://island.example/',
      ISLAND_DB: '/var/lib/island/island.sqlite',
      ISLAND_BACKUP_DIR: '',
      ISLAND_SECURE_COOKIES: '0',
      ISLAND_TRUST_PROXY: '1',
    });
    expect(config).toMatchObject({
      host: '0.0.0.0',
      port: 9000,
      origin: 'https://island.example',
      databasePath: '/var/lib/island/island.sqlite',
      backupDir: null,
      secureCookies: false,
      trustProxy: true,
    });
  });

  it('reads where the built client is, and turns serving it off with an empty value', () => {
    expect(DEFAULT_CONFIG.clientDir).toMatch(/apps[\\/]client[\\/]dist$/);
    expect(configFromEnv({ ISLAND_CLIENT_DIR: '/srv/island/client' }).clientDir).toBe('/srv/island/client');
    expect(configFromEnv({ ISLAND_CLIENT_DIR: '' }).clientDir).toBeNull();
  });

  it('refuses a port that is not a number', () => {
    expect(() => configFromEnv({ ISLAND_PORT: 'eighty' })).toThrow(/ISLAND_PORT/);
  });
});
