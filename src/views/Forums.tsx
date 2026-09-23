import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import { Landmark, Search, MapPin, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import Modal from '../components/Modal';
import { Forum } from '../types';

export default function Forums() {
  const { state, addForum, updateForum, deleteForum, escritorioAtivoId, isAdmin, currentUser, hasPermission } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingForum, setEditingForum] = useState<Forum | null>(null);

  const canWrite = hasPermission('forums', 'write');
  const canDelete = hasPermission('forums', 'delete');
  const [formData, setFormData] = useState({
    id: '',
    nome: '',
    endereco: '',
    tribunalId: '',
  });

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredForums = state.forums.filter(f => {
    const isGlobal = !f.escritorioId || f.escritorioId.toLowerCase() === 'x' || f.escritorioId.trim() === '';
    if (escritorioAtivoId && f.escritorioId && f.escritorioId.trim() !== '' && f.escritorioId !== escritorioAtivoId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && f.escritorioId && !(currentUser?.escritoriosIds || []).includes(f.escritorioId)) return false;
    
    const searchLower = searchTerm.toLowerCase();
    const tribunal = state.tribunais.find(t => t.id === f.tribunalId);
    return f.nome.toLowerCase().includes(searchLower) || 
           f.endereco.toLowerCase().includes(searchLower) ||
           (tribunal && tribunal.nome.toLowerCase().includes(searchLower));
  });

  const itemsPerPage = state.settings.itemsPerPage || 10;
  const totalPages = Math.ceil(filteredForums.length / itemsPerPage);
  
  const paginatedForums = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredForums.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredForums, currentPage, itemsPerPage]);

  const handleOpenModal = (forum?: Forum) => {
    if (forum) {
      setEditingForum(forum);
      setFormData({
        id: forum.id,
        nome: forum.nome,
        endereco: forum.endereco,
        tribunalId: forum.tribunalId,
      });
    } else {
      setEditingForum(null);
      setFormData({
        id: '',
        nome: '',
        endereco: '',
        tribunalId: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.id) return;

    if (editingForum) {
      updateForum({
        ...editingForum,
        ...formData,
      });
    } else {
      addForum({
        ...formData,
        escritorioId: escritorioAtivoId || ''
      });
    }

    setIsModalOpen(false);
    setEditingForum(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este fórum?')) {
      deleteForum(id);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <Landmark className="mr-3 text-primary" />
          Fóruns
        </h1>
        {canWrite && (
          <button 
            onClick={() => handleOpenModal()}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Fórum
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="p-4 border-b border-app-border flex items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, endereço ou tribunal..." 
              className="w-full pl-10 pr-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-app-surface text-app-text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-app-bg/50 border-b border-app-border">
                <th className="p-2 sm:p-4 font-semibold text-app-text text-sm w-12 hidden sm:table-cell">Ic.</th>
                <th className="p-2 sm:p-4 font-semibold text-app-text text-sm">Nome do Fórum</th>
                <th className="p-2 sm:p-4 font-semibold text-app-text text-sm hidden sm:table-cell">Tribunal Vinculado</th>
                <th className="p-2 sm:p-4 font-semibold text-app-text text-sm md:w-1/3 hidden md:table-cell">Endereço</th>
                <th className="p-2 sm:p-4 font-semibold text-app-text text-sm text-right hidden sm:table-cell">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {paginatedForums.map((forum, index) => {
                const tribunal = state.tribunais.find(t => t.id === forum.tribunalId);
                return (
                  <tr 
                    key={`${forum.id}-${index}`} 
                    className={`hover:bg-app-secondary/30 transition-colors group ${canWrite ? 'cursor-pointer' : ''}`}
                    onClick={() => canWrite && handleOpenModal(forum)}
                  >
                    <td className="p-2 sm:p-4 align-top hidden sm:table-cell">
                      <div className="p-2 bg-primary/10 text-primary rounded-lg inline-block">
                        <Landmark size={20} />
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 align-top">
                      <div className="font-medium text-app-text">{forum.nome}</div>
                      {tribunal && (
                        <div className="sm:hidden mt-1">
                          <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded">
                            {tribunal.sigla || tribunal.id}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-2 sm:p-4 align-top hidden sm:table-cell">
                      {tribunal ? (
                        <span className="text-xs font-bold text-primary uppercase bg-primary/10 px-2 py-1 rounded" title={tribunal.nome}>
                          {tribunal.sigla || tribunal.id}
                        </span>
                      ) : (
                        <span className="text-app-text-muted text-sm">-</span>
                      )}
                    </td>
                    <td className="p-2 sm:p-4 align-top hidden md:table-cell">
                      {forum.endereco ? (
                        <div className="flex items-start text-sm text-app-text-muted">
                          <MapPin size={16} className="mr-2 text-app-text-muted shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{forum.endereco}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-app-text-muted italic">Não informado</span>
                      )}
                    </td>
                    <td className="p-2 sm:p-4 align-top text-right hidden sm:table-cell">
                      <div className="flex items-center justify-end space-x-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {canWrite && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenModal(forum); }}
                            className="p-2 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors shadow-sm"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(forum.id); }}
                            className="p-2 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shadow-sm"
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
              
              {filteredForums.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-app-text-muted italic">
                    Nenhum fórum encontrado.
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
              Mostrando <span className="font-medium text-app-text">{Math.min(filteredForums.length, (currentPage - 1) * itemsPerPage + 1)}</span> a <span className="font-medium text-app-text">{Math.min(filteredForums.length, currentPage * itemsPerPage)}</span> de <span className="font-medium text-app-text">{filteredForums.length}</span> fóruns
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
                {currentPage > 3 && totalPages > 5 && (
                  <>
                    <button
                      onClick={() => setCurrentPage(1)}
                      className="w-10 h-10 rounded-lg text-sm font-medium transition-all hover:bg-app-surface border border-transparent hover:border-app-border text-app-text-muted"
                    >
                      1
                    </button>
                    <span className="text-app-text-muted px-1 text-xs">...</span>
                  </>
                )}
                
                {(() => {
                  const pages = [];
                  const maxButtons = 5;
                  let start = Math.max(1, currentPage - 2);
                  let end = Math.min(totalPages, start + maxButtons - 1);
                  
                  if (end === totalPages) {
                    start = Math.max(1, end - maxButtons + 1);
                  }
                  
                  for (let i = start; i <= end; i++) {
                    pages.push(i);
                  }
                  
                  return pages.map(page => (
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
                  ));
                })()}

                {currentPage < totalPages - 2 && totalPages > 5 && (
                  <>
                    <span className="text-app-text-muted px-1 text-xs">...</span>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className="w-10 h-10 rounded-lg text-sm font-medium transition-all hover:bg-app-surface border border-transparent hover:border-app-border text-app-text-muted"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
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
        onClose={() => {
          setIsModalOpen(false);
          setEditingForum(null);
        }} 
        title={editingForum ? "Editar Fórum" : "Novo Fórum"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">ID do Fórum (ID_FORUM) *</label>
            <input 
              type="text" 
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
              placeholder="Ex: FORUM_CENTRAL"
              value={formData.id}
              onChange={e => setFormData({...formData, id: e.target.value.toUpperCase()})}
              disabled={!!editingForum}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Nome do Fórum (NOME_FORUM) *</label>
            <input 
              type="text" 
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
              placeholder="Ex: Fórum Central"
              value={formData.nome}
              onChange={e => setFormData({...formData, nome: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Sigla do Tribunal (ID_TJ) *</label>
            <select 
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text font-semibold"
              value={formData.tribunalId}
              onChange={e => setFormData({...formData, tribunalId: e.target.value})}
            >
              <option value="">Selecione um tribunal...</option>
              {state.tribunais.map(t => (
                <option key={t.id} value={t.id}>{t.sigla || t.id} - {t.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Endereço (ENDERECO)</label>
            <textarea 
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text min-h-[100px]"
              placeholder="Endereço completo..."
              value={formData.endereco}
              onChange={e => setFormData({...formData, endereco: e.target.value})}
            />
          </div>
          <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
            <button 
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingForum(null);
              }}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              {editingForum ? "Atualizar Fórum" : "Salvar Fórum"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
