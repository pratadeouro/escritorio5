import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  label?: string; // e.g. "processos", "contatos"
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  label = 'itens'
}) => {
  // When totalPages is 0 or 1, we still render the summary footer bar for user clarity
  const isMultiPage = totalPages > 1;

  const getPageNumbers = () => {
    const pageList = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    
    if (end === totalPages) {
      start = Math.max(1, end - maxButtons + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pageList.push(i);
    }
    return pageList;
  };

  const pages = getPageNumbers();

  return (
    <div className="p-3 sm:p-4 border-t border-app-border flex flex-col sm:flex-row items-center justify-between bg-app-secondary/30 gap-2 sm:gap-4">
      <div className="text-xs sm:text-sm text-app-text-muted flex items-center gap-2">
        <span>
          Mostrando <span className="font-medium text-app-text">{totalItems === 0 ? 0 : Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}</span> a <span className="font-medium text-app-text">{Math.min(totalItems, currentPage * itemsPerPage)}</span> de <span className="font-medium text-app-text">{totalItems}</span> {label}
        </span>
        <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-app-bg text-[11px] font-medium border border-app-border text-app-text-muted">
          Página {currentPage} de {Math.max(1, totalPages)}
        </span>
      </div>

      {isMultiPage && (
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-1.5 sm:p-2 border border-app-border rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-app-text-muted hover:text-app-text"
            title="Página Anterior"
          >
            <ChevronLeft size={16} className="sm:w-5 sm:h-5" />
          </button>
          
          <div className="flex items-center space-x-1">
            {currentPage > 3 && totalPages > 5 && (
              <>
                <button
                  onClick={() => onPageChange(1)}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-medium transition-all hover:bg-app-surface border border-transparent hover:border-app-border text-app-text-muted"
                >
                  1
                </button>
                <span className="text-app-text-muted px-0.5 sm:px-1 text-[10px] sm:text-xs">...</span>
              </>
            )}
            
            {pages.map(page => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  currentPage === page 
                  ? 'bg-primary text-white shadow-sm font-bold' 
                  : 'hover:bg-app-surface border border-transparent hover:border-app-border text-app-text-muted hover:text-app-text'
                }`}
              >
                {page}
              </button>
            ))}

            {currentPage < totalPages - 2 && totalPages > 5 && (
              <>
                <span className="text-app-text-muted px-0.5 sm:px-1 text-[10px] sm:text-xs">...</span>
                <button
                  onClick={() => onPageChange(totalPages)}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-medium transition-all hover:bg-app-surface border border-transparent hover:border-app-border text-app-text-muted"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 sm:p-2 border border-app-border rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-app-text-muted hover:text-app-text"
            title="Próxima Página"
          >
            <ChevronRight size={16} className="sm:w-5 sm:h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
