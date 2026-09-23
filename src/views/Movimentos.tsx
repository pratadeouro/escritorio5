import React, { useState } from 'react';
import { useAppContext } from '../context';
import { 
  Activity, Search, ChevronRight, Calendar, User, FileText, Eye, Edit2, 
  Trash2, X, RefreshCw, AlertCircle, Info, Gavel, Plus, CheckCircle2, Clock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '../components/Modal';
import { Movimento } from '../types';
import { formatDate } from '../utils/date';
import { searchDatajud } from '../services/djenService';
import { CreateProcessoModal, CreateMovimentoModal } from '../components/CreateModals';

type ModalMode = 'view' | 'edit' | 'create';

export default function Movimentos() {
  const { state, escritorioAtivoId, isAdmin, currentUser, deleteMovimento, updateMovimento, hasPermission, setSelectedProcessId } = useAppContext();
  
  // Tab state
  const [activeMainTab, setActiveMainTab] = useState<'lista' | 'pesquisa'>('lista');

  // Local Movimentos State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('view');
  const [selectedMovimento, setSelectedMovimento] = useState<Movimento | null>(null);

  // Pesquisa Movimentos (Datajud Timeline) State
  const [searchProcessTerm, setSearchProcessTerm] = useState('');
  const [selectedTribunal, setSelectedTribunal] = useState('auto');
  const [isSearchingProcess, setIsSearchingProcess] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // Modals for adding process or movimento from search results
  const [isProcessoModalOpen, setIsProcessoModalOpen] = useState(false);
  const [selectedProcessoParaAdicionar, setSelectedProcessoParaAdicionar] = useState<any>(null);
  const [isMovimentoModalOpen, setIsMovimentoModalOpen] = useState(false);
  const [initialMovimentoData, setInitialMovimentoData] = useState<any>(null);

  const TRIBUNALS_LIST = [
    { id: 'tjac', name: 'TJ Acre' },
    { id: 'tjal', name: 'TJ Alagoas' },
    { id: 'tjam', name: 'TJ Amazonas' },
    { id: 'tjap', name: 'TJ Amapá' },
    { id: 'tjba', name: 'TJ Bahia' },
    { id: 'tjce', name: 'TJ Ceará' },
    { id: 'tjdft', name: 'TJ Distrito Federal' },
    { id: 'tjes', name: 'TJ Espírito Santo' },
    { id: 'tjgo', name: 'TJ Goiás' },
    { id: 'tjma', name: 'TJ Maranhão' },
    { id: 'tjmg', name: 'TJ Minas Gerais' },
    { id: 'tjms', name: 'TJ Mato Grosso do Sul' },
    { id: 'tjmt', name: 'TJ Mato Grosso' },
    { id: 'tjpa', name: 'TJ Pará' },
    { id: 'tjpb', name: 'TJ Paraíba' },
    { id: 'tjpe', name: 'TJ Pernambuco' },
    { id: 'tjpi', name: 'TJ Piauí' },
    { id: 'tjpr', name: 'TJ Paraná' },
    { id: 'tjrj', name: 'TJ Rio de Janeiro' },
    { id: 'tjrn', name: 'TJ Rio Grande do Norte' },
    { id: 'tjro', name: 'TJ Rondônia' },
    { id: 'tjrr', name: 'TJ Roraima' },
    { id: 'tjrs', name: 'TJ Rio Grande do Sul' },
    { id: 'tjsc', name: 'TJ Santa Catarina' },
    { id: 'tjse', name: 'TJ Sergipe' },
    { id: 'tjsp', name: 'TJ São Paulo' },
    { id: 'tjto', name: 'TJ Tocantins' },
    { id: 'trf1', name: 'TRF 1ª Região' },
  ];

  const itemsPerPage = state.settings.itemsPerPage || 10;

  const [formData, setFormData] = useState({
    id: '',
    processoId: '',
    data: '',
    descricao: '',
    pagina: '',
    usuarioId: '',
    escritorioId: ''
  });

  const canEdit = hasPermission('movimentos', 'write');
  const canDelete = hasPermission('movimentos', 'delete');

  const formatCNJ = (numero: string) => {
    if (!numero) return '';
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  const formatDatajudDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    if (dateStr.includes('-') || dateStr.includes('T')) {
      const parts = dateStr.split('T')[0].split(' ')[0].split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        if (year.length === 4) return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
        if (day.length === 4) return `${year.padStart(2, '0')}/${month.padStart(2, '0')}/${day}`;
      }
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
      } catch (e) {}
    }
    const digitsOnly = dateStr.replace(/\D/g, '');
    if (digitsOnly.length >= 8) {
      const year = digitsOnly.substring(0, 4);
      const month = digitsOnly.substring(4, 6);
      const day = digitsOnly.substring(6, 8);
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const formatDatajudTime = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return '';
    if (dateStr.includes('T') || dateStr.includes(':')) {
      try {
        if (dateStr.length === 8 && dateStr.split(':').length === 3) {
          return dateStr.substring(0, 5);
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
      } catch (e) {}
    }
    const digitsOnly = dateStr.replace(/\D/g, '');
    if (digitsOnly.length >= 12) {
      const hour = digitsOnly.substring(8, 10);
      const minute = digitsOnly.substring(10, 12);
      return `${hour}:${minute}`;
    }
    return '';
  };

  const convertToIsoDate = (dateStr: string) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    if (dateStr.includes('-')) return dateStr.split('T')[0];
    const digitsOnly = dateStr.replace(/\D/g, '');
    if (digitsOnly.length >= 8) {
      const year = digitsOnly.substring(0, 4);
      const month = digitsOnly.substring(4, 6);
      const day = digitsOnly.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  const handleSearchDatajud = async (manualTerm?: string) => {
    const term = (manualTerm || searchProcessTerm).replace(/\D/g, '');
    if (!term) return;

    setIsSearchingProcess(true);
    setApiError(null);

    let tribunalsToTry = selectedTribunal === 'auto' ? TRIBUNALS_LIST.map(t => t.id) : [selectedTribunal];
    let allHits: any[] = [];
    let foundTribunal = '';

    try {
      for (const trib of tribunalsToTry) {
        const query = {
          query: {
            match: { numeroProcesso: term }
          }
        };
        const result = await searchDatajud(query, trib);
        const hits = result.hits?.hits || [];
        
        if (hits.length > 0) {
          allHits = hits;
          foundTribunal = trib;
          break; 
        }
      }
      
      if (allHits.length === 0) {
        const triedList = tribunalsToTry.map(t => t.toUpperCase()).join(', ');
        setApiError(`Nenhum processo encontrado no(s) tribunal(is): ${triedList}. Tente selecionar o tribunal específico.`);
        setSearchResults([]);
        return;
      }

      const mapped = allHits.map((hit: any) => {
        const source = hit._source;
        let duracaoDias = 0;
        if (source.dataAjuizamento) {
          const ajuizamento = new Date(source.dataAjuizamento);
          const hoje = new Date();
          duracaoDias = Math.floor((hoje.getTime() - ajuizamento.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          id: hit._id || Math.random().toString(36).substr(2, 9),
          numeroProcesso: source.numeroProcesso,
          classe: source.classe?.nome || 'N/A',
          tribunal: source.tribunal || foundTribunal.toUpperCase() || 'TJ',
          dataAjuizamento: source.dataAjuizamento || 'N/A',
          orgaoJulgador: source.orgaoJulgador?.nome || 'N/A',
          status: 'Ativo',
          assuntos: source.assuntos?.map((a: any) => a.nome) || [],
          duracaoDias,
          partes: source.partes?.map((p: any) => ({
            nome: p.nome,
            tipoPolo: p.tipoPolo
          })),
          movimentacoes: source.movimentos?.map((m: any) => {
            const complements = m.complementosTabelados?.map((c: any) => 
              `${c.descricao || 'Complemento'}: ${c.nome}`
            ) || [];
            
            return {
              data: m.dataHora || m.data,
              descricao: m.nome || m.descricao,
              complementos: complements
            };
          }).sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime()) || []
        };
      });

      setSearchResults(mapped);
    } catch (error: any) {
      console.error('Erro na busca Datajud:', error);
      setApiError(`Erro na API Datajud: ${error.message || 'Falha na comunicação'}.`);
    } finally {
      setIsSearchingProcess(false);
    }
  };

  const getProcesso = (id: string) => {
    return state.processos.find(p => p.id === id);
  };

  const getProcessoNumero = (id: string) => {
    const proc = getProcesso(id);
    return proc ? formatCNJ(proc.numero) : 'Processo não encontrado';
  };

  const getUsuarioNome = (id: string) => {
    const user = state.usuarios.find(u => u.id === id);
    return user ? user.nome : 'Usuário não encontrado';
  };

  const filteredMovimentos = state.movimentos.filter(m => {
    const isGlobal = m.escritorioId?.toLowerCase() === 'x';
    if (escritorioAtivoId && m.escritorioId !== escritorioAtivoId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && !(currentUser?.escritoriosIds || []).includes(m.escritorioId)) return false;
    
    // Filter only active processes
    const proc = getProcesso(m.processoId);
    if (!proc || proc.status !== 'Ativo') return false;
    
    return m.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || 
           getProcessoNumero(m.processoId).toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const totalPages = Math.ceil(filteredMovimentos.length / itemsPerPage);
  const currentItems = filteredMovimentos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when searching
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleOpenModal = (mode: ModalMode, movimento: Movimento) => {
    setModalMode(mode);
    setSelectedMovimento(movimento);
    setFormData({
      id: movimento.id || '',
      processoId: movimento.processoId || '',
      data: movimento.data || '',
      descricao: movimento.descricao || '',
      pagina: movimento.pagina || '',
      usuarioId: movimento.usuarioId || '',
      escritorioId: movimento.escritorioId || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovimento) return;

    updateMovimento({
      ...selectedMovimento,
      data: formData.data,
      descricao: formData.descricao,
      pagina: formData.pagina,
      usuarioId: formData.usuarioId
    });
    
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta movimentação?')) {
      deleteMovimento(id);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text flex items-center">
            <Activity className="mr-3 text-primary" />
            Movimentações Processuais
          </h1>
          <p className="text-xs text-app-text-muted mt-1">
            Gerencie movimentações cadastradas ou consulte a linha do tempo oficial via Datajud.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-app-secondary p-1 rounded-xl border border-app-border">
          <button
            onClick={() => setActiveMainTab('lista')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeMainTab === 'lista'
                ? 'bg-app-surface text-primary shadow-sm'
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            <Activity size={14} />
            Movimentações Cadastradas
          </button>
          <button
            onClick={() => setActiveMainTab('pesquisa')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeMainTab === 'pesquisa'
                ? 'bg-app-surface text-primary shadow-sm'
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            <Search size={14} />
            Pesquisa Movimentos
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeMainTab === 'lista' ? (
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
          <div className="p-4 border-b border-app-border flex items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
              <input 
                type="text" 
                placeholder="Buscar por descrição ou número do processo..." 
                className="w-full pl-10 pr-4 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-app-secondary text-app-text-muted text-sm uppercase tracking-wider">
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Processo</th>
                  <th className="p-4 font-medium">Movimentação</th>
                  <th className="p-4 font-medium">Responsável</th>
                  <th className="p-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {currentItems.map((mov, idx) => {
                  const proc = getProcesso(mov.processoId);
                  return (
                    <tr key={mov.id || idx} className="hover:bg-app-bg transition-colors group">
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-app-text-muted">
                           <Calendar size={14} className="mr-2 text-app-text-muted" />
                           {formatDate(mov.data)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div 
                          className="text-sm font-medium text-primary cursor-pointer hover:underline"
                          onClick={() => {
                            if (proc) {
                              setSelectedProcessId(proc.id);
                              window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                            }
                          }}
                        >
                          {proc ? formatCNJ(proc.numero) : 'N/A'}
                        </div>
                        {proc?.titulo && (
                          <div className="text-xs text-app-text-muted truncate max-w-[200px]">
                            {proc.titulo}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-app-text max-w-xl line-clamp-2">
                          {mov.descricao}
                        </div>
                        {mov.pagina && (
                          <div className="flex items-center mt-1 text-[10px] text-app-text-muted">
                            <FileText size={10} className="mr-1" />
                            Página {mov.pagina}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center text-sm text-app-text-muted">
                          <User size={14} className="mr-2 text-app-text-muted" />
                          {mov.usuarioId ? getUsuarioNome(mov.usuarioId) : 'N/A'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleOpenModal('view', mov)}
                            className="p-1.5 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Visualizar"
                          >
                            <Eye size={18} />
                          </button>
                          {(canEdit || (currentUser?.id && mov.usuarioId === currentUser.id)) && (
                            <button 
                              onClick={() => handleOpenModal('edit', mov)}
                              className="p-1.5 text-app-text-muted hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {(canDelete || (currentUser?.id && mov.usuarioId === currentUser.id)) && (
                            <button 
                              onClick={() => handleDelete(mov.id)}
                              className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
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
                {filteredMovimentos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-app-text-muted">
                      Nenhuma movimentação encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-app-border flex items-center justify-between bg-app-secondary/30">
              <div className="text-sm text-app-text-muted">
                Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredMovimentos.length)}</span> de <span className="font-medium">{filteredMovimentos.length}</span> resultados
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-app-border rounded-md text-sm font-medium text-app-text bg-app-surface hover:bg-app-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 2 + i;
                      if (pageNum + (5 - i - 1) > totalPages) {
                        pageNum = totalPages - 5 + i + 1;
                      }
                    }
                    if (pageNum > totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-primary text-white'
                            : 'text-app-text bg-app-surface border border-app-border hover:bg-app-bg'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-app-border rounded-md text-sm font-medium text-app-text bg-app-surface hover:bg-app-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: Pesquisa Movimentos (Linha do Tempo Datajud) */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Painel de Busca Lateral */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-app-surface p-5 rounded-2xl shadow-sm border border-app-border space-y-4">
              <h2 className="font-semibold text-app-text flex items-center gap-2">
                <Search size={18} className="text-primary" />
                Busca de Processo
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Tribunal / Endpoint</label>
                  <select
                    value={selectedTribunal}
                    onChange={(e) => setSelectedTribunal(e.target.value)}
                    className="w-full mt-1 p-3 bg-app-bg border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="auto">Busca Automática (Todos os TJs + TRF1)</option>
                    {TRIBUNALS_LIST.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Número do Processo (CNJ)</label>
                  <input
                    type="text"
                    placeholder="Ex: 15000156520218260451"
                    value={searchProcessTerm}
                    onChange={(e) => setSearchProcessTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchDatajud(); }}
                    className="w-full mt-1 p-3 bg-app-bg border border-app-border rounded-xl text-sm font-mono text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <button
                  onClick={() => handleSearchDatajud()}
                  disabled={isSearchingProcess}
                  className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 shadow-sm"
                >
                  {isSearchingProcess ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                  Consultar Linha do Tempo
                </button>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/10 text-primary p-5 rounded-2xl shadow-sm">
              <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                <Info size={16} /> Linha do Tempo Datajud
              </h3>
              <p className="text-app-text-muted text-xs leading-relaxed">
                Consulte as movimentações registradas oficialmente nos diários e sistemas dos tribunais (CNJ Datajud) e importe para o sistema em um clique.
              </p>
            </div>
          </div>

          {/* Painel de Resultados & Linha do Tempo */}
          <div className="lg:col-span-3 space-y-4">
            {apiError && (
              <div className="p-4 rounded-xl flex items-start gap-3 border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="font-bold text-sm">Aviso da API</p>
                  <p className="text-xs mt-1">{apiError}</p>
                </div>
              </div>
            )}

            {searchResults.length === 0 ? (
              <div className="bg-app-surface border-2 border-dashed border-app-border rounded-2xl p-12 text-center">
                <div className="bg-app-bg w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-app-border">
                  <Gavel size={32} className="text-app-text-muted/30" />
                </div>
                <h3 className="text-lg font-semibold text-app-text">Pesquisa de Linha do Tempo Processual</h3>
                <p className="text-app-text-muted max-w-sm mx-auto mt-2 text-sm">
                  Insira o número do processo (CNJ) ao lado para visualizar toda a linha do tempo de movimentações no Datajud.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {searchResults.map((proc, idx) => {
                  const matchingProcess = state.processos.find(
                    p => p.numero.replace(/\D/g, '') === proc.numeroProcesso.replace(/\D/g, '')
                  );

                  return (
                    <motion.div
                      key={proc.id + idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-app-surface p-6 rounded-2xl shadow-sm border border-app-border space-y-6"
                    >
                      {/* Process Header */}
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-app-border">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold uppercase rounded-full tracking-wider">
                              {proc.tribunal}
                            </span>
                            <span className="text-lg font-mono font-bold text-app-text">
                              {formatCNJ(proc.numeroProcesso)}
                            </span>
                            {matchingProcess ? (
                              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-full flex items-center gap-1">
                                <CheckCircle2 size={12} /> Processo Cadastrado
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold rounded-full">
                                Não Cadastrado
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-app-text-muted flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span><strong>Classe:</strong> {proc.classe}</span>
                            <span><strong>Órgão Julgador:</strong> {proc.orgaoJulgador}</span>
                            <span><strong>Ajuizamento:</strong> {formatDatajudDate(proc.dataAjuizamento)}</span>
                          </div>
                        </div>

                        {!matchingProcess && (
                          <button
                            onClick={() => {
                              setSelectedProcessoParaAdicionar(proc);
                              setIsProcessoModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 transition-all shrink-0"
                          >
                            <Plus size={14} /> Cadastrar Processo
                          </button>
                        )}
                      </div>

                      {/* Timeline Section */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Activity size={18} className="text-primary" />
                            <h3 className="font-bold text-app-text text-base">Linha do Tempo Processual</h3>
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">
                              {proc.movimentacoes.length} eventos
                            </span>
                          </div>
                        </div>

                        {proc.movimentacoes && proc.movimentacoes.length > 0 ? (
                          <div className="relative pl-4">
                            {/* Vertical Line */}
                            <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary via-app-border to-app-border" />

                            <div className="space-y-6">
                              {proc.movimentacoes.map((mov: any, mIdx: number) => {
                                const isFirst = mIdx === 0;

                                return (
                                  <motion.div
                                    key={mIdx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: mIdx * 0.02 }}
                                    className="relative pl-10"
                                  >
                                    {/* Dot */}
                                    <div className={`absolute left-0 top-1 w-[10px] h-[10px] rounded-full z-10 ring-4 ring-app-surface ${
                                      isFirst ? 'bg-primary scale-125' : 'bg-app-border'
                                    }`} />

                                    <div className={`p-4 rounded-xl border transition-all ${
                                      isFirst 
                                        ? 'bg-primary/5 border-primary/20 shadow-sm' 
                                        : 'bg-app-bg border-app-border'
                                    }`}>
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                          <Calendar size={12} className="text-primary" />
                                          <span className="text-xs font-bold text-app-text">
                                            {formatDatajudDate(mov.data)}
                                          </span>
                                          {formatDatajudTime(mov.data) && (
                                            <span className="text-[10px] text-app-text-muted bg-app-secondary px-1.5 py-0.5 rounded">
                                              {formatDatajudTime(mov.data)}
                                            </span>
                                          )}
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                          {isFirst && (
                                            <span className="text-[9px] font-bold bg-primary text-white px-2 py-0.5 rounded uppercase tracking-wider">
                                              Último Evento
                                            </span>
                                          )}

                                          <button
                                            onClick={() => {
                                              if (matchingProcess) {
                                                setInitialMovimentoData({
                                                  processoId: matchingProcess.id,
                                                  data: convertToIsoDate(mov.data),
                                                  descricao: mov.descricao
                                                });
                                                setIsMovimentoModalOpen(true);
                                              } else {
                                                setSelectedProcessoParaAdicionar(proc);
                                                setIsProcessoModalOpen(true);
                                              }
                                            }}
                                            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors"
                                            title="Importar esta movimentação para as movimentações cadastradas"
                                          >
                                            <Plus size={12} /> Importar Movimento
                                          </button>
                                        </div>
                                      </div>

                                      <h4 className={`text-sm font-bold ${isFirst ? 'text-primary' : 'text-app-text'}`}>
                                        {mov.descricao}
                                      </h4>

                                      {mov.complementos && mov.complementos.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          {mov.complementos.map((comp: string, cIdx: number) => (
                                            <div key={cIdx} className="flex items-center gap-1 bg-app-surface px-2 py-0.5 rounded border border-app-border">
                                              <Info size={10} className="text-app-text-muted" />
                                              <span className="text-[10px] text-app-text-muted italic">
                                                {comp}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-app-bg rounded-xl border border-dashed border-app-border">
                            <p className="text-sm text-app-text-muted italic">Nenhuma movimentação encontrada na linha do tempo.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit/View Movimento Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={modalMode === 'view' ? 'Visualizar Movimentação' : 'Editar Movimentação'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-app-text-muted uppercase">Processo</label>
              <div className="px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text-muted text-sm italic">
                {getProcessoNumero(formData.processoId)}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-app-text-muted uppercase">Data</label>
              <input 
                type="date" 
                disabled={modalMode === 'view'}
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                value={formData.data}
                onChange={e => setFormData({...formData, data: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-app-text-muted uppercase">Movimentação / Descrição</label>
            <textarea 
              rows={6}
              disabled={modalMode === 'view'}
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text resize-none"
              value={formData.descricao}
              onChange={e => setFormData({...formData, descricao: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-app-text-muted uppercase">Responsável</label>
              <select 
                disabled={modalMode === 'view'}
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                value={formData.usuarioId}
                onChange={e => setFormData({...formData, usuarioId: e.target.value})}
              >
                <option value="">Selecione um Responsável</option>
                {state.usuarios
                  .filter(u => !escritorioAtivoId || (u.escritoriosIds || []).includes(escritorioAtivoId))
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-app-text-muted uppercase">Página</label>
              <input 
                type="text" 
                disabled={modalMode === 'view'}
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-app-bg disabled:text-app-text-muted text-sm bg-app-surface text-app-text"
                value={formData.pagina}
                onChange={e => setFormData({...formData, pagina: e.target.value})}
                placeholder="Ex: 142"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-app-border">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-app-text-muted hover:text-app-text transition-colors"
            >
              {modalMode === 'view' ? 'Fechar' : 'Cancelar'}
            </button>
            {modalMode === 'view' && (canEdit || (currentUser?.id && selectedMovimento?.usuarioId === currentUser.id)) && (
              <button
                type="button"
                onClick={() => setModalMode('edit')}
                className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Editar
              </button>
            )}
            {modalMode === 'edit' && (
              <button
                type="submit"
                className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Salvar Alterações
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* Create Processo Modal */}
      <CreateProcessoModal
        isOpen={isProcessoModalOpen}
        onClose={() => setIsProcessoModalOpen(false)}
        initialData={selectedProcessoParaAdicionar ? {
          numero: selectedProcessoParaAdicionar.numeroProcesso,
          titulo: `${selectedProcessoParaAdicionar.classe} - ${selectedProcessoParaAdicionar.orgaoJulgador}`,
          classe: selectedProcessoParaAdicionar.classe,
          orgaoJulgador: selectedProcessoParaAdicionar.orgaoJulgador,
          dataAjuizamento: selectedProcessoParaAdicionar.dataAjuizamento,
          tribunal: selectedProcessoParaAdicionar.tribunal
        } : undefined}
      />

      {/* Create Movimento Modal */}
      <CreateMovimentoModal
        isOpen={isMovimentoModalOpen}
        onClose={() => setIsMovimentoModalOpen(false)}
        initialData={initialMovimentoData}
      />
    </div>
  );
}

