/**
 * Reusable CSS-grid heatmap primitive: a row label column plus N data-cell
 * columns, with color/intensity resolved by the caller. Shared by the
 * device presence and latency quality calendar widgets.
 */
interface HeatmapCell {
  /** Meaning is caller-defined (e.g. 0/1 presence, or a 0-100 quality score). */
  value: number;
  /** Native browser tooltip text for this cell. */
  title?: string;
}

export interface HeatmapRow {
  label: string;
  cells: HeatmapCell[];
}

interface HeatmapGridProps {
  rows: HeatmapRow[];
  /** Sparse column header labels; index -> label. Omitted indices render nothing. */
  columnLabels?: Record<number, string>;
  getCellColor: (value: number) => string;
  cellSize?: number;
}

export function HeatmapGrid({
  rows,
  columnLabels = {},
  getCellColor,
  cellSize = 10,
}: HeatmapGridProps) {
  const columnCount = rows[0]?.cells.length ?? 0;

  if (columnCount === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  const gridTemplateColumns = `auto repeat(${columnCount}, ${cellSize}px)`;

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns }}>
        <div />
        {Array.from({ length: columnCount }, (_, col) => (
          <div
            key={`header-${col}`}
            className="text-center text-[9px] leading-3 text-muted-foreground"
          >
            {columnLabels[col] ?? ''}
          </div>
        ))}
        {rows.map(row => (
          <div className="contents" key={row.label}>
            <div className="truncate pr-2 text-xs text-muted-foreground" title={row.label}>
              {row.label}
            </div>
            {row.cells.map((cell, col) => (
              <div
                key={col}
                title={cell.title}
                className={`rounded-sm ${getCellColor(cell.value)}`}
                style={{ width: cellSize, height: cellSize }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
