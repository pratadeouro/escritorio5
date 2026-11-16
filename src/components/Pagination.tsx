import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  label?: string; // e.g. "processos", "contatos"
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  label = 'itens',
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100]
}) => {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);
  // When totalPages is 0 or 1, we still render the summary footer bar for user clarity
  const isMultiPage = totalPages > 1;

  const getPageNumbers = () => {
    const pageList: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, safeCurrentPage - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    
    if (end === totalPages) {
      start = Math.max(1, end - maxButtons + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pageList.push(i);
    }
    return pageList;
  };

  const pages = isMultiPage ? getPageNumbers() : [];
  const firstPageShown = pages[0] ?? 1;
  const lastPageShown = pages[pages.length - 1] ?? 1;

  return (
    <div className="p-3 sm:px-4 sm:py-3 border-t border-app-border flex flex-col sm:flex-row items-center justify-between bg-app-secondary/30 gap-2.5 sm:gap-4 shrink-0">
      <div className="text-xs sm:text-sm text-app-text-muted flex flex-wrap items-center justify-center sm:justify-start gap-2 tabular-nums">
        <span>
          Mostrando{' '}
          <span className="font-semibold text-app-text">
            {totalItems === 0 ? 0 : Math.min(totalItems, (safeCurrentPage - 1) * itemsPerPage + 1)}
          </span>{' '}
          a{' '}
          <span className="font-semibold text-app-text">
            {Math.min(totalItems, safeCurrentPage * itemsPerPage)}
          </span>{' '}
          de <span className="font-semibold text-app-text">{totalItems}</span> {label}
        </span>
        <span className="hidden md:inline text-app-text-muted/60" aria-hidden="true">·</span>
        <span className="hidden md:inline text-xs text-app-text-muted">
          Página <span className="font-semibold text-app-text">{safeCurrentPage}</span> de{' '}
          <span className="font-semibold text-app-text">{safeTotalPages}</span>
        </span>

        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-app-text-muted/60 hidden sm:inline" aria-hidden="true">·</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              aria-label="Itens por página"
              className="bg-app-surface border border-app-border rounded-lg px-2 py-1 text-xs font-medium text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer transition-colors tabular-nums"
            >
              {itemsPerPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / pág.
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isMultiPage && (
        <div className="flex items-center gap-1 sm:gap-1.5 tabular-nums">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage === 1}
            className="p-1.5 sm:p-2 border border-app-border rounded-lg bg-app-surface/60 hover:bg-app-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-app-text-muted hover:text-app-text shrink-0"
            title="Página Anterior"
          >
            <ChevronLeft size={16} className="sm:w-4 sm:h-4" />
          </button>
          
          <div className="flex items-center gap-1">
            {firstPageShown > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onPageChange(1)}
                  className="min-w-8 h-8 px-2 sm:min-w-9 sm:h-9 sm:px-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors hover:bg-app-surface border border-transparent hover:border-app-border text-app-text-muted hover:text-app-text whitespace-nowrap shrink-0"
                >
                  1
                </button>
                {firstPageShown > 2 && (
                  <span className="text-app-text-muted px-0.5 text-xs select-none">…</span>
                )}
              </>
            )}
            
            {pages.map(page => (
              <button
                type="button"
                key={page}
                onClick={() => onPageChange(page)}
                className={`min-w-8 h-8 px-2 sm:min-w-9 sm:h-9 sm:px-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  safeCurrentPage === page 
                    ? 'bg-primary text-white shadow-sm font-semibold' 
                    : 'hover:bg-app-surface border border-transparent hover:border-app-border text-app-text-muted hover:text-app-text'
                }`}
              >
                {page}
              </button>
            ))}

            {lastPageShown < totalPages && (
              <>
                {lastPageShown < totalPages - 1 && (
                  <span className="text-app-text-muted px-0.5 text-xs select-none">…</span>
                )}
                <button
                  type="button"
                  onClick={() => onPageChange(totalPages)}
                  className="min-w-8 h-8 px-2 sm:min-w-9 sm:h-9 sm:px-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors hover:bg-app-surface border border-transparent hover:border-app-border text-app-text-muted hover:text-app-text whitespace-nowrap shrink-0"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
            disabled={safeCurrentPage === totalPages}
            className="p-1.5 sm:p-2 border border-app-border rounded-lg bg-app-surface/60 hover:bg-app-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-app-text-muted hover:text-app-text shrink-0"
            title="Próxima Página"
          >
            <ChevronRight size={16} className="sm:w-4 sm:h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
