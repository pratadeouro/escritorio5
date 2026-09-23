import React, { useState } from 'react';
import { Tag, Plus, Pencil, Trash2, X, Check, Search, Palette } from 'lucide-react';
import { useAppContext } from '../context';
import { Etiqueta } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const Etiquetas: React.FC = () => {
  const { state, addEtiqueta, updateEtiqueta, deleteEtiqueta, escritorioAtivoId, hasPermission, isAdmin } = useAppContext();
  const canWrite = hasPermission('etiquetas', 'write');
  const canDelete = hasPermission('etiquetas', 'delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEtiqueta, setEditingEtiqueta] = useState<Etiqueta | null>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    cor: '#3b82f6',
    escritorioId: 'X'
  });

  const filteredEtiquetas = state.etiquetas.filter(e => 
    e.nome.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (e.escritorioId === escritorioAtivoId || e.escritorioId?.toLowerCase() === 'x')
  );

  const handleOpenModal = (etiqueta?: Etiqueta) => {
    if (etiqueta) {
      setEditingEtiqueta(etiqueta);
      setFormData({
        nome: etiqueta.nome,
        cor: etiqueta.cor || '#3b82f6',
        escritorioId: etiqueta.escritorioId || 'X'
      });
    } else {
      setEditingEtiqueta(null);
      setFormData({
        nome: '',
        cor: '#3b82f6',
        escritorioId: escritorioAtivoId || 'X'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) return;

    if (editingEtiqueta) {
      updateEtiqueta({
        ...editingEtiqueta,
        nome: formData.nome,
        cor: formData.cor,
        escritorioId: isAdmin() ? formData.escritorioId : (editingEtiqueta.escritorioId || 'X')
      });
    } else {
      addEtiqueta({
        id: crypto.randomUUID(),
        nome: formData.nome,
        cor: formData.cor,
        escritorioId: isAdmin() ? formData.escritorioId : (escritorioAtivoId || 'X')
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta etiqueta?')) {
      deleteEtiqueta(id);
    }
  };

  const predefinedColors = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', 
    '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e',
    '#71717a', '#000000'
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text flex items-center gap-2">
            <Tag className="text-primary" />
            Etiquetas
          </h1>
          <p className="text-app-text-muted">Gerencie as etiquetas para categorizar seus processos e tarefas.</p>
        </div>
        {canWrite && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-all shadow-sm font-medium w-full md:w-auto"
          >
            <Plus size={20} />
            Nova Etiqueta
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-xl border border-app-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-app-border bg-app-bg/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
            <input
              type="text"
              placeholder="Buscar etiquetas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-app-surface border border-app-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-app-text"
            />
          </div>
        </div>

        <div className="p-4">
          {filteredEtiquetas.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-app-bg w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag size={32} className="text-app-text-muted" />
              </div>
              <h3 className="text-lg font-medium text-app-text">Nenhuma etiqueta encontrada</h3>
              <p className="text-app-text-muted">Crie sua primeira etiqueta para começar a organizar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode='popLayout'>
                {filteredEtiquetas.map((etiqueta) => (
                  <motion.div
                    key={etiqueta.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="p-4 rounded-xl border border-app-border bg-app-surface shadow-sm hover:shadow-md transition-all group relative border-l-4"
                    style={{ borderLeftColor: etiqueta.cor }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: etiqueta.cor }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-app-text truncate">{etiqueta.nome}</span>
                          <span className="text-[10px] text-app-text-muted mt-0.5">
                            {etiqueta.escritorioId?.toUpperCase() === 'X' 
                              ? 'Global' 
                              : state.escritorios.find(esc => esc.id === etiqueta.escritorioId)?.nome || 'Específico'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canWrite && (
                          <button
                            onClick={() => handleOpenModal(etiqueta)}
                            className="p-1.5 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(etiqueta.id)}
                            className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Create/Edit */}
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-app-border">
                <h2 className="text-xl font-bold text-app-text flex items-center gap-2">
                  <Palette className="text-primary" />
                  {editingEtiqueta ? 'Editar Etiqueta' : 'Nova Etiqueta'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-app-text-muted hover:text-app-text transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-app-text">Nome da Etiqueta</label>
                  <input
                    type="text"
                    autoFocus
                    required
                    maxLength={30}
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-4 py-2 bg-app-bg border border-app-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-app-text"
                    placeholder="Ex: Urgente, Civil, Criminal..."
                  />
                </div>

                {isAdmin() && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-app-text">Escritório Associado</label>
                    <select
                      value={formData.escritorioId}
                      onChange={(e) => setFormData({ ...formData, escritorioId: e.target.value })}
                      className="w-full px-4 py-2 bg-app-bg border border-app-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-app-text"
                    >
                      <option value="X">Global (Disponível para todos os escritórios)</option>
                      {state.escritorios.map((esc) => (
                        <option key={esc.id} value={esc.id}>
                          {esc.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-app-text">Cor da Etiqueta</label>
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm transition-all"
                      style={{ backgroundColor: formData.cor }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-6 gap-3">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, cor: color })}
                        className={`w-full aspect-square rounded-full transition-all flex items-center justify-center hover:scale-110 shadow-sm ${
                          formData.cor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-app-surface' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {formData.cor === color && <Check size={14} className="text-white drop-shadow-md" />}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="color"
                      value={formData.cor}
                      onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer bg-transparent"
                    />
                    <span className="text-sm text-app-text-muted font-mono uppercase">{formData.cor}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-app-border rounded-lg text-app-text hover:bg-app-bg transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors shadow-sm font-medium"
                  >
                    {editingEtiqueta ? 'Salvar' : 'Criar'}
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

export default Etiquetas;
