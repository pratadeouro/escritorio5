import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context';
import { 
  History, 
  Search, 
  Calendar, 
  User, 
  Eye, 
  Filter, 
  X, 
  RefreshCw, 
  Building2, 
  Activity, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import Modal from '../components/Modal';
import { LogRegistro } from '../types';

// Helper to normalize various date formats (e.g. "dd/MM/yyyy HH:mm:ss" or ISO) into "yyyy-MM-dd"
const parseToYmd = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();

  // If already yyyy-MM-dd at start
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }

  // If dd/MM/yyyy or dd/MM/yy
  if (trimmed.includes('/')) {
    const datePart = trimmed.split(' ')[0];
    const parts = datePart.split('/');
    if (parts.length === 3) {
      let [day, month, year] = parts;
      if (year.length === 2) year = '20' + year;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // If dd-MM-yyyy or similar
  if (trimmed.includes('-')) {
    const datePart = trimmed.split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const [p1, p2, p3] = parts;
      if (p1.length === 4) {
        return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
      } else if (p3.length === 4) {
        return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
      }
    }
  }

  return trimmed.substring(0, 10);
};

export default function Logs() {
  const { state, escritorioAtivoId, isAdmin, currentUser, forceLoad } = useAppContext();

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = state.settings.itemsPerPage || 15;

  // Selected log for Modal Detail
  const [selectedLog, setSelectedLog] = useState<LogRegistro | null>(null);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedUser('');
    setSelectedAction('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Sync / refresh logs
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await forceLoad();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 1. Data Segregation: Filter logs belonging to the active office (or all for Admin)
  const officeLogs = useMemo(() => {
    if (!state.logs) return [];

    return state.logs.filter(l => {
      const logEscId = (l.idEscritorio || '').toString().trim().toUpperCase();
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();

      // If user is NOT admin, they only see logs of the current active office
      if (!isAdmin()) {
        return logEscId === activeEscId;
      } else {
        // If they are admin, and there is a specific active office selected, filter by it
        if (escritorioAtivoId) {
          return logEscId === activeEscId;
        }
      }
      return true;
    });
  }, [state.logs, escritorioAtivoId, isAdmin]);

  // 2. Extract unique lists for filtering dropdowns
  const uniqueUsers = useMemo(() => {
    const usersSet = new Set<string>();
    officeLogs.forEach(l => {
      if (l.usuario) usersSet.add(l.usuario.trim());
    });
    return Array.from(usersSet).sort();
  }, [officeLogs]);

  const uniqueActions = useMemo(() => {
    const actionsSet = new Set<string>();
    officeLogs.forEach(l => {
      if (l.acao) actionsSet.add(l.acao.trim());
    });
    return Array.from(actionsSet).sort();
  }, [officeLogs]);

  // 3. Apply active filters
  const filteredLogs = useMemo(() => {
    return officeLogs.filter(l => {
      // General search (matches details, user, or action)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const detailsMatch = (l.detalhes || '').toLowerCase().includes(term);
        const userMatch = (l.usuario || '').toLowerCase().includes(term);
        const actionMatch = (l.acao || '').toLowerCase().includes(term);
        if (!detailsMatch && !userMatch && !actionMatch) return false;
      }

      // User filter
      if (selectedUser && l.usuario?.trim() !== selectedUser) return false;

      // Action filter
      if (selectedAction && l.acao?.trim() !== selectedAction) return false;

      // Date range filter
      // Normalize different formats (e.g., dd/MM/yyyy or yyyy-MM-dd) to yyyy-MM-dd for correct string comparison
      const logDateOnly = parseToYmd(l.data);
      if (startDate && logDateOnly < startDate) return false;
      if (endDate && logDateOnly > endDate) return false;

      return true;
    });
  }, [officeLogs, searchTerm, selectedUser, selectedAction, startDate, endDate]);

  // Sort logs by date (newest first or oldest first based on sortOrder)
  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      const dateA = a.data || '';
      const dateB = b.data || '';
      if (sortOrder === 'asc') {
        return dateA.localeCompare(dateB);
      } else {
        return dateB.localeCompare(dateA);
      }
    });
  }, [filteredLogs, sortOrder]);

  // 4. Stats Calculations
  const stats = useMemo(() => {
    const total = sortedLogs.length;
    
    // User activity map
    const userCount: { [key: string]: number } = {};
    const actionCount: { [key: string]: number } = {};
    
    sortedLogs.forEach(l => {
      if (l.usuario) userCount[l.usuario] = (userCount[l.usuario] || 0) + 1;
      if (l.acao) actionCount[l.acao] = (actionCount[l.acao] || 0) + 1;
    });

    let topUser = '-';
    let topUserCount = 0;
    Object.entries(userCount).forEach(([u, c]) => {
      if (c > topUserCount) {
        topUser = u;
        topUserCount = c;
      }
    });

    let topAction = '-';
    let topActionCount = 0;
    Object.entries(actionCount).forEach(([a, c]) => {
      if (c > topActionCount) {
        topAction = a;
        topActionCount = c;
      }
    });

    return {
      total,
      topUser: topUser !== '-' ? `${topUser} (${topUserCount})` : '-',
      topAction: topAction !== '-' ? `${topAction} (${topActionCount})` : '-'
    };
  }, [sortedLogs]);

  // 5. Pagination calculation
  const totalPages = Math.ceil(sortedLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedLogs, currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Helper to colorize Action badge
  const getActionBadgeStyle = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('ADD') || act.includes('CADAST') || act.includes('NOVO')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900';
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('ATUALIZ')) {
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900';
    }
    if (act.includes('DELETE') || act.includes('EXCLU') || act.includes('REMOV')) {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900';
    }
    if (act.includes('SYNC') || act.includes('SALV') || act.includes('LOG')) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800';
  };

  // Find office name
  const getOfficeName = (id: string) => {
    const esc = state.escritorios.find(e => e.id === id);
    return esc ? esc.nome : id;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text flex items-center">
            <History className="mr-3 text-primary animate-pulse" />
            Logs de Atividades do Sistema
          </h1>
          <p className="text-sm text-app-text-muted mt-1">
            Rastreamento completo de auditoria das ações e alterações efetuadas pelos usuários.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center px-4 py-2 border border-app-border rounded-lg bg-app-surface text-app-text hover:bg-app-bg transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={18} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Sincronizando...' : 'Atualizar Dados'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-app-surface p-5 rounded-xl shadow-sm border border-app-border flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <Clipboard size={22} />
          </div>
          <div>
            <p className="text-sm text-app-text-muted">Total de Registros (Filtrados)</p>
            <p className="text-2xl font-bold text-app-text">{stats.total}</p>
          </div>
        </div>

        <div className="bg-app-surface p-5 rounded-xl shadow-sm border border-app-border flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <User size={22} />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm text-app-text-muted">Usuário Mais Ativo</p>
            <p className="text-lg font-bold text-app-text truncate" title={stats.topUser}>
              {stats.topUser}
            </p>
          </div>
        </div>

        <div className="bg-app-surface p-5 rounded-xl shadow-sm border border-app-border flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
            <Activity size={22} />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm text-app-text-muted">Movimentação Frequente</p>
            <p className="text-lg font-bold text-app-text truncate text-ellipsis" title={stats.topAction}>
              {stats.topAction}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-app-surface p-5 rounded-xl shadow-sm border border-app-border space-y-4">
        <div className="flex items-center space-x-2 text-app-text font-semibold pb-2 border-b border-app-border">
          <Filter size={18} />
          <span>Filtros Avançados</span>
          {(searchTerm || selectedUser || selectedAction || startDate || endDate) && (
            <button
              onClick={handleClearFilters}
              className="ml-auto text-xs flex items-center text-rose-500 hover:text-rose-600 border border-rose-200 hover:border-rose-300 px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/20"
            >
              <X size={12} className="mr-1" />
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* General Search Input */}
          <div className="md:col-span-2 relative">
            <label className="block text-xs font-medium text-app-text-muted mb-1">Buscar em Detalhes/Ações</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Ex: Novo processo, Walber..."
                className="w-full pl-10 pr-4 py-2 border border-app-border rounded-lg bg-app-bg text-app-text placeholder-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* User Select Filter */}
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Filtrar por Usuário</label>
            <select
              value={selectedUser}
              onChange={(e) => { setSelectedUser(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todos os Usuários</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>

          {/* Action Select Filter */}
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Filtrar por Ação</label>
            <select
              value={selectedAction}
              onChange={(e) => { setSelectedAction(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todas as Ações</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          {/* Date range filters container */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Data Início</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                className="w-full px-2 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Data Fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                className="w-full px-2 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-app-border bg-app-bg text-xs font-semibold uppercase tracking-wider text-app-text-muted">
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-app-bg/50 select-none transition-colors group"
                  onClick={() => {
                    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    setCurrentPage(1);
                  }}
                  title="Clique para ordenar por data/hora"
                >
                  <div className="flex items-center space-x-1">
                    <span>Data / Hora</span>
                    {sortOrder === 'asc' ? (
                      <ArrowUp size={14} className="text-primary" />
                    ) : (
                      <ArrowDown size={14} className="text-primary" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Ação / Movimento</th>
                {isAdmin() && <th className="px-6 py-4">Escritório</th>}
                <th className="px-6 py-4">Detalhes da Atividade</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-sm text-app-text">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin() ? 6 : 5} className="text-center py-12 text-app-text-muted">
                    <History size={48} className="mx-auto mb-3 opacity-30 text-app-text-muted" />
                    <p className="font-medium text-lg">Nenhum log encontrado</p>
                    <p className="text-xs">Tente ajustar seus critérios de filtragem ou sincronize a planilha.</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-app-bg/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-app-text-muted">
                      {log.data || 'Sem data'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {log.usuario ? log.usuario.substring(0, 2).toUpperCase() : '?' }
                        </div>
                        <span className="font-medium">{log.usuario || 'Desconhecido'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getActionBadgeStyle(log.acao)}`}>
                        {log.acao || 'Ação'}
                      </span>
                    </td>
                    {isAdmin() && (
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <div className="flex items-center space-x-1.5 text-app-text-muted">
                          <Building2 size={13} />
                          <span className="truncate max-w-[120px]" title={getOfficeName(log.idEscritorio)}>
                            {getOfficeName(log.idEscritorio)}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="line-clamp-2 text-xs text-app-text-muted max-w-md" title={log.detalhes}>
                        {log.detalhes || 'Sem detalhes'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 hover:bg-app-bg rounded-lg text-primary hover:text-primary-hover transition-colors"
                        title="Ver Detalhes do Log"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {sortedLogs.length > 0 && (
          <div className="p-4 border-t border-app-border bg-app-bg/20 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-app-text-muted">
            <div>
              Mostrando <span className="font-semibold text-app-text">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
              <span className="font-semibold text-app-text">
                {Math.min(currentPage * itemsPerPage, sortedLogs.length)}
              </span>{' '}
              de <span className="font-semibold text-app-text">{sortedLogs.length}</span> registros
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border border-app-border rounded-lg bg-app-surface hover:bg-app-bg transition-colors disabled:opacity-45"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                // Keep within valid range
                if (pageNum < 1 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary text-white border-primary'
                        : 'border-app-border bg-app-surface hover:bg-app-bg text-app-text'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border border-app-border rounded-lg bg-app-surface hover:bg-app-bg transition-colors disabled:opacity-45"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title="Detalhes do Registro de Auditoria"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-app-border">
              <div>
                <p className="text-xs text-app-text-muted font-semibold">Data / Hora</p>
                <p className="text-sm font-mono mt-0.5">{selectedLog.data}</p>
              </div>
              <div>
                <p className="text-xs text-app-text-muted font-semibold">Ação / Movimento</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 mt-1 rounded-full text-xs font-semibold border ${getActionBadgeStyle(selectedLog.acao)}`}>
                  {selectedLog.acao}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-app-border">
              <div>
                <p className="text-xs text-app-text-muted font-semibold">Usuário Responsável</p>
                <div className="flex items-center space-x-1.5 mt-1">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                    {selectedLog.usuario ? selectedLog.usuario.substring(0, 2).toUpperCase() : '?'}
                  </div>
                  <p className="text-sm font-medium">{selectedLog.usuario}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-app-text-muted font-semibold">ID do Escritório</p>
                <div className="flex items-center space-x-1 mt-1 text-sm text-app-text-muted">
                  <Building2 size={14} className="text-primary" />
                  <span className="font-mono text-xs">{getOfficeName(selectedLog.idEscritorio)}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-app-text-muted font-semibold mb-1">Conteúdo do Log (Detalhes)</p>
              <div className="p-3 bg-app-bg border border-app-border rounded-lg font-mono text-xs text-app-text whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                {selectedLog.detalhes || 'Sem informações detalhadas adicionais.'}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-app-bg hover:bg-app-border text-app-text rounded-lg border border-app-border transition-colors text-sm font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
