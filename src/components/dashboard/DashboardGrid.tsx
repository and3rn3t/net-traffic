import type { ReactNode } from 'react';
import { ResponsiveGridLayout, useContainerWidth, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const BREAKPOINTS = { lg: 1024, md: 768, sm: 0 };
const COLS = { lg: 12, md: 12, sm: 1 };

interface DashboardGridProps {
  layout: Layout;
  editMode: boolean;
  onLayoutChange: (layout: Layout) => void;
  children: ReactNode;
}

export function DashboardGrid({ layout, editMode, onLayoutChange, children }: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();

  return (
    <div ref={containerRef}>
      {mounted && (
        <ResponsiveGridLayout
          width={width}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          layouts={{ lg: layout }}
          rowHeight={90}
          margin={[16, 16]}
          onLayoutChange={onLayoutChange}
          dragConfig={{
            enabled: editMode,
            handle: '.widget-drag-handle',
            bounded: true,
            threshold: 3,
          }}
          resizeConfig={{ enabled: editMode, handles: ['se'] }}
        >
          {children}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
