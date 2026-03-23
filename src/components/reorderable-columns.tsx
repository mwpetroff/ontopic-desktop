import { useState, useRef, useCallback, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

export interface ColumnDef {
  id: string;
  header: ReactNode;
  content: ReactNode;
}

interface ReorderableColumnsProps {
  columns: ColumnDef[];
  storageKey: string;
  rows?: number;
  lastRowFullWidth?: boolean;
}

function getStoredOrder(storageKey: string, defaultIds: string[]): string[] {
  try {
    const stored = localStorage.getItem(`column-order-${storageKey}`);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      if (
        parsed.length === defaultIds.length &&
        defaultIds.every(id => parsed.includes(id))
      ) {
        return parsed;
      }
    }
  } catch {}
  return defaultIds;
}

function saveOrder(storageKey: string, order: string[]) {
  try {
    localStorage.setItem(`column-order-${storageKey}`, JSON.stringify(order));
  } catch {}
}

export function ReorderableColumns({ columns, storageKey, rows = 1, lastRowFullWidth = false }: ReorderableColumnsProps) {
  const defaultIds = columns.map(c => c.id);
  const [order, setOrder] = useState<string[]>(() => getStoredOrder(storageKey, defaultIds));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);

  const handleDragStart = useCallback((id: string) => {
    dragRef.current = id;
    setDragId(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragRef.current && dragRef.current !== targetId) {
      setDropTarget(targetId);
    }
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    const srcId = dragRef.current;
    if (!srcId || srcId === targetId) {
      setDragId(null);
      setDropTarget(null);
      dragRef.current = null;
      return;
    }

    setOrder(prev => {
      const next = [...prev];
      const srcIdx = next.indexOf(srcId);
      const tgtIdx = next.indexOf(targetId);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, srcId);
      saveOrder(storageKey, next);
      return next;
    });

    setDragId(null);
    setDropTarget(null);
    dragRef.current = null;
  }, [storageKey]);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropTarget(null);
    dragRef.current = null;
  }, []);

  const columnMap = new Map(columns.map(c => [c.id, c]));

  const validOrder = order.filter(id => columnMap.has(id));
  columns.forEach(c => {
    if (!validOrder.includes(c.id)) validOrder.push(c.id);
  });

  const colsPerRow = rows > 1 ? Math.ceil(validOrder.length / rows) : validOrder.length;

  const gridClassName = rows > 1
    ? `flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 min-h-0`
    : `flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 min-h-0`;

  const gridStyle = rows > 1
    ? { gridTemplateRows: `repeat(${rows}, 1fr)` }
    : undefined;

  return (
    <div className={gridClassName} style={gridStyle}>
      {validOrder.map((id, idx) => {
        const col = columnMap.get(id);
        if (!col) return null;

        const isDragging = dragId === id;
        const isOver = dropTarget === id;
        const colInRow = idx % colsPerRow;
        const rowIdx = Math.floor(idx / colsPerRow);
        const isLastCol = colInRow === colsPerRow - 1 || idx === validOrder.length - 1;
        const isLastRow = rows <= 1 || rowIdx === rows - 1;
        const isAloneInLastRow = lastRowFullWidth && isLastRow && idx === validOrder.length - 1 && colInRow === 0 && validOrder.length % colsPerRow !== 0;

        return (
          <div
            key={id}
            style={isAloneInLastRow ? { gridColumn: "1 / -1" } : undefined}
            className={`flex flex-col overflow-hidden transition-opacity duration-150 ${
              !isLastCol && !isAloneInLastRow ? "border-r border-border" : ""
            } ${!isLastRow ? "border-b border-border" : ""} ${isDragging ? "opacity-40" : ""} ${isOver ? "bg-primary/5" : ""}`}
            onDragOver={(e) => handleDragOver(e, id)}
            onDrop={() => handleDrop(id)}
            data-testid={`column-${id}`}
          >
            <div
              className={`px-3 py-2 border-b border-border flex items-center justify-between shrink-0 bg-card/50 cursor-grab active:cursor-grabbing select-none ${
                isOver ? "border-b-primary" : ""
              }`}
              draggable
              onDragStart={() => handleDragStart(id)}
              onDragEnd={handleDragEnd}
              data-testid={`column-header-${id}`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {col.header}
              </div>
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 ml-1" />
            </div>
            {col.content}
          </div>
        );
      })}
    </div>
  );
}
