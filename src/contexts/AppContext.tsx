import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Device, NetworkFlow, Threat } from '@/lib/types';

export interface FlowFilters {
  protocol?: string;
  threatLevel?: string;
  status?: string;
  deviceId?: string;
  searchQuery?: string;
  portRange?: [number, number];
  dateRange?: [Date, Date];
}

export interface UserPreferences {
  compactView: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  defaultTab: string;
  columnsVisible: Record<string, boolean>;
  sortPreferences: Record<string, { column: string; direction: 'asc' | 'desc' }>;
}

interface AppContextType {
  // Selection state
  selectedDevice: Device | null;
  selectedFlow: NetworkFlow | null;
  selectedThreat: Threat | null;
  setSelectedDevice: (device: Device | null) => void;
  setSelectedFlow: (flow: NetworkFlow | null) => void;
  setSelectedThreat: (threat: Threat | null) => void;

  // Filters
  filters: FlowFilters;
  setFilters: (filters: FlowFilters) => void;
  updateFilters: (partialFilters: Partial<FlowFilters>) => void;
  clearFilters: () => void;

  // User preferences
  preferences: UserPreferences;
  updatePreferences: (partialPrefs: Partial<UserPreferences>) => void;
  toggleCompactView: () => void;

  // UI state
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultPreferences: UserPreferences = {
  compactView: false,
  autoRefresh: true,
  refreshInterval: 5000,
  defaultTab: 'dashboard',
  columnsVisible: {},
  sortPreferences: {},
};

// Load preferences from localStorage
const loadPreferences = (): UserPreferences => {
  try {
    const stored = localStorage.getItem('netinsight_preferences');
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load preferences:', error);
  }
  return defaultPreferences;
};

// Save preferences to localStorage
const savePreferences = (preferences: UserPreferences) => {
  try {
    localStorage.setItem('netinsight_preferences', JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to save preferences:', error);
  }
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<NetworkFlow | null>(null);
  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null);
  const [filters, setFilters] = useState<FlowFilters>({});
  const [preferences, setPreferencesState] = useState<UserPreferences>(loadPreferences);
  const [activeTab, setActiveTab] = useState<string>(preferences.defaultTab);

  const updateFilters = useCallback((partialFilters: Partial<FlowFilters>) => {
    setFilters(prev => ({ ...prev, ...partialFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const updatePreferences = useCallback((partialPrefs: Partial<UserPreferences>) => {
    setPreferencesState(prev => {
      const updated = { ...prev, ...partialPrefs };
      savePreferences(updated);
      return updated;
    });
  }, []);

  const toggleCompactView = useCallback(() => {
    updatePreferences({ compactView: !preferences.compactView });
  }, [preferences.compactView, updatePreferences]);

  const value: AppContextType = {
    selectedDevice,
    selectedFlow,
    selectedThreat,
    setSelectedDevice,
    setSelectedFlow,
    setSelectedThreat,
    filters,
    setFilters,
    updateFilters,
    clearFilters,
    preferences,
    updatePreferences,
    toggleCompactView,
    activeTab,
    setActiveTab,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
