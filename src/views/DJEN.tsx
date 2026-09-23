import React, { useState, useEffect } from 'react';
import { Search, Bell, Calendar, FileText, ExternalLink, RefreshCw, AlertCircle, CheckCircle2, Filter, Info, Gavel, Database, Activity, Tag, Plus } from 'lucide-react';
import { useAppContext } from '../context';
import { formatDate } from '../utils/date';
import { motion, AnimatePresence } from 'motion/react';
import { searchDatajud } from '../services/djenService';
import { CreateProcessoModal } from '../components/CreateModals';

interface Movimentacao {
  data: string;
  descricao: string;
  complementos?: string[];
}

interface ProjudiData {
  numero_processo: string;
  vara: string;
  movimentacoes: {
    data: string;
    descricao: string;
  }[];
}

interface Parte {
  nome: string;
  tipoPolo: string;
}

interface ProcessoMetadata {
  id: string;
  numeroProcesso: string;
  classe: string;
  tribunal: string;
  dataAjuizamento: string;
  orgaoJulgador: string;
  orgaoJulgadorCodigo?: number;
  ultimaMovimentacao?: string;
  status: string;
  link?: string;
  movimentacoes?: Movimentacao[];
  sistema?: string;
  formato?: string;
  assuntos?: string[];
  valorCausa?: number;
  partes?: Parte[];
  projudiData?: ProjudiData;
  duracaoDias?: number;
}

interface VaraStats {
  totalProcessos: number;
  julgados: number;
  pendentes: number;
  mediaDiasJulgamento: number;
  assuntosMaisComuns: { nome: string; count: number }[];
  classesMaisComuns: { nome: string; count: number }[];
}

