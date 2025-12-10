/**
 * Unit tests for MetricCard component
 * Tests rendering, props, and trend display
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '@/components/MetricCard';
import { Smartphone } from 'lucide-react';

describe('MetricCard', () => {
  describe('Basic Rendering', () => {
    it('should render with title and value', () => {
      render(<MetricCard title="Total Devices" value={42} />);

      expect(screen.getByText('Total Devices')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should render with string value', () => {
      render(<MetricCard title="Status" value="Active" />);

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should render with subtitle', () => {
      render(<MetricCard title="Bandwidth" value="1.2 GB" subtitle="Last 24 hours" />);

      expect(screen.getByText('Bandwidth')).toBeInTheDocument();
      expect(screen.getByText('1.2 GB')).toBeInTheDocument();
      expect(screen.getByText('Last 24 hours')).toBeInTheDocument();
    });

    it('should render with icon', () => {
      render(<MetricCard title="Devices" value={10} icon={<Smartphone data-testid="icon" />} />);

      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });
  });

  describe('Trend Display', () => {
    it('should display up trend', () => {
      render(<MetricCard title="Traffic" value="100 MB" trend="up" trendValue="+10%" />);

      expect(screen.getByText('↑')).toBeInTheDocument();
      expect(screen.getByText('+10%')).toBeInTheDocument();
    });

    it('should display down trend', () => {
      render(<MetricCard title="Traffic" value="100 MB" trend="down" trendValue="-5%" />);

      expect(screen.getByText('↓')).toBeInTheDocument();
      expect(screen.getByText('-5%')).toBeInTheDocument();
    });

    it('should display neutral trend', () => {
      render(<MetricCard title="Traffic" value="100 MB" trend="neutral" trendValue="0%" />);

      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should not display trend if trendValue is missing', () => {
      render(<MetricCard title="Traffic" value="100 MB" trend="up" />);

      expect(screen.queryByText('↑')).not.toBeInTheDocument();
    });

    it('should not display trend if trend is missing', () => {
      render(<MetricCard title="Traffic" value="100 MB" trendValue="+10%" />);

      expect(screen.queryByText('↑')).not.toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(<MetricCard title="Test" value={1} className="custom-class" />);

      const card = container.querySelector('.custom-class');
      expect(card).toBeInTheDocument();
    });

    it('should have correct structure for value display', () => {
      render(<MetricCard title="Test" value={123} />);

      const valueElement = screen.getByText('123');
      expect(valueElement).toHaveClass('text-2xl', 'font-bold', 'font-mono');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero value', () => {
      render(<MetricCard title="Count" value={0} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle large numbers', () => {
      render(<MetricCard title="Count" value={999999} />);

      expect(screen.getByText('999999')).toBeInTheDocument();
    });

    it('should handle empty string value', () => {
      render(<MetricCard title="Status" value="" />);

      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('should handle long titles', () => {
      const longTitle = 'This is a very long title that might wrap';
      render(<MetricCard title={longTitle} value={1} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });
  });
});
