import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import { Building2, Plus, Search, ChevronRight, UserPlus, Trash2, Users, Gavel, ChevronLeft, Activity, Tag, FileText, AlertCircle, Info, Edit2, ArrowUp, ArrowDown } from 'lucide-react';
import Modal from '../components/Modal';
import VaraStatsModal from '../components/VaraStatsModal';
import { motion, AnimatePresence } from 'motion/react';
import Pagination from '../components/Pagination';

interface VaraStatsInternal {
  totalProcessos: number;
  julgados: number;
  pendentes: number;
  mediaDiasJulgamento: number;
  assuntosMaisComuns: { nome: string; count: number }[];
  classesMaisComuns: { nome: string; count: number }[];
}

export default function Varas() {
  const { state, addVara, updateVara, deleteVara, escritorioAtivoId, isAdmin, currentUser, hasPermission } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingVaraId, setEditingVaraId] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'dados' | 'processos'>('dados');
  const [processSearchTerm, setProcessSearchTerm] = useState('');

  const canWrite = hasPermission('varas', 'write');
  const canDelete = hasPermission('varas', 'delete');

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
    key: 'nome',
    direction: 'asc'
  });

  const handleSort = (key: string) => {
    if (sortConfig && sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      setSortConfig({ key, direction: 'asc' });
    }
  };

  // Reset to first page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const [novaVara, setNovaVara] = useState({
    id: '',
    nome: '',
    forum: '',
    localizacao: '',
    telefone: '',
    email: '',
    balcaoVirtual: '',
    juiz: '',
    juiz_2: '',
    id_servidores: [] as string[],
    idTj: ''
  });

  const filteredVaras = state.varas.filter(v => {
    const isGlobal = !v.escritorioId || v.escritorioId.toLowerCase() === 'x' || v.escritorioId.trim() === '';
    if (escritorioAtivoId && v.escritorioId && v.escritorioId.trim() !== '' && v.escritorioId !== escritorioAtivoId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && v.escritorioId && !(currentUser?.escritoriosIds || []).includes(v.escritorioId)) return false;
    
    const forum = state.forums.find(f => f.id === v.forum);
    const juiz = state.julgadores.find(j => j.id === v.juiz);
    const juiz2 = state.julgadores.find(j => j.id === v.juiz_2);
    const normalizeStr = (str: string) => 
      (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const sNorm = normalizeStr(searchTerm);
    return normalizeStr(v.nome).includes(sNorm) || 
           normalizeStr(v.forum).includes(sNorm) ||
           normalizeStr(forum?.nome).includes(sNorm) ||
           normalizeStr(juiz?.nome).includes(sNorm) ||
           normalizeStr(juiz2?.nome).includes(sNorm);
  });

  const [forumSearch, setForumSearch] = useState('');
  const [showForumResults, setShowForumResults] = useState(false);

  // Sync forum search when editing/viewing
  useEffect(() => {
    if (novaVara.forum) {
      const forum = state.forums.find(f => f.id === novaVara.forum);
      setForumSearch(forum ? forum.nome : novaVara.forum);
    } else {
      setForumSearch('');
    }
  }, [novaVara.forum, state.forums]);

  const sortedVaras = useMemo(() => {
    if (!sortConfig) return filteredVaras;

    return [...filteredVaras].sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortConfig.key) {
        case 'nome':
          aValue = a.nome || '';
          bValue = b.nome || '';
          break;
        case 'forum': {
          const forumA = state.forums.find(f => f.id === a.forum);
          const forumB = state.forums.find(f => f.id === b.forum);
          aValue = forumA?.nome || a.forum || '';
          bValue = forumB?.nome || b.forum || '';
          break;
        }
        case 'secretaria': {
          const secA = state.upj.find(u => u.id === a.secretaria);
          const secB = state.upj.find(u => u.id === b.secretaria);
          aValue = secA?.nome || '';
          bValue = secB?.nome || '';
          break;
        }
        case 'processos': {
          const countProc = (varaId: string) => state.processos.filter(p => {
            const pVaraId = p.varaId || p.tribunal;
            if (pVaraId !== varaId) return false;
            
            const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
            const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
            const isGlobal = pEscId === 'X';
            
            if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
            if (!isAdmin() && !isGlobal) {
              const userOffices = (currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase());
              if (pEscId && !userOffices.includes(pEscId)) return false;
            }
            return true;
          }).length;
          aValue = countProc(a.id);
          bValue = countProc(b.id);
          break;
        }
        case 'contato':
          aValue = `${a.email || ''} ${a.telefone || ''}`.trim();
          bValue = `${b.email || ''} ${b.telefone || ''}`.trim();
          break;
        case 'juiz': {
          const jA = state.julgadores.find(j => j.id === a.juiz);
          const jB = state.julgadores.find(j => j.id === b.juiz);
          aValue = jA?.nome || a.juiz || '';
          bValue = jB?.nome || b.juiz || '';
          break;
        }
        case 'servidores':
          aValue = (a.id_servidores || []).length;
          bValue = (b.id_servidores || []).length;
          break;
        default:
          aValue = (a as any)[sortConfig.key] || '';
          bValue = (b as any)[sortConfig.key] || '';
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const strA = String(aValue).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const strB = String(bValue).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredVaras, sortConfig, state.forums, state.upj, state.processos, state.julgadores, escritorioAtivoId, currentUser]);

  const itemsPerPage = state.settings.itemsPerPage || 10;
  const totalPages = Math.ceil(sortedVaras.length / itemsPerPage);
  
  const paginatedVaras = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedVaras.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedVaras, currentPage, itemsPerPage]);

  const [selectedVaraForStats, setSelectedVaraForStats] = useState<any>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  const handleShowStats = (vara: any) => {
    setSelectedVaraForStats(vara);
    setIsStatsModalOpen(true);
  };

  const handleEdit = (vara: any) => {
    setModalMode('edit');
    setEditingVaraId(vara.id);
    setActiveModalTab('dados');
    setProcessSearchTerm('');
    setNovaVara({
      id: vara.id || '',
      nome: vara.nome || '',
      forum: vara.forum || '',
      localizacao: vara.localizacao || '',
      telefone: vara.telefone || '',
      email: vara.email || '',
      balcaoVirtual: vara.balcaoVirtual || '',
      juiz: vara.juiz || '',
      juiz_2: vara.juiz_2 || '',
      id_servidores: vara.id_servidores || [],
      idTj: vara.idTj || ''
    });
    setIsModalOpen(true);
  };

  const handleView = (vara: any) => {
    setModalMode('view');
    setEditingVaraId(vara.id);
    setActiveModalTab('dados');
    setProcessSearchTerm('');
    setNovaVara({
      id: vara.id || '',
      nome: vara.nome || '',
      forum: vara.forum || '',
      localizacao: vara.localizacao || '',
      telefone: vara.telefone || '',
      email: vara.email || '',
      balcaoVirtual: vara.balcaoVirtual || '',
      juiz: vara.juiz || '',
      juiz_2: vara.juiz_2 || '',
      id_servidores: vara.id_servidores || [],
      idTj: vara.idTj || ''
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setModalMode('create');
    setEditingVaraId(null);
    setActiveModalTab('dados');
    setProcessSearchTerm('');
    setNovaVara({
      id: '',
      nome: '',
      forum: '',
      localizacao: '',
      telefone: '',
      email: '',
      balcaoVirtual: '',
      juiz: '',
      juiz_2: '',
      id_servidores: [],
      idTj: ''
    });
    setIsModalOpen(true);
  };

  const modalVaraId = editingVaraId || novaVara.id;
  const modalVaraProcessos = useMemo(() => {
    if (!modalVaraId) return [];
    return state.processos.filter(p => {
      const pVaraId = p.varaId || p.tribunal;
      if (pVaraId !== modalVaraId) return false;

      const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
      const isGlobal = pEscId === 'X';

      if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
      if (!isAdmin() && !isGlobal) {
        const userOffices = (currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase());
        if (pEscId && !userOffices.includes(pEscId)) return false;
      }
      return true;
    });
  }, [state.processos, modalVaraId, escritorioAtivoId, currentUser]);

  const filteredModalVaraProcessos = useMemo(() => {
    if (!processSearchTerm.trim()) return modalVaraProcessos;
    const term = processSearchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return modalVaraProcessos.filter(p => {
      const num = (p.numero || p.id || '').toLowerCase();
      const tit = (p.titulo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const parte = (p.parteContraria || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const classe = (p.classe || p.tipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const cliente = (state.contatos.find(c => c.id === p.clienteId)?.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return num.includes(term) || tit.includes(term) || parte.includes(term) || classe.includes(term) || cliente.includes(term);
    });
  }, [modalVaraProcessos, processSearchTerm, state.contatos]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaVara.nome || !novaVara.id) return;
    
    if (editingVaraId) {
      updateVara({
        ...novaVara,
        id: editingVaraId
      } as any);
    } else {
      addVara({
        ...novaVara,
        escritorioId: escritorioAtivoId || ''
      } as any);
    }
    
    setIsModalOpen(false);
    setNovaVara({
      id: '',
      nome: '',
      forum: '',
      localizacao: '',
      telefone: '',
      email: '',
      balcaoVirtual: '',
      juiz: '',
      juiz_2: '',
      id_servidores: [],
      idTj: ''
    });
    setEditingVaraId(null);
  };

  const handleDelete = () => {
    if (!canDelete) return;
    if (editingVaraId && window.confirm('Tem certeza que deseja excluir esta vara?')) {
      deleteVara(editingVaraId);
      setIsModalOpen(false);
      setEditingVaraId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <Building2 className="mr-3 text-primary" />
          Gestão de Varas
        </h1>
        {canWrite && (
          <button 
            onClick={handleAddNew}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Nova Vara
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="p-4 border-b border-app-border flex items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, fórum ou juiz..." 
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
                <th 
                  className="p-2 sm:p-4 font-medium cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => handleSort('nome')}
                  title="Clique para ordenar por Nome da Vara"
                >
                  <div className="flex items-center gap-1.5">
                    Nome da Vara
                    {sortConfig?.key === 'nome' && (
                      sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary shrink-0" /> : <ArrowDown size={14} className="text-primary shrink-0" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-2 sm:p-4 font-medium hidden sm:table-cell cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => handleSort('forum')}
                  title="Clique para ordenar por Fórum"
                >
                  <div className="flex items-center gap-1.5">
                    Fórum
                    {sortConfig?.key === 'forum' && (
                      sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary shrink-0" /> : <ArrowDown size={14} className="text-primary shrink-0" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-2 sm:p-4 font-medium hidden md:table-cell cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => handleSort('secretaria')}
                  title="Clique para ordenar por Secretaria"
                >
                  <div className="flex items-center gap-1.5">
                    Secretaria
                    {sortConfig?.key === 'secretaria' && (
                      sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary shrink-0" /> : <ArrowDown size={14} className="text-primary shrink-0" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-2 sm:p-4 font-medium hidden lg:table-cell cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => handleSort('processos')}
                  title="Clique para ordenar por Processos"
                >
                  <div className="flex items-center gap-1.5">
                    Processos
                    {sortConfig?.key === 'processos' && (
                      sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary shrink-0" /> : <ArrowDown size={14} className="text-primary shrink-0" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-2 sm:p-4 font-medium hidden lg:table-cell cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => handleSort('contato')}
                  title="Clique para ordenar por Contato"
                >
                  <div className="flex items-center gap-1.5">
                    Contato
                    {sortConfig?.key === 'contato' && (
                      sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary shrink-0" /> : <ArrowDown size={14} className="text-primary shrink-0" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-2 sm:p-4 font-medium cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => handleSort('juiz')}
                  title="Clique para ordenar por Juiz"
                >
                  <div className="flex items-center gap-1.5">
                    Juiz
                    {sortConfig?.key === 'juiz' && (
                      sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary shrink-0" /> : <ArrowDown size={14} className="text-primary shrink-0" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-2 sm:p-4 font-medium hidden xl:table-cell cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => handleSort('servidores')}
                  title="Clique para ordenar por Servidores"
                >
                  <div className="flex items-center gap-1.5">
                    Servidores
                    {sortConfig?.key === 'servidores' && (
                      sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary shrink-0" /> : <ArrowDown size={14} className="text-primary shrink-0" />
                    )}
                  </div>
                </th>
                <th className="p-2 sm:p-4 font-medium text-right hidden sm:table-cell">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {paginatedVaras.map((vara, idx) => {
                const forum = state.forums.find(f => f.id === vara.forum);
                const juiz = state.julgadores.find(j => j.id === vara.juiz);
                const juiz2 = state.julgadores.find(j => j.id === vara.juiz_2);
                const isGlobal = vara.escritorioId?.toLowerCase() === 'x';
                return (
                  <tr 
                    key={`${vara.id}-${idx}`} 
                    onClick={() => canWrite && handleEdit(vara)}
                    className={`hover:bg-app-secondary/50 transition-colors group ${canWrite ? 'cursor-pointer' : ''} ${isGlobal ? 'bg-primary/5' : ''}`}
                  >
                    <td className="p-2 sm:p-4 font-medium text-app-text">
                      <div 
                        className="flex flex-col gap-0.5 cursor-pointer group/name"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(vara);
                        }}
                      >
                        <div className="flex items-center gap-2 group-hover/name:text-primary transition-colors hover:underline">
                          {vara.nome}
                          {vara.idTj && (
                            <span className="px-1.5 py-0.5 bg-app-bg text-app-text-muted border border-app-border text-[10px] font-bold rounded uppercase tracking-wider" title="Tribunal">
                              {vara.idTj}
                            </span>
                          )}
                          {isGlobal && (
                            <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                              Geral
                            </span>
                          )}
                        </div>
                        <div className="sm:hidden text-[10px] text-app-text-muted">
                          {forum?.nome || vara.forum || 'Sem fórum'}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 text-app-text-muted hidden sm:table-cell">
                      {forum ? (
                        <span className="text-sm font-medium">{forum.nome}</span>
                      ) : (
                        <span className="text-sm italic text-app-text-muted">{vara.forum || 'Não informado'}</span>
                      )}
                    </td>
                    <td className="p-2 sm:p-4 text-app-text-muted hidden md:table-cell">
                      {(() => {
                        const sec = state.upj.find(u => u.id === vara.secretaria);
                        return sec ? (
                          <span className="text-sm font-bold text-primary">{sec.nome}</span>
                        ) : (
                          <span className="text-xs italic opacity-50">-</span>
                        );
                      })()}
                    </td>
                    <td className="p-2 sm:p-4 text-app-text-muted hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-bold min-w-[32px] text-center">
                          {state.processos.filter(p => {
                            const pVaraId = p.varaId || p.tribunal;
                            if (pVaraId !== vara.id) return false;
                            
                            const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
                            const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
                            const isGlobal = pEscId === 'X';
                            
                            if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
                            if (!isAdmin() && !isGlobal) {
                              const userOffices = (currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase());
                              if (pEscId && !userOffices.includes(pEscId)) return false;
                            }
                            return true;
                          }).length}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 text-app-text-muted hidden lg:table-cell">
                      {vara.telefone && <div className="text-sm">{vara.telefone}</div>}
                      {vara.email && <div className="text-sm text-primary">{vara.email}</div>}
                    </td>
                    <td className="p-2 sm:p-4 text-app-text-muted">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Gavel size={14} className="text-app-text-muted shrink-0 hidden sm:block" />
                          {juiz ? (
                            <span className="text-sm font-semibold text-app-text">{juiz.nome.split(' ')[0]}</span>
                          ) : (
                            <span className="text-sm italic text-app-text-muted">{vara.juiz ? vara.juiz.split(' ')[0] : '-'}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 text-app-text-muted hidden xl:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {vara.id_servidores && vara.id_servidores.length > 0 ? (
                          vara.id_servidores.map((sid, sIdx) => {
                            const s = state.servidores.find(srv => srv.id === sid);
                            return s ? (
                              <span key={`${sid}-${sIdx}`} className="text-[10px] bg-app-secondary px-1.5 py-0.5 rounded border border-app-border">
                                {s.nome.split(' ')[0]}
                              </span>
                            ) : null;
                          })
                        ) : (
                          <span className="text-xs italic opacity-50">-</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 text-right hidden sm:table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowStats(vara);
                          }}
                          className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                          title="Estatísticas da Vara"
                        >
                          <Activity size={18} />
                        </button>
                        
                        {canWrite && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(vara);
                            }}
                            className="text-app-text-muted hover:text-blue-500 transition-colors p-2 rounded-full hover:bg-blue-500/10"
                            title="Editar Vara"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}

                        {canDelete && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Tem certeza que deseja excluir esta vara?')) {
                                deleteVara(vara.id);
                              }
                            }}
                            className="text-app-text-muted hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-500/10"
                            title="Excluir Vara"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                        
                        {!canWrite && (
                          <button className="text-app-text-muted transition-colors p-2 rounded-full hover:bg-app-bg">
                            <ChevronRight size={20} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredVaras.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-app-text-muted">
                    Nenhuma vara encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredVaras.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          label="varas"
        />
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={modalMode === 'view' ? "Visualizar Vara" : modalMode === 'edit' ? "Editar Vara" : "Nova Vara"}
      >
        <div className="space-y-4">
          <div className="flex border-b border-app-border">
            <button
              type="button"
              onClick={() => setActiveModalTab('dados')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeModalTab === 'dados'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-app-text-muted hover:text-app-text'
              }`}
            >
              <Info size={16} />
              Informações da Vara
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('processos')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeModalTab === 'processos'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-app-text-muted hover:text-app-text'
              }`}
            >
              <FileText size={16} />
              Processos Cadastrados
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeModalTab === 'processos' ? 'bg-primary/20 text-primary' : 'bg-app-secondary text-app-text-muted'
              }`}>
                {modalVaraProcessos.length}
              </span>
            </button>
          </div>

          {activeModalTab === 'dados' ? (
            <form onSubmit={handleSave} className="space-y-4">
              <fieldset disabled={modalMode === 'view'} className="space-y-4 disabled:opacity-100 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">ID da Vara (ID_VARA) *</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Ex: VARA_01"
                      value={novaVara.id}
                      onChange={e => setNovaVara({...novaVara, id: e.target.value.toUpperCase()})}
                      disabled={modalMode === 'edit'}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Nome da Vara (VARA_NOME) *</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Ex: 1ª Vara Cível"
                      value={novaVara.nome}
                      onChange={e => setNovaVara({...novaVara, nome: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Tribunal Vinculado (ID_TJ)</label>
                    {modalMode === 'view' ? (
                      <div className="p-2.5 bg-app-surface border border-app-border rounded-lg text-app-text text-sm flex items-center gap-2">
                        <Building2 size={15} className="text-app-text-muted shrink-0" />
                        <span className="font-medium">
                          {(() => {
                            if (novaVara.idTj) {
                              const t = state.tribunais.find(tr => tr.id === novaVara.idTj || tr.id.toLowerCase() === novaVara.idTj?.toLowerCase());
                              if (t) return t.sigla ? `${t.sigla} - ${t.nome}` : t.nome;
                            }
                            if (novaVara.forum) {
                              const forumObj = state.forums.find(f => f.id === novaVara.forum || f.nome === novaVara.forum);
                              if (forumObj && forumObj.tribunalId) {
                                const t = state.tribunais.find(tr => tr.id === forumObj.tribunalId || tr.id.toLowerCase() === forumObj.tribunalId?.toLowerCase());
                                if (t) return t.sigla ? `${t.sigla} - ${t.nome}` : t.nome;
                              }
                              const tDirect = state.tribunais.find(tr => tr.id === novaVara.forum || tr.id.toLowerCase() === novaVara.forum?.toLowerCase());
                              if (tDirect) return tDirect.sigla ? `${tDirect.sigla} - ${tDirect.nome}` : tDirect.nome;
                            }
                            return '-';
                          })()}
                        </span>
                      </div>
                    ) : (
                      <select
                        className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm h-[42px]"
                        value={novaVara.idTj}
                        onChange={e => setNovaVara({...novaVara, idTj: e.target.value})}
                      >
                        <option value="">Selecione um tribunal...</option>
                        {state.tribunais.map(t => (
                          <option key={t.id} value={t.id}>{t.sigla || t.id} - {t.nome}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Quantidade de Processos</label>
                    <div 
                      onClick={() => setActiveModalTab('processos')}
                      className="p-2.5 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer rounded-lg border border-primary/20 text-primary font-bold flex items-center justify-between text-sm h-[42px]"
                      title="Clique para ver os processos"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-primary shrink-0" />
                        <span>
                          {(() => {
                            const count = modalVaraProcessos.length;
                            return `${count} processo${count === 1 ? '' : 's'}`;
                          })()}
                        </span>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 bg-primary/10 rounded-full font-semibold">
                        Ver Lista
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 relative">
                    <label className="text-sm font-medium text-app-text">ID do Fórum (ID_FORUM)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 pl-10 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                        placeholder="Digite para buscar..."
                        value={forumSearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForumSearch(val);
                          setShowForumResults(val.length >= 2);
                          if (!val) {
                            setNovaVara({...novaVara, forum: ''});
                          } else {
                            const currentForum = state.forums.find(f => f.id === novaVara.forum);
                            if (!currentForum || val !== currentForum.nome) {
                              setNovaVara({...novaVara, forum: val});
                            }
                          }
                        }}
                        onFocus={() => forumSearch.length >= 2 && setShowForumResults(true)}
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                      
                      {showForumResults && forumSearch.length >= 2 && modalMode !== 'view' && (
                        <div className="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {state.forums
                            .filter(f => {
                              const normName = (f.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                              const normId = (f.id || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                              const normSearch = (forumSearch || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                              return normName.includes(normSearch) || normId.includes(normSearch);
                            })
                            .slice(0, 10)
                            .map(f => (
                              <button
                                key={f.id}
                                type="button"
                                className="w-full text-left px-4 py-3 hover:bg-app-secondary/50 text-sm border-b border-app-border last:border-0 flex flex-col"
                                onClick={() => {
                                  setNovaVara({ ...novaVara, forum: f.id });
                                  setForumSearch(f.nome);
                                  setShowForumResults(false);
                                }}
                              >
                                <span className="font-medium text-app-text">{f.nome}</span>
                                <span className="text-[10px] text-app-text-muted">ID: {f.id}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Localização (LOCALIZACAO)</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Ex: 5º andar, sala 501"
                      value={novaVara.localizacao}
                      onChange={e => setNovaVara({...novaVara, localizacao: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Telefone (TEL01)</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Ex: (11) 99999-9999"
                      value={novaVara.telefone}
                      onChange={e => setNovaVara({...novaVara, telefone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">E-mail (EMAIL01)</label>
                    <input 
                      type="email" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Ex: vara@tjam.jus.br"
                      value={novaVara.email}
                      onChange={e => setNovaVara({...novaVara, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Balcão Virtual (BALCAO01)</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Link do Balcão Virtual"
                      value={novaVara.balcaoVirtual}
                      onChange={e => setNovaVara({...novaVara, balcaoVirtual: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Juiz Titular (JUIZ)</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Nome do Juiz"
                      value={novaVara.juiz}
                      onChange={e => setNovaVara({...novaVara, juiz: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-app-text">Juiz Auxiliar (JUIZ_2)</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="Nome do Juiz Auxiliar"
                      value={novaVara.juiz_2}
                      onChange={e => setNovaVara({...novaVara, juiz_2: e.target.value})}
                    />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-sm font-medium text-app-text">Servidores (ID_SERVIDORES)</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                      placeholder="IDs dos servidores (separados por vírgula)"
                      value={novaVara.id_servidores?.join(', ')}
                      onChange={e => setNovaVara({...novaVara, id_servidores: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)})}
                    />
                  </div>
                </div>
              </fieldset>
              
              <div className="pt-4 flex justify-between items-center border-t border-app-border">
                <div>
                  {editingVaraId && canDelete && modalMode !== 'view' && (
                    <button 
                      type="button"
                      onClick={handleDelete}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Excluir Vara
                    </button>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
                  >
                    {modalMode === 'view' ? 'Fechar' : 'Cancelar'}
                  </button>
                  {modalMode !== 'view' && (
                    <button 
                      type="submit"
                      className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      {modalMode === 'edit' ? "Salvar Alterações" : "Salvar Vara"}
                    </button>
                  )}
                  {modalMode === 'view' && canWrite && (
                    <button 
                      type="button"
                      onClick={() => {
                        const vara = state.varas.find(v => v.id === editingVaraId);
                        if (vara) handleEdit(vara);
                      }}
                      className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center"
                    >
                      <Edit2 size={16} className="mr-2" />
                      Editar
                    </button>
                  )}
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar por número, parte ou classe..."
                    value={processSearchTerm}
                    onChange={(e) => setProcessSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-app-text"
                  />
                </div>
                <div className="text-xs text-app-text-muted font-medium">
                  Total: <strong className="text-primary">{filteredModalVaraProcessos.length}</strong> {filteredModalVaraProcessos.length === 1 ? 'processo' : 'processos'}
                </div>
              </div>

              {filteredModalVaraProcessos.length === 0 ? (
                <div className="py-10 text-center text-app-text-muted text-sm border border-dashed border-app-border rounded-xl bg-app-secondary/10">
                  <FileText size={36} className="mx-auto mb-2 opacity-30 text-app-text-muted" />
                  <p className="font-semibold text-app-text">Nenhum processo cadastrado nesta vara</p>
                  <p className="text-xs text-app-text-muted mt-1">
                    {processSearchTerm ? 'Nenhum resultado corresponde à sua busca.' : 'Os processos associados a esta vara aparecerão listados aqui.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-[380px] overflow-y-auto border border-app-border rounded-xl divide-y divide-app-border bg-app-surface shadow-inner">
                  {filteredModalVaraProcessos.map((proc) => {
                    const cliente = state.contatos.find(c => c.id === proc.clienteId);
                    return (
                      <div key={proc.id} className="p-3.5 hover:bg-app-secondary/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-primary">
                              {proc.numero || proc.id}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              proc.status === 'Inativo' || proc.ativo === '0'
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {proc.status || (proc.ativo === '1' ? 'Ativo' : 'Inativo')}
                            </span>
                            {(proc.classe || proc.tipo) && (
                              <span className="text-[11px] px-2 py-0.5 bg-app-secondary/60 text-app-text-muted rounded-md border border-app-border">
                                {proc.classe || proc.tipo}
                              </span>
                            )}
                          </div>
                          {proc.titulo && (
                            <p className="text-xs font-semibold text-app-text truncate">{proc.titulo}</p>
                          )}
                          <div className="text-xs text-app-text-muted flex items-center gap-3 flex-wrap">
                            {cliente && (
                              <span>
                                <strong className="text-app-text font-medium">Cliente:</strong> {cliente.nome}
                              </span>
                            )}
                            {proc.parteContraria && (
                              <span>
                                <strong className="text-app-text font-medium">Parte Contrária:</strong> {proc.parteContraria}
                              </span>
                            )}
                            {proc.dataDistribuicao && (
                              <span>
                                <strong className="text-app-text font-medium">Distribuído em:</strong> {proc.dataDistribuicao}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="pt-4 flex justify-end border-t border-app-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de Estatísticas */}
      {selectedVaraForStats && (
        <VaraStatsModal
          isOpen={isStatsModalOpen}
          onClose={() => setIsStatsModalOpen(false)}
          vara={selectedVaraForStats}
        />
      )}
    </div>
  );
}
