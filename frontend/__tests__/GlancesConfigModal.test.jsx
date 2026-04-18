import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GlancesConfigModal from '../src/components/GlancesConfigModal.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      const map = {
        'configure_glances': 'Configure Glances',
        'glances_url': 'Glances URL',
        'glances_url_placeholder': 'http://server-ip:61208',
        'username': 'Username (optional)',
        'password': 'Password (optional)',
        'poll_interval': 'Poll Interval',
        'seconds': 'seconds',
        'enabled': 'Enabled',
        'save_config': 'Save Configuration',
        'test_connection': 'Test Connection',
        'no_auth_warning': 'No authentication configured.',
        'remove_config': 'Remove Configuration',
        'confirm_remove': 'Remove monitoring?',
        'device_selection': 'Device Selection',
        'device_selection_hint': 'Select which devices to monitor.',
        'network_interfaces': 'Network Interfaces',
        'disk_partitions': 'Disk Partitions',
        'sensors': 'Sensors',
        'gpus': 'GPUs',
        'select_all': 'Select All',
        'deselect_all': 'Deselect All',
        'discovering': 'Discovering...',
        'devices_selected': `${opts?.count ?? 0} selected`,
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('../src/api/client.js', () => ({
  api: {
    getGlancesConfig: vi.fn().mockResolvedValue(null),
    saveGlancesConfig: vi.fn().mockResolvedValue({}),
    deleteGlancesConfig: vi.fn().mockResolvedValue({}),
    testGlancesConnection: vi.fn().mockResolvedValue({ ok: true, version: '4.0' }),
    discoverGlancesDevices: vi.fn().mockResolvedValue({
      network_interfaces: [],
      disk_partitions: [],
      sensors: [],
      gpus: [],
    }),
  },
}));

import { api } from '../src/api/client.js';

describe('GlancesConfigModal', () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    api.getGlancesConfig.mockResolvedValue(null);
  });

  const renderModal = () => render(
    <GlancesConfigModal serverId={1} onClose={onClose} onSaved={onSaved} />
  );

  it('should render the modal with form fields', () => {
    renderModal();
    expect(screen.getByText('Configure Glances')).toBeDefined();
    expect(screen.getByPlaceholderText('http://server-ip:61208')).toBeDefined();
    expect(screen.getByText('Save Configuration')).toBeDefined();
    expect(screen.getByText('Test Connection')).toBeDefined();
  });

  it('should show no-auth warning when no credentials entered', () => {
    renderModal();
    expect(screen.getByText('No authentication configured.')).toBeDefined();
  });

  it('should call onClose when X button clicked', () => {
    renderModal();
    const buttons = screen.getAllByRole('button');
    const closeBtn = buttons.find(b => b.querySelector('svg'));
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('should load existing config', async () => {
    api.getGlancesConfig.mockResolvedValue({
      glances_url: 'http://10.0.0.1:61208',
      glances_username: 'admin',
      poll_interval_seconds: 120,
      has_password: true,
      enabled: 1,
    });

    renderModal();

    await waitFor(() => {
      const urlInput = screen.getByPlaceholderText('http://server-ip:61208');
      expect(urlInput.value).toBe('http://10.0.0.1:61208');
    });
  });

  it('should discover devices after successful connection test', async () => {
    api.discoverGlancesDevices.mockResolvedValue({
      network_interfaces: [{ name: 'eth0', alias: null, is_up: true, speed: 1000 }],
      disk_partitions: [{ device: '/dev/sda1', mnt_point: '/', fs_type: 'ext4', size: 100000000000 }],
      sensors: [{ label: 'Package id 0', type: 'temperature_core', value: 45, unit: '°C' }],
      gpus: [],
    });

    renderModal();

    const urlInput = screen.getByPlaceholderText('http://server-ip:61208');
    fireEvent.change(urlInput, { target: { value: 'http://10.0.0.1:61208' } });

    const testBtn = screen.getByText('Test Connection');
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText('Device Selection')).toBeDefined();
    });

    expect(screen.getByText(/eth0/)).toBeDefined();
    expect(screen.getByText(/\/dev\/sda1/)).toBeDefined();
    expect(screen.getByText(/Package id 0/)).toBeDefined();
  });
});
