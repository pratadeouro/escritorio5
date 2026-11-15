import React, { useState, useCallback } from 'react';
import { GripVertical, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export const normalizeSearchStr = (val: unknown): string =>
  String(val ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const matchesOfficeFilter = (
  itemEscritorioId: string | undefined | null,
  activeEscritorioId: string | undefined | null,
  isAdminUser: boolean,
  userOfficesIds?: string[]
): boolean => {
  const itemEsc = String(itemEscritorioId ?? '').trim().toUpperCase();
  const activeEsc = String(activeEscritorioId ?? '').trim().toUpperCase();
  const isGlobal = !itemEsc || itemEsc === 'X';

  if (activeEsc && itemEsc && itemEsc !== activeEsc && !isGlobal) {
    return false;
  }

  if (!isAdminUser && !isGlobal && itemEsc) {
    const allowedOffices = (userOfficesIds || []).map((id) =>
      String(id ?? '').trim().toUpperCase()
    );
    if (!allowedOffices.includes(itemEsc)) {
      return false;
    }
  }

  return true;
};

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export function useTableColumns(
  storageKey: string,
  defaultOrder: string[],
  allColumns: string[] = defaultOrder
) {
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((id) => allColumns.includes(id));
          if (valid.length > 0) return valid;
        }
      }
    } catch {
      // ignore storage error
    }
    return defaultOrder;
  });

  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  const persistOrder = useCallback(
    (next: string[]) => {
      setColumnOrder(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore storage error
      }
    },
    [storageKey]
  );

  const toggleColumn = useCallback(
    (colId: string) => {
      setColumnOrder((prev) => {
        const next = prev.includes(colId)
          ? prev.length > 1
            ? prev.filter((id) => id !== colId)
            : prev
          : [...prev, colId];
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [storageKey]
  );

  const resetColumns = useCallback(() => {
    persistOrder(defaultOrder);
  }, [defaultOrder, persistOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        setColumnOrder((items) => {
          const oldIndex = items.indexOf(String(active.id));
          const newIndex = items.indexOf(String(over.id));
          if (oldIndex === -1 || newIndex === -1) return items;
          const next = arrayMove(items, oldIndex, newIndex);
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
    },
    [storageKey]
  );

  return {
    columnOrder,
    toggleColumn,
    resetColumns,
    isColumnModalOpen,
    setIsColumnModalOpen,
    sensors,
    handleDragEnd,
  };
}

interface SortableTableHeaderProps {
  id: string;
  label: string;
  onSort: (key: string) => void;
  sortConfig: SortConfig | null;
  responsiveClass?: string;
  align?: 'left' | 'center' | 'right';
}

export const SortableTableHeader: React.FC<SortableTableHeaderProps> = ({
  id,
  label,
  onSort,
  sortConfig,
  responsiveClass = '',
  align = 'left',
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`px-4 py-3 font-medium cursor-default group whitespace-nowrap bg-app-secondary ${responsiveClass}`}
    >
      <div
        className={`flex items-center gap-2 ${
          align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''
        }`}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-app-text-muted hover:text-app-text transition-colors"
          title="Arrastar para reordenar coluna"
        >
          <GripVertical size={14} />
        </div>
        <div
          className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors select-none"
          onClick={() => onSort(id)}
          title={`Ordenar por ${label}`}
        >
          <span>{label}</span>
          {sortConfig?.key === id && (
            <span className="text-primary">
              {sortConfig.direction === 'asc' ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </span>
          )}
        </div>
      </div>
    </th>
  );
};

interface ColumnConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnLabels: Record<string, string>;
  columnOrder: string[];
  onToggleColumn: (colId: string) => void;
  onResetColumns: () => void;
  entityName: string;
}

export const ColumnConfigModal: React.FC<ColumnConfigModalProps> = ({
  isOpen,
  onClose,
  columnLabels,
  columnOrder,
  onToggleColumn,
  onResetColumns,
  entityName,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurar Visualização de Colunas"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <p className="text-sm text-app-text-muted">
          Selecione as colunas que deseja exibir na tabela de {entityName}. Você também pode arrastar os cabeçalhos na tabela para reordená-las.
        </p>
        <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-app-border">
          {Object.entries(columnLabels).map(([id, label]) => {
            const isChecked = columnOrder.includes(id);
            const isLastRemaining = isChecked && columnOrder.length === 1;
            return (
              <label
                key={id}
                className={`flex items-center p-3 rounded-lg border border-app-border bg-app-secondary/30 hover:bg-app-secondary transition-colors cursor-pointer group ${
                  isLastRemaining ? 'opacity-80' : ''
                }`}
              >
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-app-border text-primary focus:ring-primary bg-app-surface transition-all cursor-pointer"
                    checked={isChecked}
                    disabled={isLastRemaining}
                    onChange={() => onToggleColumn(id)}
                  />
                </div>
                <span className="ml-3 text-sm font-medium text-app-text group-hover:text-primary transition-colors">
                  {label}
                </span>
              </label>
            );
          })}
        </div>
        <div className="pt-4 border-t border-app-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onResetColumns}
            className="px-4 py-2 text-xs font-semibold text-app-text-muted hover:text-app-text border border-app-border rounded-lg hover:bg-app-secondary transition-colors"
          >
            Restaurar Padrão
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-md active:scale-95"
          >
            Concluído
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-red-500/10 text-red-500 shrink-0 mt-0.5">
            <AlertTriangle size={20} />
          </div>
          <div className="text-sm text-app-text-muted leading-relaxed">
            {description}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-app-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-app-border rounded-lg text-app-text hover:bg-app-secondary/50 transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-semibold shadow-sm"
          >
            Excluir
          </button>
        </div>
      </div>
    </Modal>
  );
};
