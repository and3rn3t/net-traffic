/**
 * Unit tests for SecurityPosture component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecurityPosture } from '@/components/SecurityPosture';

describe('SecurityPosture', () => {
  it('should render security posture component', () => {
    render(<SecurityPosture flows={[]} devices={[]} threats={[]} />);
    expect(screen.getByText(/security posture/i)).toBeInTheDocument();
  });
});
