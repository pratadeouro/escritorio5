import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import { Landmark, Search, MapPin, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import Modal from '../components/Modal';
import { Tribunal } from '../types';

export default function Tribunais() {
  const { state, addTribunal, updateTribunal, deleteTribunal, escritorioAtivoId, isAdmin, currentUser, hasPermission } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingTribunal, setEditingTribunal] = useState<Tribunal | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [viewTab, setViewTab] = useState<'varas' | 'processos'>('varas');

  useEffect(() => {
    if (!isModalOpen) {
      setViewTab('varas');
    }
  }, [isModalOpen]);

  const canRead = hasPermission('tribunais', 'read');
  const canWrite = hasPermission('tribunais', 'write');
  const canDelete = hasPermission('tribunais', 'delete');
  const [formData, setFormData] = useState({
    nome: '',
    id: '',
    sigla: '',
  });

  const commonTribunals = [
    { id: 'CNJ', sigla: 'CNJ', nome: 'CNJ - Conselho Nacional de Justiça' },
    { id: 'PJECOR', sigla: 'PJeCor', nome: 'PJeCor - Corregedoria Nacional de Justiça' },
    { id: 'SEEU', sigla: 'SEEU', nome: 'Sistema Eletrônico de Execução Unificado' },
    { id: 'CJF', sigla: 'CJF', nome: 'CJF - Conselho da Justiça Federal' },
    { id: 'CSJT', sigla: 'CSJT', nome: 'CSJT - Conselho Superior da Justiça do Trabalho' },
    { id: 'STF', sigla: 'STF', nome: 'STF - Supremo Tribunal Federal' },
    { id: 'STJ', sigla: 'STJ', nome: 'STJ - Superior Tribunal de Justiça' },
    { id: 'STM', sigla: 'STM', nome: 'Superior Tribunal Militar' },
    { id: 'TJAC', sigla: 'TJAC', nome: 'Tribunal de Justiça do Acre' },
    { id: 'TJAL', sigla: 'TJAL', nome: 'Tribunal de Justiça de Alagoas' },
    { id: 'TJAM', sigla: 'TJAM', nome: 'Tribunal de Justiça do Amazonas' },
    { id: 'TJAP', sigla: 'TJAP', nome: 'Tribunal de Justiça do Amapá' },
    { id: 'TJBA', sigla: 'TJBA', nome: 'Tribunal de Justiça da Bahia' },
    { id: 'TJCE', sigla: 'TJCE', nome: 'Tribunal de Justiça do Ceará' },
    { id: 'TJDFT', sigla: 'TJDFT', nome: 'Tribunal de Justiça do Distrito Federal e Territórios' },
    { id: 'TJES', sigla: 'TJES', nome: 'Tribunal de Justiça do Espírito Santo' },
    { id: 'TJGO', sigla: 'TJGO', nome: 'Tribunal de Justiça de Goiás' },
  ];

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredTribunais = state.tribunais.filter(t => {
    const searchLower = searchTerm.toLowerCase();
    return (t.nome?.toLowerCase() || '').includes(searchLower) || 
           (t.sigla?.toLowerCase() || '').includes(searchLower) ||
           (t.id?.toLowerCase() || '').includes(searchLower);
  });

  const itemsPerPage = state.settings.itemsPerPage || 10;
  const totalPages = Math.ceil(filteredTribunais.length / itemsPerPage);
  
  const paginatedTribunais = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTribunais.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTribunais, currentPage, itemsPerPage]);

  const relatedVaras = useMemo(() => {
    if (!editingTribunal) return [];
    return state.varas.filter(v => {
      if ((v.idTj || '').toString().trim().toUpperCase() !== editingTribunal.id.toUpperCase()) {
        return false;
      }
      const isGlobal = !v.escritorioId || v.escritorioId.toLowerCase() === 'x' || v.escritorioId.trim() === '';
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
      const vEscId = (v.escritorioId || '').toString().trim().toUpperCase();
      
      if (activeEscId && v.escritorioId && v.escritorioId.trim() !== '' && vEscId !== activeEscId && !isGlobal) {
        return false;
      }
      if (!isAdmin() && !isGlobal && v.escritorioId) {
        const userOffices = (currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase());
        if (!userOffices.includes(vEscId)) {
          return false;
        }
      }
      return true;
    });
  }, [state.varas, editingTribunal, escritorioAtivoId, isAdmin, currentUser]);

  const relatedProcessos = useMemo(() => {
    if (!editingTribunal) return [];
    return state.processos.filter(p => {
      const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
      const isGlobal = pEscId === 'X';
      
      if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
      if (!isAdmin() && !isGlobal) {
        const userOffices = (currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase());
        if (pEscId && !userOffices.includes(pEscId)) return false;
      }

      const tIdNormalized = editingTribunal.id.trim().toUpperCase();
      if (p.tribunalId && p.tribunalId.trim().toUpperCase() === tIdNormalized) {
        return true;
      }
      
      const pVaraId = (p.varaId || p.tribunal || '').toString().trim().toUpperCase();
      if (pVaraId) {
        const matchingVara = state.varas.find(v => 
          v.id.toUpperCase() === pVaraId || 
          v.nome.toUpperCase() === pVaraId ||
          v.id === p.varaId
        );
        if (matchingVara) {
          const vTj = (matchingVara.idTj || '').toString().trim().toUpperCase();
          if (vTj === tIdNormalized) {
            return true;
          }
        }
      }

      const pTribName = (p.tribunal || '').toString().trim().toUpperCase();
      if (pTribName === tIdNormalized || pTribName === (editingTribunal.sigla || '').trim().toUpperCase()) {
        return true;
      }
      
      return false;
    });
  }, [state.processos, state.varas, editingTribunal, escritorioAtivoId, isAdmin, currentUser]);

  const handleOpenModal = (tribunal?: Tribunal, mode: 'create' | 'edit' | 'view' = 'create') => {
    setModalMode(mode);
    if (tribunal) {
      setEditingTribunal(tribunal);
      setFormData({
        nome: tribunal.nome,
        id: tribunal.id,
        sigla: tribunal.sigla || '',
      });
    } else {
      setEditingTribunal(null);
      setFormData({
        nome: '',
        id: '',
        sigla: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.id || !formData.sigla) return;

    if (editingTribunal) {
      updateTribunal({
        ...editingTribunal,
        id: formData.id,
        sigla: formData.sigla,
        nome: formData.nome
      });
    } else {
      addTribunal({
        id: formData.id,
        sigla: formData.sigla,
        nome: formData.nome
      });
    }

    setIsModalOpen(false);
    setEditingTribunal(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este tribunal?')) {
      deleteTribunal(id);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <Landmark className="mr-3 text-primary" />
          Tribunais
        </h1>
        {canWrite && (
          <button 
            onClick={() => handleOpenModal()}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Tribunal
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
                <th className="p-2 sm:p-4 font-semibold text-app-text text-sm whitespace-nowrap">Sigla (SIGLA)</th>
                <th className="p-2 sm:p-4 font-semibold text-app-text text-sm whitespace-nowrap">ID (ID_TJ)</th>
                <th className="p-2 sm:p-4 font-semibold text-app-text text-sm">Nome do Tribunal (NOME)</th>
                <th className="p-2 sm:p-4 font-semibold text-app-text text-sm text-center">Varas</th>
                <th className="p-2 sm:p-4 font-semibold text-app-text text-sm text-center">Processos</th>
                <th className="p-2 sm:p-4 font-semibold text-app-text text-sm text-right hidden sm:table-cell">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {paginatedTribunais.map((tribunal, index) => {
                const varasCount = state.varas.filter(v => {
                  if ((v.idTj || '').toString().trim().toUpperCase() !== tribunal.id.toUpperCase()) {
                    return false;
                  }
                  const isGlobal = !v.escritorioId || v.escritorioId.toLowerCase() === 'x' || v.escritorioId.trim() === '';
                  const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
                  const vEscId = (v.escritorioId || '').toString().trim().toUpperCase();
                  
                  if (activeEscId && v.escritorioId && v.escritorioId.trim() !== '' && vEscId !== activeEscId && !isGlobal) {
                    return false;
                  }
                  if (!isAdmin() && !isGlobal && v.escritorioId) {
                    const userOffices = (currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase());
                    if (!userOffices.includes(vEscId)) {
                      return false;
                    }
                  }
                  return true;
                }).length;

                const processosCount = state.processos.filter(p => {
                  const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
                  const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
                  const isGlobal = pEscId === 'X';
                  
                  if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
                  if (!isAdmin() && !isGlobal) {
                    const userOffices = (currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase());
                    if (pEscId && !userOffices.includes(pEscId)) return false;
                  }

                  const tIdNormalized = tribunal.id.trim().toUpperCase();
                  if (p.tribunalId && p.tribunalId.trim().toUpperCase() === tIdNormalized) {
                    return true;
                  }
                  
                  const pVaraId = (p.varaId || p.tribunal || '').toString().trim().toUpperCase();
                  if (pVaraId) {
                    const matchingVara = state.varas.find(v => 
                      v.id.toUpperCase() === pVaraId || 
                      v.nome.toUpperCase() === pVaraId ||
                      v.id === p.varaId
                    );
                    if (matchingVara) {
                      const vTj = (matchingVara.idTj || '').toString().trim().toUpperCase();
                      if (vTj === tIdNormalized) {
                        return true;
                      }
                    }
                  }

                  const pTribName = (p.tribunal || '').toString().trim().toUpperCase();
                  if (pTribName === tIdNormalized || pTribName === (tribunal.sigla || '').trim().toUpperCase()) {
                    return true;
                  }
                  
                  return false;
                }).length;

                const isClickable = canWrite || canRead;

                return (
                  <tr 
                    key={`${tribunal.id}-${index}`} 
                    className={`hover:bg-app-secondary/30 transition-colors group ${isClickable ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (canWrite) {
                        handleOpenModal(tribunal, 'edit');
                      } else if (canRead) {
                        handleOpenModal(tribunal, 'view');
                      }
                    }}
                  >
                    <td className="p-2 sm:p-4 align-middle hidden sm:table-cell">
                      <div className="p-2 bg-primary/10 text-primary rounded-lg inline-block">
                        <Landmark size={20} />
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 align-middle">
                      <span className="text-xs font-bold text-primary uppercase bg-primary/10 px-2 py-1 rounded">
                        {tribunal.sigla}
                      </span>
                    </td>
                    <td className="p-2 sm:p-4 align-middle">
                      <span className="text-xs font-bold text-app-text-muted uppercase">
                        {tribunal.id}
                      </span>
                    </td>
                    <td className="p-2 sm:p-4 align-middle">
                      <div className="font-medium text-app-text">{tribunal.nome}</div>
                    </td>
                    <td className="p-2 sm:p-4 align-middle text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full bg-app-bg text-app-text border border-app-border min-w-8">
                        {varasCount}
                      </span>
                    </td>
                    <td className="p-2 sm:p-4 align-middle text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full bg-app-bg text-app-text border border-app-border min-w-8">
                        {processosCount}
                      </span>
                    </td>
                    <td className="p-2 sm:p-4 align-middle text-right hidden sm:table-cell">
                      <div className="flex items-center justify-end space-x-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {canRead && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenModal(tribunal, 'view'); }}
                            className="p-2 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors shadow-sm"
                            title="Visualizar"
                          >
                            <Eye size={18} />
                          </button>
                        )}
                        {canWrite && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenModal(tribunal, 'edit'); }}
                            className="p-2 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors shadow-sm"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(tribunal.id); }}
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
              
              {filteredTribunais.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-app-text-muted italic">
                    Nenhum tribunal encontrado.
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
              Mostrando <span className="font-medium text-app-text">{Math.min(filteredTribunais.length, (currentPage - 1) * itemsPerPage + 1)}</span> a <span className="font-medium text-app-text">{Math.min(filteredTribunais.length, currentPage * itemsPerPage)}</span> de <span className="font-medium text-app-text">{filteredTribunais.length}</span> tribunais
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
          setEditingTribunal(null);
        }} 
        title={
          modalMode === 'view' ? "Visualizar Tribunal" :
          editingTribunal ? "Editar Tribunal" : 
          "Novo Tribunal"
        }
      >
        {modalMode === 'view' ? (
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            {/* Tribunal General Info Card */}
            <div className="bg-app-bg/50 border border-app-border rounded-xl p-4 space-y-3">
              <div>
                <h3 className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Nome do Tribunal (NOME)</h3>
                <p className="text-base font-semibold text-app-text mt-0.5">{editingTribunal?.nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Sigla (SIGLA)</h3>
                  <p className="text-sm font-semibold text-primary mt-0.5 bg-primary/10 px-2.5 py-1 rounded-lg inline-block">{editingTribunal?.sigla}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-app-text-muted uppercase tracking-wider">ID (ID_TJ)</h3>
                  <p className="text-sm font-mono font-semibold text-app-text mt-0.5">{editingTribunal?.id}</p>
                </div>
              </div>
            </div>

            {/* Tabs Header */}
            <div className="flex border-b border-app-border">
              <button
                type="button"
                onClick={() => setViewTab('varas')}
                className={`flex-1 py-2.5 text-center font-semibold text-sm border-b-2 transition-all flex items-center justify-center gap-2 ${
                  viewTab === 'varas'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-app-text-muted hover:text-app-text hover:bg-app-bg/30'
                }`}
              >
                Varas Relacionadas
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                  viewTab === 'varas' ? 'bg-primary/20 text-primary' : 'bg-app-bg text-app-text-muted border border-app-border'
                }`}>
                  {relatedVaras.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewTab('processos')}
                className={`flex-1 py-2.5 text-center font-semibold text-sm border-b-2 transition-all flex items-center justify-center gap-2 ${
                  viewTab === 'processos'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-app-text-muted hover:text-app-text hover:bg-app-bg/30'
                }`}
              >
                Processos Relacionados
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                  viewTab === 'processos' ? 'bg-primary/20 text-primary' : 'bg-app-bg text-app-text-muted border border-app-border'
                }`}>
                  {relatedProcessos.length}
                </span>
              </button>
            </div>

            {/* Tabs Content */}
            <div className="space-y-3 min-h-[200px]">
              {viewTab === 'varas' ? (
                relatedVaras.length === 0 ? (
                  <div className="text-center py-12 text-app-text-muted italic bg-app-bg/20 rounded-xl border border-app-border border-dashed">
                    Nenhuma vara relacionada encontrada para este tribunal.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                    {relatedVaras.map((v, i) => (
                      <div key={v.id || i} className="bg-app-bg/30 border border-app-border hover:border-primary/50 transition-colors p-3.5 rounded-xl space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-sm text-app-text">{v.nome}</h4>
                          <span className="text-[10px] bg-app-bg border border-app-border text-app-text-muted font-bold px-1.5 py-0.5 rounded">
                            {v.id}
                          </span>
                        </div>
                        
                        {(v.juiz || v.juiz_2 || v.telefone || v.email) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-app-text-muted pt-1 border-t border-app-border/40">
                            {v.juiz && (
                              <div>
                                <span className="font-medium text-app-text-muted">Juiz Titular:</span>{' '}
                                <span className="text-app-text font-medium">{v.juiz}</span>
                              </div>
                            )}
                            {v.juiz_2 && (
                              <div>
                                <span className="font-medium text-app-text-muted">Juiz Auxiliar:</span>{' '}
                                <span className="text-app-text font-medium">{v.juiz_2}</span>
                              </div>
                            )}
                            {v.email && (
                              <div className="truncate" title={v.email}>
                                <span className="font-medium text-app-text-muted">E-mail:</span>{' '}
                                <span className="text-app-text font-medium">{v.email}</span>
                              </div>
                            )}
                            {v.telefone && (
                              <div>
                                <span className="font-medium text-app-text-muted">Telefone:</span>{' '}
                                <span className="text-app-text font-medium">{v.telefone}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                relatedProcessos.length === 0 ? (
                  <div className="text-center py-12 text-app-text-muted italic bg-app-bg/20 rounded-xl border border-app-border border-dashed">
                    Nenhum processo relacionado encontrado para este tribunal.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                    {relatedProcessos.map((p, i) => {
                      const clientContact = state.contatos.find(c => c.id === p.clienteId);
                      const clientName = clientContact ? clientContact.nome : 'Cliente Desconhecido';
                      
                      return (
                        <div key={p.id || i} className="bg-app-bg/30 border border-app-border hover:border-primary/50 transition-colors p-3.5 rounded-xl space-y-2">
                          <div className="flex justify-between items-start gap-2 flex-wrap sm:flex-nowrap">
                            <div>
                              <h4 className="font-mono font-bold text-sm text-primary break-all">
                                {p.numero}
                              </h4>
                              <p className="text-xs text-app-text font-semibold mt-1">
                                <span className="text-app-text-muted font-medium">Cliente:</span> {clientName}
                              </p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.status === 'Ativo' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                            }`}>
                              {p.status}
                            </span>
                          </div>

                          {(p.classe || p.assunto || p.pasta) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-app-text-muted pt-1 border-t border-app-border/40">
                              {p.classe && (
                                <div className="truncate" title={p.classe}>
                                  <span className="font-medium text-app-text-muted">Classe:</span>{' '}
                                  <span className="text-app-text font-medium">{p.classe}</span>
                                </div>
                              )}
                              {p.assunto && (
                                <div className="truncate" title={p.assunto}>
                                  <span className="font-medium text-app-text-muted">Assunto:</span>{' '}
                                  <span className="text-app-text font-medium">{p.assunto}</span>
                                </div>
                              )}
                              {p.pasta && (
                                <div>
                                  <span className="font-medium text-app-text-muted">Pasta:</span>{' '}
                                  <span className="text-app-text font-medium">{p.pasta}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Close Button */}
            <div className="pt-4 flex justify-end border-t border-app-border">
              <button 
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTribunal(null);
                }}
                className="px-5 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-semibold text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {!editingTribunal && (
              <div className="p-3 bg-app-secondary/30 rounded-lg border border-app-border space-y-2">
                <label className="text-[10px] font-bold text-app-text-muted uppercase tracking-wider">Sugestões Rápidas</label>
                <div className="flex flex-wrap gap-2">
                  {commonTribunals.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({ id: t.id, sigla: t.sigla, nome: t.nome })}
                      className="text-[10px] bg-app-surface border border-app-border px-2 py-1 rounded hover:bg-primary hover:text-white hover:border-primary transition-all font-medium uppercase"
                    >
                      {t.sigla}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Sigla do Tribunal (SIGLA) *</label>
              <input 
                type="text" 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: TJAM, TRF1"
                value={formData.sigla}
                onChange={e => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev, 
                    sigla: val,
                    id: prev.id === '' || prev.id === prev.sigla.toUpperCase() ? val.toUpperCase() : prev.id
                  }));
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">ID do Tribunal (ID_TJ) *</label>
              <input 
                type="text" 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text disabled:opacity-75 disabled:bg-app-bg"
                placeholder="Ex: TJAM, CNJ"
                value={formData.id}
                onChange={e => setFormData({...formData, id: e.target.value.toUpperCase()})}
                disabled={!!editingTribunal}
              />
              <p className="text-[10px] text-app-text-muted italic">Este ID é usado para vincular Fóruns e Processos.</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Nome do Tribunal (NOME) *</label>
              <input 
                type="text" 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: Tribunal de Justiça do Amazonas"
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
              />
            </div>
            <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
              <button 
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTribunal(null);
                }}
                className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
              >
                {editingTribunal ? "Atualizar Tribunal" : "Salvar Tribunal"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
