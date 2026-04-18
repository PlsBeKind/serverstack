import { describe, it, expect } from 'vitest';
import enCommon from '../src/i18n/en/common.json';
import deCommon from '../src/i18n/de/common.json';
import enDashboard from '../src/i18n/en/dashboard.json';
import deDashboard from '../src/i18n/de/dashboard.json';
import enServers from '../src/i18n/en/servers.json';
import deServers from '../src/i18n/de/servers.json';
import enContracts from '../src/i18n/en/contracts.json';
import deContracts from '../src/i18n/de/contracts.json';
import enMonitoring from '../src/i18n/en/monitoring.json';
import deMonitoring from '../src/i18n/de/monitoring.json';

function getKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, val]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof val === 'object' ? getKeys(val, path) : [path];
  });
}

describe('i18n translations', () => {
  it('should have matching keys for common namespace', () => {
    expect(getKeys(enCommon).sort()).toEqual(getKeys(deCommon).sort());
  });

  it('should have matching keys for dashboard namespace', () => {
    expect(getKeys(enDashboard).sort()).toEqual(getKeys(deDashboard).sort());
  });

  it('should have matching keys for servers namespace', () => {
    expect(getKeys(enServers).sort()).toEqual(getKeys(deServers).sort());
  });

  it('should have matching keys for contracts namespace', () => {
    expect(getKeys(enContracts).sort()).toEqual(getKeys(deContracts).sort());
  });

  it('should have matching keys for monitoring namespace', () => {
    expect(getKeys(enMonitoring).sort()).toEqual(getKeys(deMonitoring).sort());
  });

  it('should have non-empty values in English common', () => {
    const keys = getKeys(enCommon);
    for (const key of keys) {
      const val = key.split('.').reduce((o, k) => o?.[k], enCommon);
      expect(val, `en common.${key} is empty`).toBeTruthy();
    }
  });

  it('should have non-empty values in German common', () => {
    const keys = getKeys(deCommon);
    for (const key of keys) {
      const val = key.split('.').reduce((o, k) => o?.[k], deCommon);
      expect(val, `de common.${key} is empty`).toBeTruthy();
    }
  });
});