const DJEN: React.FC = () => {
  const { state, escritorioAtivoId, isAdmin, setSelectedProcessId, hasPermission } = useAppContext();
  const canWrite = hasPermission('djen', 'write');
  const canDelete = hasPermission('djen', 'delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [processos, setProcessos] = useState<ProcessoMetadata[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'metadata' | 'movements' | 'projudi' | 'stats' | 'pdpj'>('metadata');
  const [varaStats, setVaraStats] = useState<VaraStats | null>(null);
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  const [selectedTribunal, setSelectedTribunal] = useState<string>('auto');
  const [isProcessoModalOpen, setIsProcessoModalOpen] = useState(false);
  const [selectedProcessoParaAdicionar, setSelectedProcessoParaAdicionar] = useState<any>(null);

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
  
  const activeProcessos = state.processos.filter(p => {
    if (p.status !== 'Ativo') return false;
    if (!isAdmin() && escritorioAtivoId && p.escritorioId !== escritorioAtivoId) {
      return false;
    }
    return true;
  });

  const fetchProjudiData = async (numeroProcesso: string) => {
    try {
      const response = await fetch('/api/projudi/consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_processo: numeroProcesso })
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error('Erro ao buscar dados Projudi:', e);
    }
    return null;
  };

  const fetchVaraStats = async (codigoVara: number, tribunal: string) => {
    setIsFetchingStats(true);
    try {
      const query = {
        size: 500,
        query: {
          bool: {
            should: [
              { term: { "orgaoJulgador.codigo": codigoVara } },
              { match: { "orgaoJulgador.codigo": codigoVara } }
            ]
          }
        },
        sort: [{ "dataAjuizamento": { "order": "desc" } }]
      };
      
      const result = await searchDatajud(query, tribunal);
      const hits = result.hits?.hits || [];
      
      if (hits.length > 0) {
        const processosVara = hits.map((h: any) => h._source);
        
        const termosJulgados = ['definitivo', 'baixa definitiva', 'baixa', 'improcedência', 'procedência', 'extinção', 'desistência', 'sentença'];
        
        let julgadosCount = 0;
        let totalDias = 0;
        const assuntosMap: Record<string, number> = {};
        const classesMap: Record<string, number> = {};
        
        processosVara.forEach((p: any) => {
          const situacao = p.movimentos?.[0]?.nome?.toLowerCase() || '';
          const isJulgado = termosJulgados.some(term => situacao.includes(term));
          
          if (isJulgado) {
            julgadosCount++;
            if (p.dataAjuizamento && p.movimentos?.[0]?.dataHora) {
              const inicio = new Date(p.dataAjuizamento);
              const fim = new Date(p.movimentos[0].dataHora);
              const diff = Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
              if (diff > 0) totalDias += diff;
            }
          }
          
          p.assuntos?.forEach((a: any) => {
            assuntosMap[a.nome] = (assuntosMap[a.nome] || 0) + 1;
          });
          
          if (p.classe?.nome) {
            classesMap[p.classe.nome] = (classesMap[p.classe.nome] || 0) + 1;
          }
        });
        
        setVaraStats({
          totalProcessos: hits.length,
          julgados: julgadosCount,
          pendentes: hits.length - julgadosCount,
          mediaDiasJulgamento: julgadosCount > 0 ? Math.floor(totalDias / julgadosCount) : 0,
          assuntosMaisComuns: Object.entries(assuntosMap)
            .map(([nome, count]) => ({ nome, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
          classesMaisComuns: Object.entries(classesMap)
            .map(([nome, count]) => ({ nome, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        });
      }
    } catch (e) {
      console.error('Erro ao buscar estatísticas da vara:', e);
    } finally {
      setIsFetchingStats(false);
    }
  };

  const handleSearch = async (manualTerm?: string) => {
    setIsSearching(true);
    setApiError(null);
    setVaraStats(null);
    const term = (manualTerm || searchTerm).replace(/\D/g, '');
    
    let tribunalsToTry = selectedTribunal === 'auto' ? TRIBUNALS_LIST.map(t => t.id) : [selectedTribunal];
    let allHits: any[] = [];
    let foundTribunal = '';

    try {
      for (const trib of tribunalsToTry) {
        console.log(`Tentando busca no tribunal: ${trib}`);
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
        setProcessos([]);
        return;
      }

      const mapped: ProcessoMetadata[] = await Promise.all(allHits.map(async (hit: any) => {
        const source = hit._source;
        
        // Fetch Projudi data if applicable
        let projudiData = null;
        if (source.tribunal === 'TJAM' || source.sistema?.nome === 'PROJUDI') {
          projudiData = await fetchProjudiData(source.numeroProcesso);
        }

        // Calculate duration
        let duracaoDias = 0;
        if (source.dataAjuizamento) {
          const ajuizamento = new Date(source.dataAjuizamento);
          const hoje = new Date();
          duracaoDias = Math.floor((hoje.getTime() - ajuizamento.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Fetch stats if we have vara code
        if (source.orgaoJulgador?.codigo) {
          fetchVaraStats(source.orgaoJulgador.codigo, foundTribunal);
        }

        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startDate = thirtyDaysAgo.toISOString().split('T')[0];
        const comunicaLink = `https://comunica.pje.jus.br/consulta?dataDisponibilizacaoInicio=${startDate}&dataDisponibilizacaoFim=${today}&numeroProcesso=${source.numeroProcesso}`;

        return {
          id: hit._id || Math.random().toString(36).substr(2, 9),
          numeroProcesso: source.numeroProcesso,
          classe: source.classe?.nome || 'N/A',
          tribunal: source.tribunal || 'TJAM',
          dataAjuizamento: source.dataAjuizamento || 'N/A',
          orgaoJulgador: source.orgaoJulgador?.nome || 'N/A',
          orgaoJulgadorCodigo: source.orgaoJulgador?.codigo,
          ultimaMovimentacao: source.movimentos?.[0]?.nome || 'N/A',
          status: 'Ativo',
          link: comunicaLink,
          sistema: source.sistema?.nome,
          formato: source.formato?.nome,
          assuntos: source.assuntos?.map((a: any) => a.nome) || [],
          valorCausa: source.valorCausa,
          partes: source.partes?.map((p: any) => ({
            nome: p.nome,
            tipoPolo: p.tipoPolo
          })),
          projudiData: projudiData,
          duracaoDias: duracaoDias,
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
      }));
      setProcessos(mapped);
    } catch (error: any) {
      console.error('Erro na busca real Datajud:', error);
      setApiError(`Erro na API: ${error.message}.`);
    } finally {
      setIsSearching(false);
    }
  };

  const formatDatajudDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    
    // Se for formato ISO ou tiver hífens/T (ex: 2024-03-20T...)
    if (dateStr.includes('-') || dateStr.includes('T')) {
      const parts = dateStr.split('T')[0].split(' ')[0].split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        if (year.length === 4) return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
        if (day.length === 4) return `${year.padStart(2, '0')}/${month.padStart(2, '0')}/${day}`;
      }
      
      // Fallback para Date nativo
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('pt-BR');
        }
      } catch (e) {}
    }
    
    // Se for formato YYYYMMDDHHMMSS ou YYYYMMDD (apenas dígitos)
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
    
    // Formato ISO
    if (dateStr.includes('T') || dateStr.includes(':')) {
      try {
        // Se já for apenas o horário HH:mm:ss, retorna os primeiros 5
        if (dateStr.length === 8 && dateStr.split(':').length === 3) {
          return dateStr.substring(0, 5);
        }
        
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
      } catch (e) {}
    }
    
    // Formato YYYYMMDDHHMMSS (apenas dígitos)
    const digitsOnly = dateStr.replace(/\D/g, '');
    if (digitsOnly.length >= 12) {
      const hour = digitsOnly.substring(8, 10);
      const minute = digitsOnly.substring(10, 12);
      return `${hour}:${minute}`;
    }
    
    return '';
  };

  const formatCNJ = (numero: string) => {
    if (!numero) return '';
    const clean = numero.replace(/\D/g, '');
    if (clean.length !== 20) return numero;
    return `${clean.substring(0, 7)}-${clean.substring(7, 9)}.${clean.substring(9, 13)}.${clean.substring(13, 14)}.${clean.substring(14, 16)}.${clean.substring(16, 20)}`;
  };

  const formatProjudiDate = (dateStr: string) => {
    if (!dateStr || dateStr.length < 14) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(8, 10);
    const minute = dateStr.substring(10, 12);
    const second = dateStr.substring(12, 14);
    return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-app-text tracking-tight uppercase">Módulo Datajud Multi-Tribunal</h1>
          <p className="text-app-text-muted mt-1 underline">Busca atualizada com novos endpoints estaduais (TJs)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Painel de Busca */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-app-surface p-5 rounded-2xl shadow-sm border border-app-border space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-app-text flex items-center gap-2">
                <Search size={18} className="text-primary" />
                Busca por Processo
              </h2>
            </div>
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
                <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Número do Processo</label>
                <input
                  type="text"
                  placeholder="Ex: 15000156520218260451"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full mt-1 p-3 bg-app-bg border border-app-border rounded-xl text-sm font-mono text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                onClick={() => handleSearch()}
                disabled={isSearching}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 shadow-sm"
              >
                {isSearching ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                Consultar Datajud
              </button>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/10 text-primary p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-2">Busca Inteligente</h3>
              <p className="text-app-text-muted text-sm leading-relaxed">
                Agora suportando todos os tribunais estaduais fornecidos via API Pública Datajud do CNJ.
              </p>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-app-secondary p-1 rounded-xl border border-app-border">
              <button
                onClick={() => setActiveTab('metadata')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'metadata' 
                    ? 'bg-app-surface text-primary shadow-sm' 
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                Metadados
              </button>
              <button
                onClick={() => setActiveTab('movements')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'movements' 
                    ? 'bg-app-surface text-primary shadow-sm' 
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                Linha do Tempo
                {processos.length > 0 && processos[0].movimentacoes && (
                  <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md text-[10px]">
                    {processos[0].movimentacoes.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'stats' 
                    ? 'bg-app-surface text-primary shadow-sm' 
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                Estatísticas
                <Activity size={14} />
              </button>
              <button
                onClick={() => setActiveTab('projudi')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'projudi' 
                    ? 'bg-app-surface text-primary shadow-sm' 
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                Projudi
                <Database size={14} />
              </button>
              <button
                onClick={() => setActiveTab('pdpj')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'pdpj' 
                    ? 'bg-app-surface text-primary shadow-sm' 
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                Portal PDPJ
                <ExternalLink size={14} />
              </button>
            </div>
            <span className="text-sm text-app-text-muted">{processos.length} registros encontrados</span>
          </div>

          {apiError && (
            <div className="p-4 rounded-xl flex items-start gap-3 border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold text-sm">Aviso da API</p>
                <p className="text-xs mt-1">{apiError}</p>
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {processos.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-app-surface border-2 border-dashed border-app-border rounded-2xl p-12 text-center"
              >
                <div className="bg-app-bg w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-app-border">
                  <Gavel size={32} className="text-app-text-muted/30" />
                </div>
                <h3 className="text-lg font-semibold text-app-text">Aguardando consulta</h3>
                <p className="text-app-text-muted max-w-xs mx-auto mt-2">
                  Insira o número do processo ao lado para buscar informações no Datajud.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {processos.map((proc, idx) => (
                  <motion.div
                    key={proc.id + idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-app-surface p-6 rounded-2xl shadow-sm border border-app-border hover:border-primary/30 transition-all group"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                      <div className="space-y-4 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold uppercase rounded-full tracking-wider">
                              {proc.tribunal}
                            </span>
                            {(() => {
                              const foundProcesso = state.processos.find(p => p.numero.replace(/\D/g, '') === proc.numeroProcesso.replace(/\D/g, ''));
                              return (
                                <span 
                                  className={`text-lg font-mono font-bold text-app-text ${foundProcesso ? 'cursor-pointer hover:underline text-primary' : ''}`}
                                  onClick={() => {
                                    if (foundProcesso) {
                                      setSelectedProcessId(foundProcesso.id);
                                      window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                                    }
                                  }}
                                >
                                  {formatCNJ(proc.numeroProcesso)}
                                </span>
                              );
                            })()}
                          </div>
                          <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-bold uppercase">
                            {proc.status}
                          </span>
                        </div>
                        
                        {activeTab === 'metadata' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-app-bg rounded-lg border border-app-border">
                                <FileText size={16} className="text-app-text-muted" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-app-text-muted uppercase">Classe Processual</p>
                                <p className="text-sm font-semibold text-app-text">{proc.classe}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-app-bg rounded-lg border border-app-border">
                                <Calendar size={16} className="text-app-text-muted" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-app-text-muted uppercase">Data de Ajuizamento</p>
                                <p className="text-sm font-semibold text-app-text">
                                  {formatDatajudDate(proc.dataAjuizamento)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-app-bg rounded-lg border border-app-border">
                                <Gavel size={16} className="text-app-text-muted" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-app-text-muted uppercase">Órgão Julgador</p>
                                <p className="text-sm font-semibold text-app-text">{proc.orgaoJulgador}</p>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-app-bg rounded-lg border border-app-border">
                                <Info size={16} className="text-app-text-muted" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-app-text-muted uppercase">Última Movimentação</p>
                                <p className="text-sm font-semibold text-app-text truncate max-w-[200px]">{proc.ultimaMovimentacao}</p>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-app-bg rounded-lg border border-app-border">
                                <Activity size={16} className="text-app-text-muted" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-app-text-muted uppercase">Duração do Processo</p>
                                <p className="text-sm font-semibold text-app-text">
                                  {proc.duracaoDias} dias em tramitação
                                </p>
                              </div>
                            </div>

                            {proc.sistema && (
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-app-bg rounded-lg border border-app-border">
                                  <RefreshCw size={16} className="text-app-text-muted" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-app-text-muted uppercase">Sistema / Formato</p>
                                  <p className="text-sm font-semibold text-app-text">{proc.sistema} ({proc.formato || 'N/A'})</p>
                                </div>
                              </div>
                            )}

                            {proc.assuntos && proc.assuntos.length > 0 && (
                              <div className="flex items-start gap-3 md:col-span-2">
                                <div className="p-2 bg-app-bg rounded-lg border border-app-border">
                                  <AlertCircle size={16} className="text-app-text-muted" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-app-text-muted uppercase">Assuntos</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {proc.assuntos.map((a, aIdx) => (
                                      <span key={aIdx} className="px-2 py-0.5 bg-app-secondary text-app-text-muted text-[10px] rounded border border-app-border">
                                        {a}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-app-bg rounded-lg border border-app-border">
                                    <Database size={16} className="text-app-text-muted" />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-app-text-muted uppercase">Valor da Causa</p>
                                    <p className="text-sm font-semibold text-app-text">
                                      {proc.valorCausa ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proc.valorCausa) : 'N/A'}
                                    </p>
                                  </div>
                                </div>

                                {proc.partes && proc.partes.length > 0 && (
                                  <div className="pt-4 border-t border-app-border">
                                    <p className="text-[10px] font-bold text-app-text-muted uppercase mb-3">Partes do Processo</p>
                                    <div className="space-y-2">
                                      {proc.partes.map((parte, pIdx) => (
                                        <div key={pIdx} className="flex items-center justify-between p-2 bg-app-bg rounded-lg border border-app-border">
                                          <span className="text-xs font-bold text-app-text truncate max-w-[250px]">{parte.nome}</span>
                                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                                            parte.tipoPolo === 'ATIVO' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                          }`}>
                                            {parte.tipoPolo}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="mt-6 pt-6 border-t border-app-border flex justify-end">
                              <button
                                onClick={() => {
                                  setSelectedProcessoParaAdicionar(proc);
                                  setIsProcessoModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl font-bold shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                              >
                                <Plus size={18} />
                                Adicionar aos Meus Processos
                              </button>
                            </div>
                          </div>
                        ) : activeTab === 'movements' ? (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold text-app-text-muted uppercase">Linha do Tempo Processual</p>
                              <div className="flex items-center gap-2 text-[10px] text-app-text-muted">
                                <div className="w-2 h-2 bg-primary rounded-full" />
                                <span>Movimentação Recente</span>
                              </div>
                            </div>
                            
                            {proc.movimentacoes && proc.movimentacoes.length > 0 ? (
                              <div className="relative pl-4">
                                {/* Vertical Line */}
                                <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary via-app-border to-app-border" />
                                
                                <div className="space-y-8">
                                  {proc.movimentacoes.map((mov, mIdx) => {
                                    const isFirst = mIdx === 0;
                                    const isLast = mIdx === proc.movimentacoes!.length - 1;
                                    
                                    return (
                                      <motion.div 
                                        key={mIdx} 
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: mIdx * 0.03 }}
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
                                              <span className="text-[10px] text-app-text-muted bg-app-secondary px-1.5 py-0.5 rounded">
                                                {formatDatajudTime(mov.data)}
                                              </span>
                                            </div>
                                            {isFirst && (
                                              <span className="text-[9px] font-bold bg-primary text-white px-2 py-0.5 rounded uppercase tracking-wider">
                                                Último Evento
                                              </span>
                                            )}
                                          </div>
                                          
                                          <h4 className={`text-sm font-bold ${isFirst ? 'text-primary' : 'text-app-text'}`}>
                                            {mov.descricao}
                                          </h4>
                                          
                                          {mov.complementos && mov.complementos.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                              {mov.complementos.map((comp, cIdx) => (
                                                <div key={cIdx} className="flex items-center gap-1.5 bg-app-surface px-2 py-1 rounded-md border border-app-border">
                                                  <Info size={10} className="text-app-text-muted" />
                                                  <span className="text-[10px] text-app-text-muted font-medium italic">
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
                              <div className="text-center py-12 bg-app-bg rounded-2xl border border-dashed border-app-border">
                                <p className="text-sm text-app-text-muted italic">Nenhuma movimentação registrada.</p>
                              </div>
                            )}
                          </div>
                        ) : activeTab === 'stats' ? (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold text-app-text-muted uppercase">Estatísticas do Órgão Julgador</p>
                              {isFetchingStats && <RefreshCw size={14} className="animate-spin text-primary" />}
                            </div>

                            {varaStats ? (
                              <div className="space-y-6">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div className="p-4 bg-app-surface border border-app-border rounded-2xl shadow-sm">
                                    <p className="text-[10px] font-bold text-app-text-muted uppercase mb-1">Volumetria</p>
                                    <p className="text-2xl font-bold text-app-text">{varaStats.totalProcessos}</p>
                                    <p className="text-xs text-app-text-muted">Processos analisados</p>
                                  </div>
                                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl shadow-sm">
                                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Taxa de Julgamento</p>
                                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                                      {Math.round((varaStats.julgados / varaStats.totalProcessos) * 100)}%
                                    </p>
                                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">{varaStats.julgados} processos baixados</p>
                                  </div>
                                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl shadow-sm">
                                    <p className="text-[10px] font-bold text-primary uppercase mb-1">Tempo Médio</p>
                                    <p className="text-2xl font-bold text-primary">{varaStats.mediaDiasJulgamento}</p>
                                    <p className="text-xs text-primary/70">Dias para sentença</p>
                                  </div>
                                </div>

                                {/* Charts/Lists */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-app-text-muted uppercase flex items-center gap-2">
                                      <Tag size={14} />
                                      Assuntos mais frequentes
                                    </h4>
                                    <div className="space-y-2">
                                      {varaStats.assuntosMaisComuns.map((a, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 bg-app-bg rounded-lg border border-app-border">
                                          <span className="text-xs text-app-text font-medium truncate max-w-[200px]">{a.nome}</span>
                                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{a.count}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-app-text-muted uppercase flex items-center gap-2">
                                      <FileText size={14} />
                                      Classes mais frequentes
                                    </h4>
                                    <div className="space-y-2">
                                      {varaStats.classesMaisComuns.map((c, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 bg-app-bg rounded-lg border border-app-border">
                                          <span className="text-xs text-app-text font-medium truncate max-w-[200px]">{c.nome}</span>
                                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{c.count}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl">
                                  <div className="flex items-start gap-3">
                                    <Info className="text-amber-600 shrink-0 mt-0.5" size={16} />
                                    <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                                      As estatísticas são baseadas nos últimos 500 processos distribuídos neste órgão julgador. 
                                      A taxa de julgamento considera movimentações de baixa, sentença ou arquivamento.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-12 bg-app-bg rounded-2xl border border-dashed border-app-border">
                                {isFetchingStats ? (
                                  <div className="flex flex-col items-center gap-3">
                                    <RefreshCw size={32} className="animate-spin text-primary/30" />
                                    <p className="text-sm text-app-text-muted">Analisando volumetria da vara...</p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-app-text-muted italic">Dados estatísticos não disponíveis para este órgão.</p>
                                )}
                              </div>
                            )}
                          </div>
                        ) : activeTab === 'projudi' ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold text-app-text-muted uppercase">Dados Estruturados Projudi</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase">Sistema: {proc.sistema || 'PROJUDI'}</span>
                                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded font-bold uppercase">Status: {proc.status}</span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Card Principal */}
                              <div className="p-4 bg-app-surface border border-app-border rounded-xl shadow-sm space-y-3">
                                <div className="space-y-1">
                                  <p className="text-[9px] font-bold text-app-text-muted uppercase">Órgão Julgador</p>
                                  <p className="text-xs font-bold text-app-text leading-tight">
                                    {proc.orgaoJulgador}
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-app-text-muted uppercase">Data Ajuizamento</p>
                                    <p className="text-[11px] font-medium text-app-text">
                                      {formatDatajudDate(proc.dataAjuizamento)}
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-app-text-muted uppercase">Valor da Causa</p>
                                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                      {proc.valorCausa ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proc.valorCausa) : 'N/A'}
                                    </p>
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-app-border">
                                  <p className="text-[9px] font-bold text-app-text-muted uppercase mb-1">Classe Processual</p>
                                  <p className="text-[11px] text-app-text-muted">{proc.classe}</p>
                                </div>
                              </div>

                              {/* Card Partes */}
                              <div className="p-4 bg-app-bg border border-app-border rounded-xl space-y-4">
                                {proc.partes && proc.partes.length > 0 ? (
                                  <div className="space-y-3">
                                    {proc.partes.filter(p => p.tipoPolo === 'ATIVO').length > 0 && (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                                          <p className="text-[9px] font-bold text-app-text-muted uppercase">Polo Ativo</p>
                                        </div>
                                        {proc.partes.filter(p => p.tipoPolo === 'ATIVO').map((p, i) => (
                                          <p key={i} className="text-xs font-bold text-app-text pl-3.5 truncate">{p.nome}</p>
                                        ))}
                                      </div>
                                    )}
                                    {proc.partes.filter(p => p.tipoPolo === 'PASSIVO').length > 0 && (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                          <p className="text-[9px] font-bold text-app-text-muted uppercase">Polo Passivo</p>
                                        </div>
                                        {proc.partes.filter(p => p.tipoPolo === 'PASSIVO').map((p, i) => (
                                          <p key={i} className="text-xs font-bold text-app-text pl-3.5 truncate">{p.nome}</p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-app-text-muted italic">Partes não informadas</p>
                                )}
                                
                                <div className="pt-2 border-t border-app-border">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-bold text-app-text-muted uppercase">Segredo de Justiça</p>
                                    <span className="text-[10px] font-bold text-app-text-muted">N/A</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {proc.projudiData && proc.projudiData.vara && (
                              <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-3">
                                <div className="flex items-center gap-2">
                                  <Gavel size={14} className="text-primary" />
                                  <p className="text-[10px] font-bold text-primary uppercase">Dados do WebService Projudi</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-app-text-muted uppercase">Vara</p>
                                    <p className="text-xs font-bold text-app-text">{proc.projudiData.vara}</p>
                                  </div>
                                  {proc.projudiData.movimentacoes && proc.projudiData.movimentacoes.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-[9px] font-bold text-app-text-muted uppercase">Movimentações Recentes</p>
                                      <div className="space-y-2">
                                        {proc.projudiData.movimentacoes.map((m, idx) => (
                                          <div key={idx} className="p-2 bg-app-surface rounded border border-primary/10">
                                            <p className="text-[10px] font-bold text-primary">{m.data}</p>
                                            <p className="text-[11px] text-app-text">{m.descricao}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* XML Toggle (Opcional/Minimizado) */}
                            <details className="group">
                              <summary className="text-[10px] font-bold text-primary cursor-pointer hover:underline list-none flex items-center gap-1">
                                <FileText size={12} />
                                Ver Resposta XML Bruta
                              </summary>
                              <div className="mt-2 p-3 bg-gray-900 rounded-lg font-mono text-[9px] text-emerald-400 overflow-x-auto border border-gray-800">
                                <pre>{`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webservice.projudi.tjam.jus.br/">
   <soapenv:Header/>
   <soapenv:Body>
      <web:obterDadosProcessoResponse>
         <processo>
            <numero>${proc.numeroProcesso}</numero>
            <classe>${proc.classe}</classe>
            <tribunal>${proc.tribunal}</tribunal>
            <dataAjuizamento>${proc.dataAjuizamento}</dataAjuizamento>
            <orgaoJulgador>${proc.orgaoJulgador}</orgaoJulgador>
            <sistemaOrigem>PROJUDI</sistemaOrigem>
            <status>${proc.status}</status>
            <segredoJustica>Não</segredoJustica>
            <valorCausa>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proc.valorCausa || 0)}</valorCausa>
            <partes>
               ${(proc.partes || []).map((p) => `
                 <parte>
                   <nome>${p.nome}</nome>
                   <tipoPolo>${p.tipoPolo}</tipoPolo>
                 </parte>`).join('')}
            </partes>
         </processo>
      </web:obterDadosProcessoResponse>
   </soapenv:Body>
</soapenv:Envelope>`}</pre>
                              </div>
                            </details>

                            <div className="p-2 bg-primary/5 border border-primary/10 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Database size={12} className="text-primary/60" />
                                <span className="text-[9px] font-bold text-primary/60 uppercase">WSDL TJAM</span>
                              </div>
                              <a 
                                href="https://projudi.tjam.jus.br/projudi/webservices/consultaProcessualWebService?wsdl" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[9px] text-primary/60 hover:underline truncate max-w-[200px]"
                              >
                                consultaProcessualWebService?wsdl
                              </a>
                            </div>
                          </div>
                        ) : activeTab === 'pdpj' ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold text-app-text-muted uppercase">Portal de Serviços PDPJ</p>
                              <a 
                                href={`https://portaldeservicos.pdpj.jus.br/consulta?processo=${proc.numeroProcesso}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                              >
                                Abrir em nova aba <ExternalLink size={10} />
                              </a>
                            </div>
                            <div className="w-full h-[600px] bg-app-bg rounded-xl border border-app-border overflow-hidden relative">
                              <iframe
                                src={`https://portaldeservicos.pdpj.jus.br/consulta?processo=${proc.numeroProcesso}`}
                                className="w-full h-full border-0"
                                title="Consulta PDPJ"
                                sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation"
                                allow="clipboard-read; clipboard-write; geolocation; microphone; camera"
                              />
                            </div>
                          </div>
                        ) : null}

                        <div className="flex items-center gap-4 pt-4 border-t border-gray-50 dark:border-slate-800">
                          {proc.link && (
                            <a 
                              href={proc.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                            >
                              <ExternalLink size={14} />
                              Ver no Portal {proc.tribunal}
                            </a>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedProcessoParaAdicionar({
                                numero: proc.numeroProcesso,
                                tribunal: proc.tribunal,
                                classe: proc.classe,
                                assunto: proc.assuntos?.join(', ') || '',
                                valorCausa: proc.valorCausa,
                                dataDistribuicao: proc.dataAjuizamento ? proc.dataAjuizamento.split('T')[0] : '',
                                status: 'Ativo'
                              });
                              setIsProcessoModalOpen(true);
                            }}
                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                          >
                            <CheckCircle2 size={14} />
                            Adicionar aos Meus Processos
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* Modals */}
      <CreateProcessoModal 
        isOpen={isProcessoModalOpen} 
        onClose={() => setIsProcessoModalOpen(false)} 
        initialData={selectedProcessoParaAdicionar}
      />
    </div>
  );
};

export default DJEN;
