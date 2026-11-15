import React, { useState } from 'react';
import { Network, Plus, Pencil, Trash2, X, Search, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../context';
import { TipoEnvolvimento } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const Relacionamento: React.FC = () => {
  const {
    state,
    addTipoEnvolvimento,
    updateTipoEnvolvimento,
    deleteTipoEnvolvimento,
    hasPermission,
    isAdmin
  } = useAppContext();

  const canWrite = isAdmin() || hasPermission('relacionamento', 'write') || hasPermission('processos', 'write');
  const canDelete = isAdmin() || hasPermission('relacionamento', 'delete') || hasPermission('processos', 'delete');

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TipoEnvolvimento | null>(null);
  const [deletingItem, setDeletingItem] = useState<TipoEnvolvimento | null>(null);
  const [nomeInput, setNomeInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredTipos = [...state.tipoEnvolvimentos]
    .filter(t => t.nome.toLowerCase().includes(searchTerm.toLowerCase()) || t.id.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

  const handleOpenModal = (item?: TipoEnvolvimento) => {
    setFormError(null);
    if (item) {
      setEditingItem(item);
      setNomeInput(item.nome);
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
      t => t.id !== editingItem?.id && t.nome.trim().toLowerCase() === clean.toLowerCase()
    );
    if (duplicate) {
      setFormError('Já existe um tipo de relacionamento cadastrado com esse nome.');
      return;
    }

    if (editingItem) {
      updateTipoEnvolvimento({
        ...editingItem,
        nome: clean
      });
    } else {
      const slug = clean
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      const id = slug && !state.tipoEnvolvimentos.some(t => t.id === slug)
        ? slug
        : `tipo_${Date.now()}`;

      addTipoEnvolvimento({
        id,
        nome: clean
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text flex items-center gap-2">
            <Network className="text-primary" />
            Relacionamento (Tipos de Envolvimento)
          </h1>
          <p className="text-app-text-muted text-sm mt-0.5">
            Gerencie os tipos de envolvimento das partes em processos e recursos (tabela Supabase: <code className="font-mono text-xs">public.envolvidos_tipo</code>).
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-all shadow-sm font-medium w-full md:w-auto"
          >
            <Plus size={18} />
            Novo Relacionamento
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-app-border bg-app-bg/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
            <input
              type="text"
              placeholder="Buscar tipo de relacionamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-app-surface border border-app-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-app-text text-sm"
            />
          </div>
          <span className="text-xs font-semibold text-app-text-muted shrink-0">
            {filteredTipos.length} {filteredTipos.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div className="p-4">
          {filteredTipos.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-app-bg w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Network size={32} className="text-app-text-muted" />
              </div>
              <h3 className="text-lg font-medium text-app-text">Nenhum relacionamento encontrado</h3>
              <p className="text-app-text-muted text-sm">
                Cadastre tipos como Autor, Réu, Exequente, Executado ou Terceiro Interessado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredTipos.map((item) => {
                  const isDefault = item.id === 'apelante' || item.id === 'apelado';
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="p-4 rounded-xl border border-app-border bg-app-surface shadow-sm hover:shadow-md transition-all group border-l-4 border-l-primary"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Network size={18} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-app-text truncate">{item.nome}</span>
                              {isDefault && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                                  <ShieldCheck size={10} /> Padrão
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-app-text-muted truncate mt-0.5">
                              ID: {item.id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                          {canWrite && (
                            <button
                              onClick={() => handleOpenModal(item)}
                              className="p-1.5 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {canDelete && !isDefault && (
                            <button
                              onClick={() => setDeletingItem(item)}
                              className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

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

      {/* Modal Confirmar Exclusão */}
      <AnimatePresence>
        {deletingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingItem(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-app-text">Excluir Relacionamento</h3>
              <p className="text-xs text-app-text-muted leading-relaxed">
                Tem certeza que deseja excluir <strong className="text-app-text">{deletingItem.nome}</strong> da tabela <code className="font-mono">public.envolvidos_tipo</code>?
              </p>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  className="flex-1 px-4 py-2 border border-app-border rounded-xl text-app-text hover:bg-app-bg transition-colors text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors text-xs font-semibold"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Relacionamento;
