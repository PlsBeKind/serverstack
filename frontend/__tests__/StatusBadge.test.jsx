import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../src/components/StatusBadge.jsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => {
      const map = {
        'status.active': 'Active', 'status.inactive': 'Inactive',
        'status.suspended': 'Suspended', 'status.running': 'Running',
        'status.stopped': 'Stopped', 'status.unknown': 'Unknown',
      };
      return map[key] || fallback || key;
    },
  }),
}));

describe('StatusBadge', () => {
  it('should render active status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeDefined();
  });

  it('should render running status', () => {
    render(<StatusBadge status="running" />);
    expect(screen.getByText('Running')).toBeDefined();
  });

  it('should render stopped status', () => {
    render(<StatusBadge status="stopped" />);
    expect(screen.getByText('Stopped')).toBeDefined();
  });
});
