import { useCallback, useState } from 'react';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { WIDGET_DEFINITIONS, getWidgetDefinition } from '@/components/dashboard/widgetRegistry';

const STORAGE_KEY = 'netinsight_dashboard_layout';
const SCHEMA_VERSION = 1;

interface StoredLayout {
  version: number;
  widgetIds: string[];
  layout: LayoutItem[];
}

function buildDefaultLayout(): StoredLayout {
  const widgetIds = WIDGET_DEFINITIONS.filter(w => w.defaultEnabled).map(w => w.id);
  let y = 0;
  const layout: LayoutItem[] = widgetIds.map(id => {
    const def = getWidgetDefinition(id)!;
    const item: LayoutItem = { i: id, x: 0, y, w: def.defaultLayout.w, h: def.defaultLayout.h };
    if (def.defaultLayout.minW !== undefined) item.minW = def.defaultLayout.minW;
    if (def.defaultLayout.minH !== undefined) item.minH = def.defaultLayout.minH;
    y += def.defaultLayout.h;
    return item;
  });
  return { version: SCHEMA_VERSION, widgetIds, layout };
}

function loadStoredLayout(): StoredLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultLayout();
    const parsed = JSON.parse(raw) as StoredLayout;
    if (parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.widgetIds)) {
      return buildDefaultLayout();
    }
    return parsed;
  } catch {
    return buildDefaultLayout();
  }
}

function persistLayout(state: StoredLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — layout just won't persist across reloads.
  }
}

function nextLayoutPosition(layout: LayoutItem[]): { x: number; y: number } {
  const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  return { x: 0, y: maxY };
}

export function useDashboardLayout() {
  const [state, setState] = useState<StoredLayout>(loadStoredLayout);

  const updateAndPersist = useCallback((updater: (prev: StoredLayout) => StoredLayout) => {
    setState(prev => {
      const next = updater(prev);
      persistLayout(next);
      return next;
    });
  }, []);

  const onLayoutChange = useCallback(
    (layout: Layout) => {
      updateAndPersist(prev => ({ ...prev, layout: [...layout] }));
    },
    [updateAndPersist]
  );

  const addWidget = useCallback(
    (id: string) => {
      const def = getWidgetDefinition(id);
      if (!def) return;
      updateAndPersist(prev => {
        if (prev.widgetIds.includes(id)) return prev;
        const { x, y } = nextLayoutPosition(prev.layout);
        const item: LayoutItem = { i: id, x, y, w: def.defaultLayout.w, h: def.defaultLayout.h };
        if (def.defaultLayout.minW !== undefined) item.minW = def.defaultLayout.minW;
        if (def.defaultLayout.minH !== undefined) item.minH = def.defaultLayout.minH;
        return {
          ...prev,
          widgetIds: [...prev.widgetIds, id],
          layout: [...prev.layout, item],
        };
      });
    },
    [updateAndPersist]
  );

  const removeWidget = useCallback(
    (id: string) => {
      updateAndPersist(prev => ({
        ...prev,
        widgetIds: prev.widgetIds.filter(w => w !== id),
        layout: prev.layout.filter(item => item.i !== id),
      }));
    },
    [updateAndPersist]
  );

  const resetToDefault = useCallback(() => {
    const defaults = buildDefaultLayout();
    persistLayout(defaults);
    setState(defaults);
  }, []);

  return {
    widgetIds: state.widgetIds,
    layout: state.layout,
    onLayoutChange,
    addWidget,
    removeWidget,
    resetToDefault,
  };
}
