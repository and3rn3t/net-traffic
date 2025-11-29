/**
 * Unit tests for FlowFilters component
 * Tests filter UI, preset saving/loading, and filter interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { FlowFiltersComponent, FlowFilters } from '@/components/FlowFilters';
import { createDefaultFlowFilters } from '@/test/helpers';

// Mock dependencies
vi.mock('@phosphor-icons/react', () => ({
  Funnel: () => <div data-testid="funnel-icon">Funnel</div>,
  X: () => <div data-testid="x-icon">X</div>,
}));

const renderFlowFilters = (props = {}) => {
  const defaultProps = {
    filters: createDefaultFlowFilters(),
    onFiltersChange: vi.fn(),
    onApply: vi.fn(),
    onClear: vi.fn(),
  };
  return render(<FlowFiltersComponent {...defaultProps} {...props} />);
};

describe('FlowFiltersComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render filter button', () => {
      renderFlowFilters();
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
    });

    it('should show active filter count badge', () => {
      const filters: FlowFilters = {
        ...createDefaultFlowFilters(),
        protocols: ['TCP', 'UDP'],
        status: 'active',
      };
      renderFlowFilters({ filters });
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 active filters
    });

    it('should open filter sheet when button is clicked', async () => {
      renderFlowFilters();
      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText(/flow filters/i)).toBeInTheDocument();
      });
    });

    it('should display filter options in sheet', async () => {
      renderFlowFilters();
      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText(/protocol/i)).toBeInTheDocument();
        expect(screen.getByText(/status/i)).toBeInTheDocument();
        expect(screen.getByText(/threat level/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filter Interactions', () => {
    it('should toggle protocol filter', async () => {
      const onFiltersChange = vi.fn();
      renderFlowFilters({ onFiltersChange });

      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        const protocolCheckbox = screen.getByLabelText(/TCP/i);
        if (protocolCheckbox) {
          fireEvent.click(protocolCheckbox);
          expect(onFiltersChange).toHaveBeenCalled();
        }
      });
    });

    it('should update status filter', async () => {
      const onFiltersChange = vi.fn();
      renderFlowFilters({ onFiltersChange });

      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        const statusSelect = screen.getByLabelText(/status/i);
        if (statusSelect) {
          fireEvent.change(statusSelect, { target: { value: 'active' } });
          expect(onFiltersChange).toHaveBeenCalled();
        }
      });
    });

    it('should update IP address filters', async () => {
      const onFiltersChange = vi.fn();
      renderFlowFilters({ onFiltersChange });

      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        const sourceIpInput = screen.getByLabelText(/source ip/i);
        if (sourceIpInput) {
          fireEvent.change(sourceIpInput, { target: { value: '192.168.1.1' } });
          expect(onFiltersChange).toHaveBeenCalled();
        }
      });
    });

    it('should handle time range preset selection', async () => {
      const onFiltersChange = vi.fn();
      renderFlowFilters({ onFiltersChange });

      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        const timePresetSelect = screen.getByLabelText(/time range/i);
        if (timePresetSelect) {
          fireEvent.change(timePresetSelect, { target: { value: '24h' } });
          expect(onFiltersChange).toHaveBeenCalled();
        }
      });
    });
  });

  describe('Apply and Clear', () => {
    it('should call onApply when apply button is clicked', async () => {
      const onApply = vi.fn();
      renderFlowFilters({ onApply });

      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        const applyButton = screen.getByRole('button', { name: /apply/i });
        fireEvent.click(applyButton);
        expect(onApply).toHaveBeenCalled();
      });
    });

    it('should call onClear when clear button is clicked', async () => {
      const onClear = vi.fn();
      renderFlowFilters({ onClear });

      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        const clearButton = screen.getByRole('button', { name: /clear/i });
        fireEvent.click(clearButton);
        expect(onClear).toHaveBeenCalled();
      });
    });

    it('should reset all filters when cleared', async () => {
      const onClear = vi.fn();
      const onFiltersChange = vi.fn();
      const filters: FlowFilters = {
        ...createDefaultFlowFilters(),
        protocols: ['TCP'],
        status: 'active',
        threatLevel: 'high',
        sourceIp: '192.168.1.1',
      };

      renderFlowFilters({ filters, onClear, onFiltersChange });

      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        const clearButton = screen.getByRole('button', { name: /clear/i });
        fireEvent.click(clearButton);
        expect(onClear).toHaveBeenCalled();
      });
    });
  });

  describe('Preset Management', () => {
    it('should display saved presets', async () => {
      const savedPresets = [
        {
          name: 'Test Preset',
          filters: {
            protocols: ['TCP'],
            status: null,
            threatLevel: null,
            sourceIp: '',
            destIp: '',
            startTime: null,
            endTime: null,
            minBytes: null,
            deviceId: null,
            timeRangePreset: null,
          } as FlowFilters,
        },
      ];

      renderFlowFilters({ savedPresets });

      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText('Test Preset')).toBeInTheDocument();
      });
    });

    it('should load preset when clicked', async () => {
      const onLoadPreset = vi.fn();
      const savedPresets = [
        {
          name: 'Test Preset',
          filters: {
            protocols: ['TCP'],
            status: null,
            threatLevel: null,
            sourceIp: '',
            destIp: '',
            startTime: null,
            endTime: null,
            minBytes: null,
            deviceId: null,
            timeRangePreset: null,
          } as FlowFilters,
        },
      ];

      renderFlowFilters({ savedPresets, onLoadPreset });

      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        const presetButton = screen.getByText('Test Preset');
        fireEvent.click(presetButton);
        expect(onLoadPreset).toHaveBeenCalledWith(savedPresets[0].filters);
      });
    });

    it('should save preset with name', async () => {
      const onSavePreset = vi.fn();
      renderFlowFilters({ onSavePreset });

      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        const savePresetButton = screen.getByRole('button', { name: /save preset/i });
        if (savePresetButton) {
          fireEvent.click(savePresetButton);

          const nameInput = screen.getByPlaceholderText(/preset name/i);
          if (nameInput) {
            fireEvent.change(nameInput, { target: { value: 'My Preset' } });

            const confirmButton = screen.getByRole('button', { name: /save/i });
            if (confirmButton) {
              fireEvent.click(confirmButton);
              expect(onSavePreset).toHaveBeenCalledWith('My Preset');
            }
          }
        }
      });
    });
  });

  describe('Active Filter Count', () => {
    it('should calculate active filter count correctly', () => {
      const filters: FlowFilters = {
        ...createDefaultFlowFilters(),
        protocols: ['TCP', 'UDP'],
        status: 'active',
        threatLevel: 'high',
        sourceIp: '192.168.1.1',
        minBytes: 1000,
      };

      renderFlowFilters({ filters });
      // Should show badge with count 5 (protocols count as 1, status, threatLevel, sourceIp, minBytes)
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should not show badge when no filters are active', () => {
      renderFlowFilters();
      const badge = screen.queryByText(/\d+/);
      expect(badge).not.toBeInTheDocument();
    });
  });
});
