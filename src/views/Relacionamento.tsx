import React, { useState, useMemo, useEffect } from 'react';
import { Network, Plus, Edit2, Trash2, X, Search, ShieldCheck, Settings2 } from 'lucide-react';
import { useAppContext } from '../context';
import { TipoEnvolvimento } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Pagination from '../components/Pagination';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import {
  SortableTableHeader,
  ColumnConfigModal,
  ConfirmDeleteModal,
  useTableColumns,
  normalizeSearchStr,
  SortConfig,
} from '../components/CadastrosTableHelper';

const RELACIONAMENTO_COLUMN_LABELS: Record<string, string> = {
  nome: 'Nome do Relacionamento',
  id: 'ID (public.envolvidos_tipo)',
  tipo: 'Categoria',
  vinculos: 'Partes Vinculadas',
};

const RELACIONAMENTO_DEFAULT_COLUMNS = ['nome', 'id', 'tipo', 'vinculos'];

const Relacionamento: React.FC = () => {
  const {
    state,
    addTipoEnvolvimento,
    updateTipoEnvolvimento,
    deleteTipoEnvolvimento,
    hasPermission,
    isAdmin,
  } = useAppContext();

  const canWrite = isAdmin() || hasPermission('relacionamento', 'write') || hasPermission('processos', 'write');
  const canDelete = isAdmin() || hasPermission('relacionamento', 'delete') || hasPermission('processos', 'delete');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TipoEnvolvimento | null>(null);
  const [deletingItem, setDeletingItem] = useState<TipoEnvolvimento | null>(null);
  const [nomeInput, setNomeInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'nome', direction: 'asc' });

  const {
    columnOrder,
    toggleColumn,
    resetColumns,
    isColumnModalOpen,
    setIsColumnModalOpen,
    sensors,
    handleDragEnd,
  } = useTableColumns(
    'relacionamento_columns_v1',
    RELACIONAMENTO_DEFAULT_COLUMNS,
    Object.keys(RELACIONAMENTO_COLUMN_LABELS)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleSort = (key: string) => {
    setSortConfig((prev) =>
      prev && prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const countVinculos = (item: TipoEnvolvimento) => {
    const itemIdNorm = normalizeSearchStr(item.id);
    const itemNomeNorm = normalizeSearchStr(item.nome);
    return state.envolvidos.filter((e) => {
      const envTipoNorm = normalizeSearchStr(e.tipoEnvolvimento);
      return envTipoNorm === itemIdNorm || envTipoNorm === itemNomeNorm;
    }).length;
  };

  const filteredTipos = useMemo(() => {
    const sNorm = normalizeSearchStr(searchTerm);
    return state.tipoEnvolvimentos.filter((t) => {
      if (!sNorm) return true;
      return normalizeSearchStr(t.nome).includes(sNorm) || normalizeSearchStr(t.id).includes(sNorm);
    });
  }, [state.tipoEnvolvimentos, searchTerm]);

  const sortedTipos = useMemo(() => {
    if (!sortConfig) return filteredTipos;
    return [...filteredTipos].sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';
      switch (sortConfig.key) {
        case 'id':
          aVal = a.id || '';
          bVal = b.id || '';
          break;
        case 'nome':
          aVal = a.nome || '';
          bVal = b.nome || '';
          break;
        case 'tipo':
          aVal = a.id === 'apelante' || a.id === 'apelado' ? 'Padrão' : 'Personalizado';
          bVal = b.id === 'apelante' || b.id === 'apelado' ? 'Padrão' : 'Personalizado';
          break;
        case 'vinculos':
          aVal = countVinculos(a);
          bVal = countVinculos(b);
          break;
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const strA = normalizeSearchStr(aVal);
      const strB = normalizeSearchStr(bVal);
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTipos, sortConfig, state.envolvidos]);

  const itemsPerPage = state.settings.itemsPerPage || 10;
  const totalPages = Math.ceil(sortedTipos.length / itemsPerPage);

  const paginatedTipos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedTipos.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedTipos, currentPage, itemsPerPage]);

  const handleOpenModal = (item?: TipoEnvolvimento) => {
    setFormError(null);
    if (item) {
      setEditingItem(item);
      setNomeInput(item.nome || '');
    } else {
      setEditingItem(null);
      setNomeInput('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const clean = nomeInput.trim();
    if (!clean) {
      setFormError('Informe o nome do tipo de relacionamento.');
      return;
    }

    const duplicate = state.tipoEnvolvimentos.some(
      (t) => t.id !== editingItem?.id && (t.nome || '').trim().toLowerCase() === clean.toLowerCase()
    );
    if (duplicate) {
      setFormError('Já existe um tipo de relacionamento cadastrado com esse nome.');
      return;
    }

    if (editingItem) {
      updateTipoEnvolvimento({
        ...editingItem,
        nome: clean,
      });
    } else {
      const slug = clean
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      const id =
        slug && !state.tipoEnvolvimentos.some((t) => t.id === slug)
          ? slug
          : `tipo_${Date.now()}`;

      addTipoEnvolvimento({
        id,
        nome: clean,
      });
    }

    setIsModalOpen(false);
    setNomeInput('');
    setEditingItem(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    deleteTipoEnvolvimento(deletingItem.id);
    setDeletingItem(null);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 w-full h-full flex flex-col space-y-3 sm:space-y-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-app-text flex items-center uppercase">
            <Network className="mr-3 text-primary shrink-0" />
            <span className="truncate">Relacionamento (Tipos de Envolvimento)</span>
          </h1>
          <p className="text-app-text-muted text-xs sm:text-sm mt-0.5 truncate">
            Tabela Supabase: <code className="font-mono text-xs">public.envolvidos_tipo</code>
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm shrink-0"
          >
            <Plus size={20} className="mr-2" />
            Novo Relacionamento
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-3 sm:p-4 border-b border-app-border flex flex-col sm:flex-row gap-3 sm:items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <button
              onClick={() => setIsColumnModalOpen(true)}
              className="p-2 border border-app-border rounded-lg text-app-text-muted hover:text-primary hover:border-primary transition-all bg-app-secondary flex items-center justify-center shadow-sm shrink-0"
              title="Configurar Colunas"
            >
              <Settings2 size={20} />
            </button>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
              <input
                type="text"
                placeholder="Buscar tipo de relacionamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-app-secondary text-app-text placeholder-app-text-muted"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-app-text-muted hover:text-app-text transition-colors"
                  title="Limpar busca"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          <span className="text-xs text-app-text-muted font-semibold whitespace-nowrap bg-app-secondary px-2.5 py-1.5 rounded-md border border-app-border self-start sm:self-auto">
            {sortedTipos.length} {sortedTipos.length === 1 ? 'registro encontrado' : 'registros encontrados'}
          </span>
        </div>

        <div className="overflow-auto flex-1 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-left border-collapse min-w-full">
              <thead className="sticky top-0 z-20 bg-app-surface shadow-sm">
                <tr className="bg-app-secondary text-app-text-muted text-sm uppercase tracking-wider">
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {columnOrder.map((colId) => (
                      <SortableTableHeader
                        key={colId}
                        id={colId}
                        label={RELACIONAMENTO_COLUMN_LABELS[colId] || colId}
                        onSort={handleSort}
                        sortConfig={sortConfig}
                        align={colId === 'vinculos' ? 'center' : 'left'}
                      />
                    ))}
                  </SortableContext>
                  <th className="px-4 py-3 font-medium text-right sticky right-0 z-20 bg-app-secondary shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {paginatedTipos.map((item) => {
                  const isDefault = item.id === 'apelante' || item.id === 'apelado';
                  const vinculosCount = countVinculos(item);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (window.innerWidth < 1024 && canWrite) {
                          handleOpenModal(item);
                        }
                      }}
                      className="hover:bg-app-secondary transition-colors group cursor-pointer lg:cursor-default"
                    >
                      {columnOrder.map((colId) => {
                        switch (colId) {
                          case 'nome':
                            return (
                              <td key={colId} className="px-4 py-3 font-medium text-app-text">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Network size={16} />
                                  </div>
                                  <span
                                    className={canWrite ? 'cursor-pointer hover:text-primary hover:underline transition-colors' : ''}
                                    onClick={(e) => {
                                      if (canWrite) {
                                        e.stopPropagation();
                                        handleOpenModal(item);
                                      }
                                    }}
                                  >
                                    {item.nome}
                                  </span>
                                </div>
                              </td>
                            );
                          case 'id':
                            return (
                              <td key={colId} className="px-4 py-3 font-mono text-xs text-app-text-muted whitespace-nowrap">
                                {item.id}
                              </td>
                            );
                          case 'tipo':
                            return (
                              <td key={colId} className="px-4 py-3 whitespace-nowrap">
                                {isDefault ? (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                                    <ShieldCheck size={12} /> Padrão
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-app-secondary text-app-text-muted border border-app-border font-medium">
                                    Personalizado
                                  </span>
                                )}
                              </td>
                            );
                          case 'vinculos':
                            return (
                              <td key={colId} className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full bg-primary/10 text-primary min-w-8">
                                  {vinculosCount}
                                </span>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}

                      <td className="px-4 py-3 text-right sticky right-0 z-10 bg-app-surface group-hover:bg-app-secondary transition-colors shadow-[-4px_0_8px_rgba(0,0,0,0.05)] hidden sm:table-cell">
                        <div className="flex items-center justify-end space-x-1">
                          {canWrite && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(item);
                              }}
                              className="p-2 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {canDelete && !isDefault && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingItem(item);
                              }}
                              className="p-2 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedTipos.length === 0 && (
                  <tr>
                    <td colSpan={columnOrder.length + 1} className="p-8 text-center text-app-text-muted">
                      Nenhum relacionamento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DndContext>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedTipos.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          label="relacionamentos"
        />
      </div>

      <ColumnConfigModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columnLabels={RELACIONAMENTO_COLUMN_LABELS}
        columnOrder={columnOrder}
        onToggleColumn={toggleColumn}
        onResetColumns={resetColumns}
        entityName="relacionamentos"
      />

      <ConfirmDeleteModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Relacionamento"
        description={
          <>
            Tem certeza que deseja excluir <strong className="text-app-text">{deletingItem?.nome}</strong> da tabela{' '}
            <code className="font-mono">public.envolvidos_tipo</code>?
          </>
        }
      />

      {/* Modal Criar / Editar */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-app-border">
                <h2 className="text-lg font-bold text-app-text flex items-center gap-2">
                  <Network className="text-primary" size={20} />
                  {editingItem ? 'Editar Relacionamento' : 'Novo Relacionamento'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-app-text-muted hover:text-app-text transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-app-text">Nome do Tipo de Envolvimento</label>
                  <input
                    type="text"
                    autoFocus
                    required
                    maxLength={60}
                    value={nomeInput}
                    onChange={(e) => {
                      setNomeInput(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    className="w-full px-3.5 py-2.5 bg-app-bg border border-app-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-app-text text-sm"
                    placeholder="Ex: Autor, Réu, Exequente, Testemunha..."
                  />
                </div>

                {formError && (
                  <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                    {formError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-app-border rounded-xl text-app-text hover:bg-app-bg transition-colors font-medium text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm font-medium text-sm"
                  >
                    {editingItem ? 'Salvar Alterações' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Relacionamento;
