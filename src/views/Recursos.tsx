import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context';
import { FileText, Search, ExternalLink, Filter, Info, Plus, Edit2, Trash2, Users, Eye, Scale } from 'lucide-react';
import RecursoModal from '../components/RecursoModal';
import Pagination from '../components/Pagination';
import Processos from './Processos';
import { Recurso } from '../types';

export default function Recursos() {
  const { state, escritorioAtivoId, isAdmin, currentUser, hasPermission, canViewMenu, deleteRecurso, setSelectedProcessId } = useAppContext();
  const canView = canViewMenu('recursos');
  const canRead = hasPermission('recursos', 'read');
  const canWrite = hasPermission('recursos', 'write');
  const canEdit = hasPermission('recursos', 'write');
  const canDelete = hasPermission('recursos', 'delete');

  const [activeTab, setActiveTab] = useState<'originarios' | 'grauRecursal'>('originarios');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Ativo' | 'Inativo'>('Ativo');
  const [currentPage, setCurrentPage] = useState(1);

  // Paginação conforme preferências do sistema
  const itemsPerPage = state.settings.itemsPerPage || 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecurso, setSelectedRecurso] = useState<Recurso | null>(null);
  const [modalReadOnly, setModalReadOnly] = useState(false);

  // Resetar para primeira página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, escritorioAtivoId]);

  if (!canView) {
    return (
      <div className="p-8 text-center bg-app-surface rounded-xl border border-app-border m-6">
        <Info className="mx-auto text-app-text-muted mb-4" size={48} />
        <h2 className="text-xl font-bold text-app-text mb-2">Acesso Restrito</h2>
        <p className="text-app-text-muted">Você não tem permissão para visualizar este módulo.</p>
      </div>
    );
  }

  const handleCreate = () => {
    if (!canWrite) return;
    setSelectedRecurso(null);
    setModalReadOnly(false);
    setIsModalOpen(true);
  };

  const handleEdit = (recurso: Recurso) => {
    if (!canEdit) return;
    setSelectedRecurso(recurso);
    setModalReadOnly(false);
    setIsModalOpen(true);
  };

  const handleView = (recurso: Recurso) => {
    setSelectedRecurso(recurso);
    setModalReadOnly(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!canDelete) return;
    if (window.confirm('Tem certeza que deseja excluir este recurso?')) {
      deleteRecurso(id);
    }
  };

  // Contagem para Recursos Originários (respeitando escritório ativo e visibilidade)
  const totalOriginarios = state.recursos.filter(r => {
    const isGlobal = !r.escritorioId || r.escritorioId.toLowerCase() === 'x' || r.escritorioId.trim() === '';
    if (escritorioAtivoId && r.escritorioId && r.escritorioId.trim() !== '' && r.escritorioId !== escritorioAtivoId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && r.escritorioId && !(currentUser?.escritoriosIds || []).includes(r.escritorioId)) return false;
    return true;
  }).length;

  // Contagem para Grau Recursal (Processos com Instancia = '2 grau')
  const totalGrauRecursal = state.processos.filter(p => {
    const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
    const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
    const isGlobal = pEscId === 'X';
    if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal) {
      const userOffices = (currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase());
      if (pEscId && !userOffices.includes(pEscId)) return false;
    }
    return (p.instancia || '').toLowerCase().trim() === '2 grau';
  }).length;

  const filteredRecursos = useMemo(() => {
    return state.recursos.filter(r => {
      const isGlobal = !r.escritorioId || r.escritorioId.toLowerCase() === 'x' || r.escritorioId.trim() === '';
      if (escritorioAtivoId && r.escritorioId && r.escritorioId.trim() !== '' && r.escritorioId !== escritorioAtivoId && !isGlobal) return false;
      if (!isAdmin() && !isGlobal && r.escritorioId && !(currentUser?.escritoriosIds || []).includes(r.escritorioId)) return false;
      
      const matchesSearch = 
        (r.classe || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (r.assunto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.processoOriginarioId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.secao || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'Todos' || (r.status || 'Ativo') === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [state.recursos, escritorioAtivoId, isAdmin, currentUser, searchTerm, filterStatus]);

  // Paginação calculada
  const totalPages = Math.ceil(filteredRecursos.length / itemsPerPage) || 1;
  const paginatedRecursos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecursos.slice(start, start + itemsPerPage);
  }, [filteredRecursos, currentPage, itemsPerPage]);

  const formatCNJ = (numero: string) => {
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Abas de Navegação */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-app-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text flex items-center">
            <Scale className="mr-3 text-primary" />
            Recursos
          </h1>
          <p className="text-xs text-app-text-muted mt-1">
            Gestão integrada de recursos originários e processos em grau recursal
          </p>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-2 bg-app-surface p-1.5 rounded-xl border border-app-border shadow-sm w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('originarios')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'originarios'
                ? 'bg-primary text-white shadow-sm'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
            }`}
          >
            <FileText size={16} />
            <span>Recursos Originários</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'originarios' ? 'bg-white/20 text-white' : 'bg-app-bg text-app-text-muted border border-app-border'
            }`}>
              {totalOriginarios}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grauRecursal')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'grauRecursal'
                ? 'bg-primary text-white shadow-sm'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-bg'
            }`}
          >
            <Scale size={16} />
            <span>Grau Recursal</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'grauRecursal' ? 'bg-white/20 text-white' : 'bg-app-bg text-app-text-muted border border-app-border'
            }`}>
              {totalGrauRecursal}
            </span>
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba 1: Recursos Originários */}
      {activeTab === 'originarios' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-app-text">Tabela de Recursos Originários</span>
            </div>
            {canWrite && (
              <button 
                onClick={handleCreate}
                className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all shadow-md shadow-primary/20 font-medium active:scale-95 text-sm"
                id="btn-novo-recurso"
              >
                <Plus size={18} />
                <span>Novo Recurso</span>
              </button>
            )}
          </div>

          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
            <div className="p-4 border-b border-app-border flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
                <input 
                  type="text" 
                  placeholder="Buscar por classe, assunto, seção ou processo..." 
                  className="w-full pl-10 pr-4 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-app-bg px-3 py-1.5 rounded-lg border border-app-border">
                  <Filter size={16} className="text-app-text-muted" />
                  <span className="text-xs font-medium text-app-text-muted">Status:</span>
                  <select 
                    className="bg-transparent text-app-text text-sm font-medium focus:outline-none cursor-pointer"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'Todos' | 'Ativo' | 'Inativo')}
                  >
                    <option value="Todos">Todos</option>
                    <option value="Ativo">Ativos</option>
                    <option value="Inativo">Inativos</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-app-secondary text-app-text-muted text-sm uppercase tracking-wider">
                    <th className="p-4 font-medium">Classe / Assunto</th>
                    <th className="p-4 font-medium">Processo Origem</th>
                    <th className="p-4 font-medium">Órgão / Relator</th>
                    <th className="p-4 font-medium">Marcador / Resultado</th>
                    <th className="p-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {paginatedRecursos.map((recurso) => {
                    const processo = state.processos.find(p => p.id === recurso.processoOriginarioId);
                    const relator = state.julgadores.find(j => j.id === recurso.relatorId);
                    
                    return (
                      <tr key={recurso.id} className={`hover:bg-app-bg transition-colors group ${recurso.status === 'Inativo' ? 'opacity-60' : ''}`}>
                        <td className="p-4">
                          <div className="font-medium text-app-text">{recurso.classe}</div>
                          <div className="text-xs text-app-text-muted">{recurso.assunto}</div>
                          <div className="mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              recurso.status === 'Ativo' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}>
                              {recurso.status || 'Ativo'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          {processo ? (
                            <button
                              onClick={() => {
                                setSelectedProcessId(processo.id);
                                window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                              }}
                              className="text-sm font-mono text-primary hover:underline hover:font-bold focus:outline-none text-left block"
                              title="Clique para visualizar o processo"
                            >
                              {formatCNJ(processo.numero)}
                            </button>
                          ) : (
                            <div className="text-sm font-mono text-app-text-muted font-normal">
                              {formatCNJ(recurso.processoOriginarioId)}
                            </div>
                          )}
                          {recurso.recursoOriginario && (
                            <div className="text-[10px] text-app-text-muted mt-1">
                              Orig: {recurso.recursoOriginario}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-app-text">{recurso.secao}</div>
                          <div className="text-xs text-app-text-muted">{relator?.nome || recurso.relatorId}</div>
                          {recurso.envolvidosIds && recurso.envolvidosIds.length > 0 && (
                            <div className="mt-2 flex items-center space-x-1 text-[10px]">
                              <Users size={12} className="text-primary" />
                              <span className="text-app-text-muted truncate max-w-[150px]">
                                {recurso.envolvidosIds.map(id => state.contatos.find(c => c.id === id)?.nome || id).join(', ')}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {recurso.marcador && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {recurso.marcador.split(',').map(m => m.trim()).filter(Boolean).map((part, idx) => {
                                let tag = state.etiquetas.find(t => String(t.id) === part);
                                if (!tag) {
                                  tag = state.etiquetas.find(t => t.nome.toLowerCase() === part.toLowerCase());
                                }
                                if (!tag) {
                                  return (
                                    <span key={idx} className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border bg-app-secondary border-app-border text-app-text">
                                      {part.toUpperCase()}
                                    </span>
                                  );
                                }
                                return (
                                  <span 
                                    key={tag.id} 
                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border"
                                    style={{ 
                                      backgroundColor: tag.cor ? `${tag.cor}15` : 'rgba(var(--app-secondary), 0.3)', 
                                      color: tag.cor || 'var(--app-text)',
                                      borderColor: tag.cor ? `${tag.cor}30` : 'var(--app-border)'
                                    }}
                                  >
                                    {tag.nome.toUpperCase()}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {recurso.resultado && (
                            <div className={`text-xs font-bold ${
                              recurso.resultado.toLowerCase().includes('procedente') ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                              {recurso.resultado}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {recurso.link && (
                              <a 
                                href={recurso.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center p-2 text-app-text-muted hover:text-primary hover:bg-app-bg rounded-full transition-colors"
                                title="Ver no Tribunal"
                              >
                                <ExternalLink size={18} />
                              </a>
                            )}
                            {canRead && (
                              <button 
                                onClick={() => handleView(recurso)}
                                className="inline-flex items-center justify-center p-2 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                                title="Visualizar"
                              >
                                <Eye size={18} />
                              </button>
                            )}
                            {canEdit && (
                              <button 
                                onClick={() => handleEdit(recurso)}
                                className="inline-flex items-center justify-center p-2 text-app-text-muted hover:text-emerald-600 hover:bg-emerald-500/10 rounded-full transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={18} />
                              </button>
                            )}
                            {canDelete && (
                              <button 
                                onClick={() => handleDelete(recurso.id)}
                                className="inline-flex items-center justify-center p-2 text-app-text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-full transition-colors"
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
                  {paginatedRecursos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-app-text-muted">
                        Nenhum recurso encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação de Recursos Originários */}
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredRecursos.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              label="recursos"
            />
          </div>
          
          <RecursoModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            recurso={selectedRecurso} 
            readOnly={modalReadOnly}
          />
        </div>
      )}

      {/* Conteúdo da Aba 2: Grau Recursal (Processos com Instância = '2 grau') */}
      {activeTab === 'grauRecursal' && (
        <div className="w-full">
          <Processos 
            key="grau-recursal"
            filterInstancia="2 grau"
            defaultInstancia="2 grau"
            hideTitle={false}
            customTitle="Processos em Grau Recursal (2º Grau)"
            containerClassName="w-full flex flex-col space-y-4"
          />
        </div>
      )}
    </div>
  );
}
