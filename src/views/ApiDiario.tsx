
import React, { useState, useEffect } from 'react';
import { Search, Calendar, CalendarPlus, FileText, AlertCircle, ExternalLink, Download, RefreshCw, Printer, Copy, User, ListTodo, UserPlus, FolderPlus, Activity, Eye, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context';
import TaskModal from '../components/TaskModal';
import { CreateContatoModal, CreateProcessoModal, CreateMovimentoModal, CreateEventoModal } from '../components/CreateModals';
import { Tarefa } from '../types';
import { getTodayInTimezone } from '../utils/date';

export default function ApiDiario() {
  const { state, escritorioAtivoId, currentUser, setSelectedProcessId, setViewParams } = useAppContext();
  const today = getTodayInTimezone(state.settings.timezone);
  const [activeTab, setActiveTab] = useState<'processo' | 'oab' | 'nome' | 'novos_processos'>('processo');

  // Handle incoming view params for initial tab
  useEffect(() => {
    if (state.viewParams?.tab) {
      setActiveTab(state.viewParams.tab);
      // Clear params after consuming
      setViewParams(null);
    }
  }, [state.viewParams, setViewParams]);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [initialTaskData, setInitialTaskData] = useState<Partial<Tarefa> | null>(null);

  const [isContatoModalOpen, setIsContatoModalOpen] = useState(false);
  const [initialContatoData, setInitialContatoData] = useState<any>(null);

  const [isProcessoModalOpen, setIsProcessoModalOpen] = useState(false);
  const [initialProcessoData, setInitialProcessoData] = useState<any>(null);

  const [isMovimentoModalOpen, setIsMovimentoModalOpen] = useState(false);
  const [initialMovimentoData, setInitialMovimentoData] = useState<any>(null);

  const [isEventoModalOpen, setIsEventoModalOpen] = useState(false);
  const [initialEventoData, setInitialEventoData] = useState<any>(null);

  const [formData, setFormData] = useState({
    numeroProcesso: '',
    dataInicio: today,
    dataFim: today
  });

  const [oabFormData, setOabFormData] = useState({
    numeroOab: '',
    ufOab: '',
    dataInicio: today,
    dataFim: today
  });

  const [nomeFormData, setNomeFormData] = useState({
    nomeAdvogado: '',
    dataInicio: today,
    dataFim: today
  });

  const [novosProcessosFormData, setNovosProcessosFormData] = useState({
    dataInicio: today,
    dataFim: today
  });


  // Pre-fill OAB/UF and Lawyer Name from office profile or current user
  useEffect(() => {
    const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
    const oab = activeOffice?.oab || currentUser?.oab || '';
    const uf = activeOffice?.uf || '';
    const responsavel = activeOffice?.responsavel || currentUser?.nome || '';
    
    setOabFormData(prev => ({
      ...prev,
      numeroOab: oab,
      ufOab: uf.toLowerCase()
    }));

    setNomeFormData(prev => ({
      ...prev,
      nomeAdvogado: responsavel
    }));
  }, [escritorioAtivoId, state.escritorios, currentUser]);

  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const formatCNJ = (numero: string) => {
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
  };

  const FormattedText = ({ content, className }: { content: string, className?: string }) => {
    if (!content) return null;
    const hasHtml = /<[a-z][\s\S]*>/i.test(content);
    
    const containerClasses = `${className || ''} max-h-80 overflow-y-auto pr-2 custom-scrollbar`;
    const highlightRegex = /(prazo\b[^\.\n]{1,50}?\b(?:dias|dia|horas|hora|legal|de lei|regimental)(?:\s+(?:úteis|corridos))?|(?:data:\s*)?\d{2}\/\d{2}\/\d{4}\b[^\.\n]{0,35}?\b(?:hora|horário|hrs|h)?\s*:?\s*\d{2}[:h]\d{2}(?:h|min)?)/gi;
    const isHighlightMatch = (partStr: string) => /^(?:prazo\b[^\.\n]{1,50}?\b(?:dias|dia|horas|hora|legal|de lei|regimental)(?:\s+(?:úteis|corridos))?|(?:data:\s*)?\d{2}\/\d{2}\/\d{4}\b[^\.\n]{0,35}?\b(?:hora|horário|hrs|h)?\s*:?\s*\d{2}[:h]\d{2}(?:h|min)?)$/i.test(partStr.trim());

    if (hasHtml) {
      const highlightedHtml = content.replace(
        highlightRegex,
        (match) => `<strong class="text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded-md">${match}</strong>`
      );
      return (
        <div 
          className={`${containerClasses} html-content`} 
          dangerouslySetInnerHTML={{ __html: highlightedHtml }} 
        />
      );
    }

    const parts = content.split(highlightRegex);
    if (parts.length <= 1) {
      return (
        <div className={containerClasses}>
          {content}
        </div>
      );
    }

    return (
      <div className={containerClasses}>
        {parts.map((part, index) => {
          if (isHighlightMatch(part)) {
            return (
              <strong key={index} className="text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded-md">
                {part}
              </strong>
            );
          }
          return part;
        })}
      </div>
    );
  };

  const handleProcessoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, numeroProcesso: formatCNJ(value) }));
  };

  const handleSearch = async (e?: React.FormEvent, page: number = 1) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    if (page === 1) setResults(null);
    setCurrentPage(page);

    let url = '';
    if (activeTab === 'processo') {
      const cleanNumero = formData.numeroProcesso.replace(/\D/g, '');
      url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=${page}&itensPorPagina=50&dataDisponibilizacaoInicio=${formData.dataInicio}&dataDisponibilizacaoFim=${formData.dataFim}&numeroProcesso=${cleanNumero}`;
    } else if (activeTab === 'oab') {
      url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=${page}&itensPorPagina=50&dataDisponibilizacaoInicio=${oabFormData.dataInicio}&dataDisponibilizacaoFim=${oabFormData.dataFim}&numeroOab=${oabFormData.numeroOab}&ufOab=${oabFormData.ufOab}`;
    } else if (activeTab === 'nome') {
      url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=${page}&itensPorPagina=50&dataDisponibilizacaoInicio=${nomeFormData.dataInicio}&dataDisponibilizacaoFim=${nomeFormData.dataFim}&nomeAdvogado=${encodeURIComponent(nomeFormData.nomeAdvogado)}`;
    } else {
      const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
      const responsavel = activeOffice?.responsavel || currentUser?.nome || 'Walber Prata de Mendonça';
      url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=${page}&itensPorPagina=5&texto=distribui%C3%A7%C3%A3o&dataDisponibilizacaoInicio=${novosProcessosFormData.dataInicio}&dataDisponibilizacaoFim=${novosProcessosFormData.dataFim}&nomeAdvogado=${encodeURIComponent(responsavel)}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Falha ao consultar a API');
      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao consultar API do Diário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-app-text tracking-tight uppercase">Consulta - DJEN</h1>
          <p className="text-app-text-muted mt-1">Consulta direta via ComunicaAPI (PJe)</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex p-1 bg-app-bg border border-app-border rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('processo')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'processo' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-app-text-muted hover:text-app-text'
          }`}
        >
          <FileText size={18} />
          Por Processo
        </button>
        <button
          onClick={() => setActiveTab('oab')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'oab' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-app-text-muted hover:text-app-text'
          }`}
        >
          <User size={18} />
          Por OAB
        </button>
        <button
          onClick={() => setActiveTab('nome')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'nome' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-app-text-muted hover:text-app-text'
          }`}
        >
          <User size={18} />
          Por Nome
        </button>
        <button
          onClick={() => setActiveTab('novos_processos')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'novos_processos' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-app-text-muted hover:text-app-text'
          }`}
        >
          <FolderPlus size={18} />
          Novos Processos
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <form onSubmit={handleSearch} className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
            <AnimatePresence mode="wait">
              {activeTab === 'processo' ? (
                <motion.div
                  key="form-processo"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Número do Processo</label>
                    <div className="mt-1 relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text focus:outline-none focus:ring-2 focus:ring-primary transition-all font-mono"
                        placeholder="0000000-00.0000.0.00.0000"
                        value={formData.numeroProcesso}
                        onChange={handleProcessoChange}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Data Início</label>
                      <div className="mt-1">
                        <input
                          type="date"
                          required
                          className="w-full px-3.5 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                          value={formData.dataInicio}
                          onChange={(e) => setFormData(prev => ({ ...prev, dataInicio: e.target.value }))}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Data Fim</label>
                      <div className="mt-1">
                        <input
                          type="date"
                          required
                          className="w-full px-3.5 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                          value={formData.dataFim}
                          onChange={(e) => setFormData(prev => ({ ...prev, dataFim: e.target.value }))}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : activeTab === 'oab' ? (
                <motion.div
                  key="form-oab"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Número OAB</label>
                      <div className="mt-1 relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                        <input
                          type="text"
                          required
                          className="w-full pl-10 pr-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text focus:outline-none focus:ring-2 focus:ring-primary transition-all font-mono"
                          placeholder="12345"
                          value={oabFormData.numeroOab}
                          onChange={(e) => setOabFormData(prev => ({ ...prev, numeroOab: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">UF</label>
                      <div className="mt-1">
                        <input
                          type="text"
                          required
                          maxLength={2}
                          className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-center focus:outline-none focus:ring-2 focus:ring-primary transition-all font-mono uppercase"
                          placeholder="SP"
                          value={oabFormData.ufOab}
                          onChange={(e) => setOabFormData(prev => ({ ...prev, ufOab: e.target.value.toLowerCase() }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Data Início</label>
                      <div className="mt-1">
                        <input
                          type="date"
                          required
                          className="w-full px-3.5 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                          value={oabFormData.dataInicio}
                          onChange={(e) => setOabFormData(prev => ({ ...prev, dataInicio: e.target.value }))}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Data Fim</label>
                      <div className="mt-1">
                        <input
                          type="date"
                          required
                          className="w-full px-3.5 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                          value={oabFormData.dataFim}
                          onChange={(e) => setOabFormData(prev => ({ ...prev, dataFim: e.target.value }))}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : activeTab === 'novos_processos' ? (
                <motion.div
                  key="form-novos"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                    <p className="text-sm text-app-text font-medium text-center">
                      Esta aba busca por novos processos distribuídos para o advogado responsável do escritório.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Data Início</label>
                      <div className="mt-1">
                        <input
                          type="date"
                          required
                          className="w-full px-3.5 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                          value={novosProcessosFormData.dataInicio}
                          onChange={(e) => setNovosProcessosFormData(prev => ({ ...prev, dataInicio: e.target.value }))}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Data Fim</label>
                      <div className="mt-1">
                        <input
                          type="date"
                          required
                          className="w-full px-3.5 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                          value={novosProcessosFormData.dataFim}
                          onChange={(e) => setNovosProcessosFormData(prev => ({ ...prev, dataFim: e.target.value }))}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-app-text-muted uppercase">Advogado Responsável</p>
                    <p className="text-sm font-bold text-primary">
                      {state.escritorios.find(e => e.id === escritorioAtivoId)?.responsavel || currentUser?.nome || 'Não identificado'}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="form-nome"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Nome do Advogado</label>
                    <div className="mt-1 relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                      <input
                        type="text"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                        placeholder="Nome completo do advogado"
                        value={nomeFormData.nomeAdvogado}
                        onChange={(e) => setNomeFormData(prev => ({ ...prev, nomeAdvogado: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Data Início</label>
                      <div className="mt-1">
                        <input
                          type="date"
                          required
                          className="w-full px-3.5 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                          value={nomeFormData.dataInicio}
                          onChange={(e) => setNomeFormData(prev => ({ ...prev, dataInicio: e.target.value }))}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Data Fim</label>
                      <div className="mt-1">
                        <input
                          type="date"
                          required
                          className="w-full px-3.5 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                          value={nomeFormData.dataFim}
                          onChange={(e) => setNomeFormData(prev => ({ ...prev, dataFim: e.target.value }))}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="animate-spin" size={20} />
              ) : (
                <Search size={20} />
              )}
              {loading ? 'Consultando...' : 'Consultar'}
            </button>
          </form>

          <div className="bg-primary/5 border border-primary/10 text-primary p-5 rounded-2xl">
            <h3 className="font-bold flex items-center gap-2 mb-2">
              <AlertCircle size={18} />
              Sobre a API
            </h3>
            <p className="text-sm opacity-80 leading-relaxed">
              Esta consulta utiliza o serviço oficial de comunicações processuais do CNJ/PJe. 
              Os resultados incluem intimações e citações disponibilizadas no diário eletrônico.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-app-surface border border-app-border rounded-2xl p-12 flex flex-col items-center justify-center text-center"
              >
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                <h3 className="text-xl font-bold text-app-text">Buscando Registros</h3>
                <p className="text-app-text-muted">Aguarde enquanto consultamos o DJEN...</p>
              </motion.div>
            ) : error ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-2xl flex items-start gap-4"
              >
                <AlertCircle className="flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold">Erro na Consulta</h3>
                  <p className="text-sm opacity-90">{error}</p>
                </div>
              </motion.div>
            ) : results ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-app-text flex items-center gap-2">
                    Registros Encontrados 
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-sm">
                      {results.count || 0}
                    </span>
                  </h2>
                </div>

                {(() => {
                  const items = Array.isArray(results) ? results : (results.items || results.registros || []);
                  
                  // Helper function to clean text (remove headers, extra spaces)
                  const cleanText = (text: string) => {
                    if (!text) return '';
                    // Remove redundant headers common in PJe
                    let cleaned = text
                      .replace(/PODER JUDICIÁRIO[\s\S]*?(?=Autos n|Processo n|Classe|Protocolado)/i, '')
                      .replace(/\n\s*\n/g, '\n\n') // Normalize newlines
                      .trim();
                    return cleaned;
                  };

                  // Helper function to extract lawyers from raw text
                  const findLawyersInText = (text: string) => {
                    if (!text) return [];
                    const lawyers: string[] = [];
                    
                    // Regex mais restritivo para evitar capturar valores ou textos longos demais
                    const lawyerRegex = /(?:ADVOGADOS?|PATRONOS?)(?:\s+(?:DOS?|DAS?|DO[S]?|DA[S]?))?\s+(?:[A-ZÀ-Ú\s]+)?:\s*([^:\n\r]{10,150}?)(?=\s+(?:REPRESENTADO|RÉU|AUTOR|EXECUTADO|EXEQUENTE|PROTOCOLO|VALOR|D E C I S Ã O|$))/gi;
                    
                    let match;
                    while ((match = lawyerRegex.exec(text)) !== null) {
                      const namesSection = match[1].trim();
                      // Split by commas but keep OABs attached to names
                      const individualLawyers = namesSection.split(/(?<=OAB\s*nº?\s*[A-Z]{2}[0-9]+)\s*,?\s*/i);
                      individualLawyers.forEach(lawyer => {
                        const cleaned = lawyer.trim().replace(/\s+/g, ' ');
                        // Filtros de ruído: não pode ter R$, não pode ser só números, não pode ser muito curto
                        if (
                          cleaned && 
                          cleaned.length > 8 && 
                          !cleaned.includes('R$') && 
                          !/^\d+$/.test(cleaned.replace(/\D/g, '')) // Evita strings que são quase só números
                        ) {
                          lawyers.push(cleaned);
                        }
                      });
                    }
                    
                    return Array.from(new Set(lawyers));
                  };

                  // Helper function to extract parties from raw text
                  const findPartiesInText = (text: string) => {
                    if (!text) return { autores: [], reus: [] };
                    
                    const isAddressOrNoise = (str: string) => {
                      const s = str.toLowerCase();
                      return (
                        s.includes('rua ') || 
                        s.includes('avenida ') || 
                        s.includes('av. ') || 
                        s.includes('travessa ') || 
                        s.includes('lote ') || 
                        s.includes('quadra ') || 
                        s.includes('cep:') || 
                        /\d{5}-\d{3}/.test(s) || // CEP 
                        /s\/n/.test(s) || // S/N
                        /^\d+$/.test(s.replace(/\D/g, '')) || // Quase só números
                        s.length < 3 ||
                        s.includes('protocolo') ||
                        s.includes('documento')
                      );
                    };

                    const autores: string[] = [];
                    const reus: string[] = [];
                    
                    const autorMatch = text.match(/(?:AUTOR|EXEQUENTE|REQUERENTE|IMPETRANTE|RECLAMANTE|RECLAMANTE\(S\)|AUTOR\(ES\))(?:\s*DE\s*SENTENÇA)?:\s*([^:\n\r]+?)(?=\s+(?:RÉU|EXECUTADO|REQUERIDO|IMPETRADO|RECLAMADO|REPRESENTADO|ADVOGADO|PATRONO|PROTOCOLO|$))/i);
                    const reuMatch = text.match(/(?:RÉU|EXECUTADO|REQUERIDO|IMPETRADO|RECLAMADO|REPRESENTADO|RECLAMADO\(S\)|RÉU\(S\)):\s*([^:\n\r]+?)(?=\s+(?:AUTOR|EXEQUENTE|REQUERENTE|IMPETRANTE|RECLAMANTE|ADVOGADO|PATRONO|PROTOCOLO|$))/i);
                    
                    if (autorMatch) {
                      const names = autorMatch[1].split(/,\s*/).map(n => n.trim()).filter(n => n.length > 2 && !isAddressOrNoise(n));
                      autores.push(...names);
                    }
                    if (reuMatch) {
                      const names = reuMatch[1].split(/,\s*/).map(n => n.trim()).filter(n => n.length > 2 && !isAddressOrNoise(n));
                      reus.push(...names);
                    }
                    
                    return { autores, reus };
                  };

                  // Helper to extract resumen and dispositive
                  const extractSummaryAndDispositive = (text: string) => {
                    if (!text) return { resumo: 'Não extraído', dispositivo: 'Não extraído' };
                    
                    const cleaned = cleanText(text);
                    
                    // Patterns for dispositive part
                    const dispositivePatterns = [
                      /DISPOSITIVO[\s\S]*/i,
                      /ANTE O EXPOSTO[\s\S]*/i,
                      /D E C I D O[\s\S]*/i,
                      /DECIDO[\s\S]*/i,
                      /ISTO POSTO[\s\S]*/i,
                      /Pelo exposto[\s\S]*/i,
                      /POSTO ISSO[\s\S]*/i,
                      /DECISÃO[\s\S]*$/i
                    ];

                    let dispositivo = 'Para visualizar a fundamentação e o dispositivo completo, acesse o processo no portal PJe.';
                    let resumo = cleaned;

                    for (const pattern of dispositivePatterns) {
                      const match = cleaned.match(pattern);
                      if (match) {
                        dispositivo = match[0].trim();
                        // Resume is everything before the dispositive, but cleaned of headers
                        resumo = cleaned.substring(0, match.index).trim();
                        break;
                      }
                    }

                    // Further trim resume if it's too long to be a "summary"
                    if (resumo.length > 800) {
                      resumo = resumo.substring(0, 800) + '... (texto resumido para visualização)';
                    }

                    return { resumo, dispositivo };
                  };

                  const formatParties = (destinatarios: any, textParties: string[]) => {
                    let structuredParties: { nome: string, polo?: string }[] = [];
                    if (destinatarios) {
                      if (Array.isArray(destinatarios)) {
                        structuredParties = destinatarios.map((d: any) => ({
                          nome: (d.nome || d).trim().toUpperCase(),
                          polo: d.polo || undefined
                        }));
                      } else {
                        structuredParties = [{
                          nome: String(destinatarios).trim().toUpperCase()
                        }];
                      }
                    }
                    
                    const combined = [...structuredParties];
                    
                    textParties.forEach(tp => {
                      const normalizedTp = tp.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W/g, '');
                      if (normalizedTp.length < 5) return;
                      
                      const isDuplicate = structuredParties.some(p => {
                        const normalizedSn = p.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W/g, '');
                        return normalizedSn.includes(normalizedTp) || normalizedTp.includes(normalizedSn);
                      });
                      
                      if (!isDuplicate) {
                        combined.push({ nome: tp.trim().toUpperCase() });
                      }
                    });
                    
                    // Final deduplication and cleaning
                    const seen = new Set<string>();
                    const finalParties = combined.filter(p => {
                      if (!p.nome || p.nome.length <= 3 || seen.has(p.nome)) return false;
                      seen.add(p.nome);
                      return true;
                    });

                    return finalParties.length > 0 ? finalParties : [{ nome: 'PARTES NÃO IDENTIFICADAS' }];
                  };

                  const formatLawyers = (advogados: any, textLawyers: string[]) => {
                    let formatted: string[] = [];
                    
                    const processAdv = (item: any) => {
                      const adv = item.advogado || item;
                      if (typeof adv === 'object' && adv !== null) {
                        const oabStr = adv.numero_oab ? ` – OAB/${adv.uf_oab || ''} nº ${adv.numero_oab}` : '';
                        const nome = adv.nome || 'Advogado não identificado';
                        return `${nome}${oabStr}`;
                      }
                      return String(item);
                    };

                    if (advogados) {
                      if (Array.isArray(advogados)) {
                        formatted = advogados.map(processAdv);
                      } else {
                        formatted = [processAdv(advogados)];
                      }
                    }

                    // Deduplicação inteligente e limpeza de ruído
                    const finalLawyers = [...formatted];
                    
                    textLawyers.forEach(textLawyer => {
                      if (textLawyer.includes('R$') || textLawyer.length < 10) return;
                      
                      const isDuplicate = formatted.some(f => {
                        const normalizedF = f.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W/g, '');
                        const normalizedT = textLawyer.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W/g, '');
                        return normalizedF.includes(normalizedT.substring(0, 15)) || normalizedT.includes(normalizedF.substring(0, 15));
                      });
                      
                      if (!isDuplicate) {
                        finalLawyers.push(textLawyer);
                      }
                    });

                    return finalLawyers.length > 0 ? finalLawyers : ['Advogados não identificados'];
                  };

                  if (items.length > 0) {
                    const getNthBusinessDay = (dateStr: string, tribunal: string, n: number) => {
                      if (!dateStr || dateStr === 'N/A') return { formatted: 'N/A', iso: '' };
                      
                      let date: Date;
                      if (dateStr.includes('-')) {
                        const cleanDate = dateStr.split(' ')[0];
                        date = new Date(cleanDate + 'T12:00:00');
                      } else if (dateStr.includes('/')) {
                        const parts = dateStr.split('/');
                        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
                      } else {
                        return { formatted: dateStr, iso: '' };
                      }

                      if (isNaN(date.getTime())) return { formatted: dateStr, iso: '' };

                      // Filtrar feriados do tribunal específico
                      const tribunalHolidays = state.calendario
                        .filter(c => c.tj && c.tj.toLowerCase().trim() === tribunal.toLowerCase().trim())
                        .map(c => {
                          if (!c.data) return '';
                          if (c.data.includes('/')) {
                            const parts = c.data.split('/');
                            return `${parts[2]}-${parts[1]}-${parts[0]}`;
                          }
                          return c.data.split('T')[0];
                        })
                        .filter(Boolean);

                      let currentDay = new Date(date);
                      let businessDaysFound = 0;
                      let safety = 0;

                      while (businessDaysFound < n && safety < 60) {
                        safety++;
                        currentDay.setDate(currentDay.getDate() + 1);
                        const dayOfWeek = currentDay.getDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        const formatted = currentDay.toISOString().split('T')[0];
                        
                        if (!isWeekend && !tribunalHolidays.includes(formatted)) {
                          businessDaysFound++;
                        }
                      }
                      return {
                        formatted: formatDate(currentDay.toISOString().split('T')[0]),
                        iso: currentDay.toISOString().split('T')[0]
                      };
                    };

                    const formatDate = (dateStr: string) => {
                      if (!dateStr || dateStr === 'N/A') return 'N/A';
                      if (dateStr.includes('-')) {
                        const [y, m, d] = dateStr.split('T')[0].split(' ')[0].split('-');
                        return `${d}/${m}/${y}`;
                      }
                      return dateStr;
                    };

                    return (
                      <div className="space-y-12">
                        {items.map((reg: any, idx: number) => {
                          const { resumo, dispositivo } = extractSummaryAndDispositive(reg.texto || '');
                          const textParties = findPartiesInText(reg.texto || '');
                          const textLawyers = findLawyersInText(reg.texto || '');
                          
                          const allParties = formatParties(reg.destinatarios, [...textParties.autores, ...textParties.reus]);
                          const allLawyers = formatLawyers(reg.destinatarioadvogados, textLawyers);
                          
                          const rawData = reg.datadisponibilizacao || reg.dataDisponibilizacao || reg.dataPublicacao || 'N/A';
                          const pubInfo = getNthBusinessDay(rawData, reg.siglaTribunal || 'TJ', 1);
                          const inicioInfo = getNthBusinessDay(rawData, reg.siglaTribunal || 'TJ', 2);

                          const displayData = {
                            tribunal: reg.siglaTribunal || 'TJ',
                            orgao: reg.nomeOrgao || reg.orgaoJulgador || 'Portal PJe',
                            processo: reg.numeroprocessocommascara || reg.numeroProcesso || 'N/A',
                            classe: reg.nomeClasse || reg.classeProcessual || 'N/A',
                            tipo: `${reg.tipoDocumento || 'ATO'} – ${reg.tipoComunicacao || 'COMUNICAÇÃO'}`,
                            partes: allParties,
                            advogados: allLawyers,
                            resumo: resumo,
                            dispositivo: dispositivo,
                            disponibilizacao: formatDate(rawData),
                            publicacao: pubInfo.formatted,
                            inicioPrazo: inicioInfo.formatted,
                            inicioPrazoISO: inicioInfo.iso
                          };

                          return (
                            <motion.article 
                              key={idx}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="bg-app-surface border-x border-app-border relative"
                            >
                              <div className="p-10 font-serif leading-relaxed text-app-text space-y-6">
                                {/* HEADER */}
                                <div className="space-y-1 border-b border-app-border pb-4">
                                  <p className="flex gap-x-2 text-sm">
                                    <span className="font-bold text-app-text-muted">TRIBUNAL:</span>
                                    <span className="uppercase">{displayData.tribunal}</span>
                                  </p>
                                  <p className="flex gap-x-2 text-sm">
                                    <span className="font-bold text-app-text-muted">ÓRGÃO:</span>
                                    <span className="uppercase">{displayData.orgao}</span>
                                  </p>
                                </div>

                                {/* PROCESS INFO */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-x-2 text-lg">
                                    <span className="font-bold text-app-text-muted">PROCESSO:</span>
                                    {(() => {
                                      const cleanProcNum = displayData.processo.replace(/\D/g, '');
                                      const foundProcesso = state.processos.find(p => p.numero.replace(/\D/g, '') === cleanProcNum);
                                      
                                      return (
                                        <span 
                                          className={`font-bold text-primary select-all ${foundProcesso ? 'cursor-pointer hover:underline' : ''}`}
                                          onClick={() => {
                                            if (foundProcesso) {
                                              setSelectedProcessId(foundProcesso.id);
                                              window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                                            }
                                          }}
                                        >
                                          {displayData.processo}
                                        </span>
                                      );
                                    })()}
                                    <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(displayData.processo);
                                      }}
                                      className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-all active:scale-90"
                                      title="Copiar número do processo"
                                    >
                                      <Copy size={16} />
                                    </button>

                                    {/* Botões de Ação do Processo */}
                                    {(() => {
                                      const cleanProcNum = displayData.processo.replace(/\D/g, '');
                                      const foundProcesso = state.processos.find(p => p.numero.replace(/\D/g, '') === cleanProcNum);
                                      
                                      // Determinamos o link: Prioridade 1: state.processos (link cadastrado), Prioridade 2: reg.link (do diário), Prioridade 3: Fallback CNJ
                                      const externalLink = foundProcesso?.link || reg.link || `https://pje.cnj.jus.br/consultapublica/DetalheProcessoConsultaPublica/listView.seam?ca=${reg.numeroProcesso || reg.numeroprocessocommascara?.replace(/\D/g, '')}`;

                                      return (
                                        <div className="flex items-center gap-1">
                                          {/* Botão de Visualizar no App */}
                                          {foundProcesso ? (
                                            <button 
                                              onClick={() => {
                                                setSelectedProcessId(foundProcesso.id);
                                                window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                                              }}
                                              className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-all active:scale-90"
                                              title="Visualizar processo no App"
                                            >
                                              <Eye size={16} />
                                            </button>
                                          ) : (
                                            <button 
                                              onClick={() => {
                                                const activeParty = displayData.partes.find((p: any) => p.polo === 'A')?.nome || '';
                                                const passiveParty = displayData.partes.find((p: any) => p.polo === 'P')?.nome || '';
                                                const title = activeParty && passiveParty ? `${activeParty} X ${passiveParty}` : (activeParty || passiveParty || 'Novo Processo');

                                                setInitialProcessoData({
                                                  numeroProcesso: displayData.processo,
                                                  classe: displayData.classe,
                                                  tribunal: displayData.tribunal,
                                                  orgaoJulgador: title, // Use title for what the modal calls 'titulo'
                                                  partes: displayData.partes.map((p: any) => ({
                                                    nome: p.nome,
                                                    tipoPolo: p.polo === 'A' ? 'Ativo' : (p.polo === 'P' ? 'Passivo' : 'Outro')
                                                  })),
                                                  assuntos: [reg.assunto || 'Não informado'],
                                                  link: reg.link || '',
                                                  disponibilizacao: displayData.disponibilizacao,
                                                  publicacao: displayData.publicacao,
                                                  inicioPrazo: displayData.inicioPrazo,
                                                  inicioPrazoISO: displayData.inicioPrazoISO
                                                });
                                                setIsProcessoModalOpen(true);
                                              }}
                                              className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-emerald-600 transition-all active:scale-90"
                                              title="Cadastrar nos meus processos"
                                            >
                                              <FolderPlus size={16} />
                                            </button>
                                          )}

                                          {/* Botão de Link Externo */}
                                          <a 
                                            href={externalLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 hover:bg-blue-500/10 rounded-lg text-blue-600 transition-all active:scale-90 flex items-center justify-center"
                                            title="visualizar no portal"
                                          >
                                            <Scale size={16} />
                                          </a>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <p className="flex gap-x-2 text-sm uppercase">
                                    <span className="font-bold text-app-text-muted">CLASSE:</span>
                                    <span>{displayData.classe}</span>
                                  </p>
                                </div>

                                {/* TYPE */}
                                <div className="py-2 px-4 bg-app-bg border border-app-border rounded-lg inline-block text-xs font-bold text-primary uppercase tracking-widest">
                                  TIPO: {displayData.tipo}
                                </div>

                                {/* PARTIES */}
                                <div className="space-y-1">
                                  <p className="font-bold text-app-text-muted uppercase tracking-widest text-[10px]">PARTES:</p>
                                  <ul className="space-y-1.5 text-sm pl-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                    {displayData.partes.map((p: any, i: number) => (
                                      <li 
                                        key={i} 
                                        className="flex items-center gap-2 group cursor-pointer hover:bg-primary/5 p-1 rounded-lg transition-colors"
                                        onClick={() => {
                                          navigator.clipboard.writeText(p.nome);
                                          setInitialContatoData({ nome: p.nome });
                                          setIsContatoModalOpen(true);
                                        }}
                                        title="Copiar nome e cadastrar contato"
                                      >
                                        <div className={`p-1 rounded-md transition-colors ${
                                          p.polo === 'A' ? 'bg-green-500/10 text-green-500' : 
                                          p.polo === 'P' ? 'bg-red-500/10 text-red-500' : 
                                          'bg-app-bg text-app-text-muted/40'
                                        }`}>
                                          <UserPlus size={14} />
                                        </div>
                                        <span className={`font-medium ${
                                          p.polo === 'A' ? 'text-green-700' : 
                                          p.polo === 'P' ? 'text-red-700' : 
                                          'text-app-text'
                                        }`}>
                                          {p.nome}
                                        </span>
                                        {p.polo === 'A' && (
                                          <span className="text-[10px] font-bold bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded tracking-tighter">ATIVO</span>
                                        )}
                                        {p.polo === 'P' && (
                                          <span className="text-[10px] font-bold bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded tracking-tighter">PASSIVO</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* LAWYERS */}
                                <div className="space-y-1">
                                  <p className="font-bold text-app-text-muted uppercase tracking-widest text-[10px]">ADVOGADOS:</p>
                                  <ul className="text-sm pl-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                    {displayData.advogados.map((adv: string, i: number) => (
                                      <li key={i} className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                        {adv}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* CONTEÚDO DA PUBLICAÇÃO */}
                                {activeTab !== 'novos_processos' && (
                                  <div className="space-y-3 bg-app-bg/30 p-6 rounded-2xl border border-app-border/50">
                                    <p className="font-bold text-app-text-muted uppercase tracking-widest text-[10px]">CONTEÚDO DA PUBLICAÇÃO:</p>
                                    <FormattedText 
                                      content={reg.texto || (displayData.resumo && displayData.dispositivo ? `${displayData.resumo}\n\n${displayData.dispositivo}` : (displayData.resumo || displayData.dispositivo || ''))} 
                                      className="text-sm md:text-base leading-relaxed whitespace-pre-wrap" 
                                    />
                                  </div>
                                )}

                                {/* FOOTER */}
                                <div className="pt-6 border-t border-app-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-sm">
                                  <div className="space-y-1">
                                    <p className="flex items-center gap-2">
                                      <span className="font-bold text-app-text-muted uppercase text-[10px]">Disponibilização:</span>
                                      <span className="font-medium">{displayData.disponibilizacao}</span>
                                    </p>
                                    {activeTab !== 'novos_processos' && (
                                      <>
                                        <p className="flex items-center gap-2 text-app-text-muted">
                                          <span className="font-bold uppercase text-[10px] opacity-70">Publicação:</span>
                                          <span className="font-medium">{displayData.publicacao}</span>
                                        </p>
                                        <p className="flex items-center gap-2 text-primary">
                                          <span className="font-bold uppercase text-[10px] opacity-70">Início do Prazo:</span>
                                          <span className="font-bold">{displayData.inicioPrazo}</span>
                                        </p>
                                      </>
                                    )}
                                  </div>
                                  {activeTab !== 'novos_processos' && (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button 
                                        onClick={() => {
                                          const cleanProcNum = displayData.processo.replace(/\D/g, '');
                                          const foundProcesso = state.processos.find(p => p.numero.replace(/\D/g, '') === cleanProcNum);
                                          
                                          setInitialTaskData({
                                            ID_PROC: foundProcesso?.id || '',
                                            'PROC.NOME': displayData.processo,
                                            TITULO: `Publicação DJEN - ${displayData.processo}`,
                                            DESCRICAO: `PROCESSO: ${displayData.processo}\n\nPUBLICAÇÃO:\n${stripHtml(reg.texto || displayData.resumo)}`,
                                            TAREFA: `Publicação DJEN - ${displayData.processo}`,
                                            PRAZO_IN: displayData.inicioPrazoISO,
                                            TRIBUNAL: displayData.tribunal,
                                            LINK: reg.link || (displayData.processo ? `https://pje.cnj.jus.br/consultapublica/DetalheProcessoConsultaPublica/listView.seam?ca=${displayData.processo.replace(/\D/g, '')}` : '')
                                          } as any);
                                          setIsTaskModalOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-all font-bold text-xs"
                                      >
                                        <ListTodo size={14} />
                                        Adicionar Tarefa
                                      </button>
                                      <button 
                                        onClick={() => {
                                          const cleanProcNum = displayData.processo.replace(/\D/g, '');
                                          const foundProcesso = state.processos.find(p => p.numero.replace(/\D/g, '') === cleanProcNum);
                                          
                                          setInitialMovimentoData({
                                            processoId: foundProcesso?.id || '',
                                            descricao: `PROCESSO: ${displayData.processo}\n\nPUBLICAÇÃO:\n${stripHtml(reg.texto || displayData.resumo)}`,
                                            data: (rawData && rawData !== 'N/A') ? (rawData.includes('-') ? rawData.split(' ')[0] : (rawData.includes('/') ? rawData.split('/').reverse().join('-') : rawData)) : today
                                          });
                                          setIsMovimentoModalOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-all font-bold text-xs"
                                      >
                                        <Activity size={14} />
                                        Adicionar Movimento
                                      </button>
                                      <button 
                                        onClick={() => {
                                          const cleanProcNum = displayData.processo.replace(/\D/g, '');
                                          const foundProcesso = state.processos.find(p => p.numero.replace(/\D/g, '') === cleanProcNum);
                                          
                                          setInitialEventoData({
                                            processoId: foundProcesso?.id || '',
                                            titulo: `Prazo: ${displayData.processo}`,
                                            data: displayData.inicioPrazoISO || (rawData && rawData !== 'N/A' ? (rawData.includes('-') ? rawData.split(' ')[0] : (rawData.includes('/') ? rawData.split('/').reverse().join('-') : rawData)) : today),
                                            tipo: 'Prazo',
                                            observacoes: `PROCESSO: ${displayData.processo}\n\nPUBLICAÇÃO:\n${stripHtml(reg.texto || displayData.resumo)}`
                                          });
                                          setIsEventoModalOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-all font-bold text-xs"
                                      >
                                        <CalendarPlus size={14} />
                                        Adicionar Evento
                                      </button>
                                       <button 
                                        onClick={() => {
                                          const text = `TRIBUNAL: ${displayData.tribunal}\nÓRGÃO: ${displayData.orgao}\n\nPROCESSO: ${displayData.processo}\nCLASSE: ${displayData.classe}\n\nTIPO: ${displayData.tipo}\n\nPARTES:\n${displayData.partes.map((p: any) => `${p.nome}${p.polo ? ` (${p.polo === 'A' ? 'ATIVO' : 'PASSIVO'})` : ''}`).join('\n')}\n\nADVOGADOS:\n${displayData.advogados.join('\n')}\n\nPUBLICAÇÃO:\n${stripHtml(reg.texto || displayData.resumo)}\n\nDISPONIBILIZAÇÃO: ${displayData.disponibilizacao}\nPUBLICAÇÃO: ${displayData.publicacao}\nINÍCIO DO PRAZO: ${displayData.inicioPrazo}`;
                                          navigator.clipboard.writeText(text);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-all font-bold text-xs"
                                      >
                                        <Copy size={14} />
                                        Copiar Publicação
                                      </button>
                                      <a 
                                        href={reg.link || `https://pje.cnj.jus.br/consultapublica/DetalheProcessoConsultaPublica/listView.seam?ca=${reg.numeroProcesso || reg.numeroprocessocommascara?.replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-all font-bold text-xs"
                                      >
                                        <ExternalLink size={14} />
                                        Ver no PJe
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="h-4 bg-app-bg/50 border-y border-app-border flex items-center justify-center">
                                <div className="h-px w-1/2 bg-app-border border-dashed" />
                              </div>
                            </motion.article>
                          );
                        })}

                        {/* PAGINATION */}
                        <div className="flex items-center justify-center gap-2 mt-8 pb-12">
                          <button
                            onClick={() => handleSearch(undefined, currentPage - 1)}
                            disabled={currentPage === 1 || loading}
                            className="px-4 py-2 bg-app-surface border border-app-border rounded-xl text-sm font-bold text-app-text hover:bg-app-bg transition-all disabled:opacity-50"
                          >
                            Anterior
                          </button>
                          <div className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-bold">
                            Página {currentPage}
                          </div>
                          <button
                            onClick={() => handleSearch(undefined, currentPage + 1)}
                            disabled={items.length < (activeTab === 'novos_processos' ? 5 : 50) || loading}
                            className="px-4 py-2 bg-app-surface border border-app-border rounded-xl text-sm font-bold text-app-text hover:bg-app-bg transition-all disabled:opacity-50"
                          >
                            Próxima
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-app-surface border border-app-border rounded-2xl p-12 text-center">
                      <p className="text-app-text-muted">Nenhum registro encontrado para este critério.</p>
                    </div>
                  );
                })()}

                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer text-xs font-bold text-app-text-muted uppercase hover:text-primary transition-colors py-2">
                    <Download size={14} />
                    <span>Ver Resposta Raw (JSON)</span>
                  </summary>
                  <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden mt-2">
                    <div className="p-4 border-b border-app-border bg-app-bg/30">
                      <p className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Mapeamento JSON de Registros</p>
                    </div>
                    <pre className="p-5 text-[11px] overflow-auto max-h-80 font-mono text-app-text-muted bg-black/5 leading-tight">
                      {JSON.stringify(results, null, 2)}
                    </pre>
                  </div>
                </details>
              </motion.div>
            ) : (
              <div className="bg-app-surface border border-dashed border-app-border rounded-2xl p-20 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-app-bg rounded-full flex items-center justify-center mb-6">
                  <Search size={32} className="text-app-text-muted" />
                </div>
                <h3 className="text-xl font-bold text-app-text">Pronto para Consultar</h3>
                <p className="text-app-text-muted max-w-sm mx-auto mt-2">
                  Preencha os campos ao lado para buscar comunicações oficiais no sistema ComunicaAPI.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <TaskModal 
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        mode="create"
        initialData={initialTaskData || {}}
      />

      <CreateContatoModal 
        isOpen={isContatoModalOpen}
        onClose={() => setIsContatoModalOpen(false)}
        initialData={initialContatoData}
      />

      <CreateProcessoModal
        isOpen={isProcessoModalOpen}
        onClose={() => setIsProcessoModalOpen(false)}
        initialData={initialProcessoData}
      />

      <CreateMovimentoModal
        isOpen={isMovimentoModalOpen}
        onClose={() => setIsMovimentoModalOpen(false)}
        initialData={initialMovimentoData}
      />

      <CreateEventoModal
        isOpen={isEventoModalOpen}
        onClose={() => setIsEventoModalOpen(false)}
        initialData={initialEventoData}
      />
    </div>
  );
}
