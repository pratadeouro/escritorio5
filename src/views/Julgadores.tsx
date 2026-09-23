import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context';
import { Gavel, Search, MapPin, ChevronLeft, ChevronRight, Plus, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';

export default function Julgadores() {
  const { state, escritorioAtivoId, isAdmin, currentUser, hasPermission, addJulgador, updateJulgador, deleteJulgador } = useAppContext();
  const canWrite = hasPermission('julgadores', 'write');
  const canDelete = hasPermission('julgadores', 'delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJulgador, setEditingJulgador] = useState<any>(null);
  const [formData, setFormData] = useState({
    nome: '',
    escritorioId: escritorioAtivoId || 'x'
  });

  // Reset to first page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleOpenModal = (julgador?: any) => {
    if (julgador) {
      setEditingJulgador(julgador);
      setFormData({
        nome: julgador.nome,
        escritorioId: julgador.escritorioId || 'x'
      });
    } else {
      setEditingJulgador(null);
      setFormData({
        nome: '',
        escritorioId: escritorioAtivoId || 'x'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return;

    if (editingJulgador) {
      updateJulgador({
        ...editingJulgador,
        nome: formData.nome
      });
    } else {
      addJulgador({
        id: Math.random().toString(36).substr(2, 9),
        nome: formData.nome,
        escritorioId: formData.escritorioId
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este julgador?')) {
      deleteJulgador(id);
    }
  };

  const filteredJulgadores = state.julgadores.filter(j => {
    const isGlobal = !j.escritorioId || j.escritorioId.toLowerCase() === 'x' || j.escritorioId.trim() === '';
    if (escritorioAtivoId && j.escritorioId && j.escritorioId.trim() !== '' && j.escritorioId !== escritorioAtivoId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && j.escritorioId && !(currentUser?.escritoriosIds || []).includes(j.escritorioId)) return false;
    
    const varasDoJuiz = state.varas.filter(v => v.juiz === j.id || v.juiz_2 === j.id);
    const searchLower = searchTerm.toLowerCase();
    
    const matchNome = j.nome.toLowerCase().includes(searchLower);
    const matchVaras = varasDoJuiz.some(v => {
      const forum = state.forums.find(f => f.id === v.forum);
      return v.nome.toLowerCase().includes(searchLower) || (forum?.nome.toLowerCase().includes(searchLower));
    });

    return matchNome || matchVaras;
  });

  const itemsPerPage = state.settings.itemsPerPage || 10;
  const totalPages = Math.ceil(filteredJulgadores.length / itemsPerPage);
  
  const paginatedJulgadores = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredJulgadores.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredJulgadores, currentPage, itemsPerPage]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <Gavel className="mr-3 text-primary" />
          Julgadores
        </h1>
        {canWrite && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Julgador
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="p-4 border-b border-app-border flex items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, vara ou fórum..." 
              className="w-full pl-10 pr-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-app-surface text-app-text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-app-bg text-app-text-muted text-sm uppercase tracking-wider">
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Varas / Fóruns Associados</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {paginatedJulgadores.map((julgador, idx) => {
                const varasDoJuiz = state.varas.filter(v => v.juiz === julgador.id || v.juiz_2 === julgador.id);
                const isGlobal = julgador.escritorioId?.toLowerCase() === 'x';
                
                return (
                  <tr key={julgador.id || idx} className={`hover:bg-app-secondary/50 transition-colors group ${isGlobal ? 'bg-primary/5' : ''}`}>
                    <td className="p-4 align-top">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {julgador.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-medium text-app-text flex items-center gap-2">
                          {julgador.nome}
                          {isGlobal && (
                            <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                              Geral
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-3">
                        {varasDoJuiz.length > 0 ? (
                          varasDoJuiz.map(vara => {
                            const forum = state.forums.find(f => f.id === vara.forum);
                            const isTitular = vara.juiz === julgador.id;
                            return (
                              <div key={vara.id} className="flex flex-col text-sm border-l-2 border-primary/20 pl-3 py-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-app-text">{vara.nome}</span>
                                  {!isTitular && (
                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                                      Acumulando
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-app-text-muted">{forum?.nome || 'Fórum não identificado'}</span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-app-text-muted italic text-sm">Nenhuma vara associada</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {canWrite && (
                          <button 
                            onClick={() => handleOpenModal(julgador)}
                            className="p-2 text-app-text-muted hover:text-primary transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(julgador.id)}
                            className="p-2 text-app-text-muted hover:text-red-500 transition-colors"
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
              {filteredJulgadores.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-app-text-muted">
                    Nenhum julgador encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-app-border flex items-center justify-between bg-app-bg/30">
            <div className="text-sm text-app-text-muted">
              Mostrando <span className="font-medium text-app-text">{Math.min(filteredJulgadores.length, (currentPage - 1) * itemsPerPage + 1)}</span> a <span className="font-medium text-app-text">{Math.min(filteredJulgadores.length, currentPage * itemsPerPage)}</span> de <span className="font-medium text-app-text">{filteredJulgadores.length}</span> julgadores
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-app-border rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Página Anterior"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                      currentPage === page 
                      ? 'bg-primary text-white shadow-sm' 
                      : 'hover:bg-app-surface border border-transparent hover:border-app-border text-app-text-muted'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-app-border rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Próxima Página"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingJulgador ? "Editar Julgador" : "Novo Julgador"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-app-text">Nome do Julgador</label>
            <input 
              type="text"
              required
              className="w-full px-4 py-2 bg-app-bg border border-app-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-app-text"
              value={formData.nome || ''}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              placeholder="Ex: Dr. Carlos Gomes"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-app-text-muted hover:text-app-text transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium shadow-sm"
            >
              {editingJulgador ? 'Salvar Alterações' : 'Adicionar Julgador'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
