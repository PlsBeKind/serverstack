import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CostBadge from '../src/components/CostBadge.jsx';

describe('CostBadge', () => {
  it('should render formatted cost', () => {
    render(<CostBadge amount={29.99} currency="EUR" />);
    expect(screen.getByText(/29[.,]99/)).toBeDefined();
  });

  it('should render zero cost', () => {
    render(<CostBadge amount={0} />);
    expect(screen.getByText(/0[.,]00/)).toBeDefined();
  });

  it('should show PROMO badge when promo is true', () => {
    render(<CostBadge amount={19.99} promo={true} />);
    expect(screen.getByText('PROMO')).toBeDefined();
  });

  it('should not show PROMO badge when promo is false', () => {
    render(<CostBadge amount={19.99} promo={false} />);
    expect(screen.queryByText('PROMO')).toBeNull();
  });
});
