import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../context';
import { DollarSign, Plus, ArrowUpRight, ArrowDownRight, Search, Filter, Edit2, Trash2, Eye, X, Calendar as CalendarIcon, FileText, CheckCircle2, Clock, ChevronLeft, ChevronRight, User } from 'lucide-react';
import Modal from '../components/Modal';
import { Transacao } from '../types';
import { formatDate } from '../utils/date';

export default function Financeiro() {
  const { state, escritorioAtivoId, isAdmin, currentUser, addTransacao, updateTransacao, deleteTransacao, hasPermission, setSelectedProcessId } = useAppContext();
  const isGlobalAdmin = isAdmin() && (escritorioAtivoId === "" || !escritorioAtivoId);
  const [filter, setFilter] = useState<'Todos' | 'Receita' | 'Despesa'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  const searchRef = useRef<HTMLDivElement>(null);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowProcessResults(false);
      }
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setShowContactResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('view');
  const [selectedTransaction, setSelectedTransaction] = useState<Transacao | null>(null);
  const [formData, setFormData] = useState<Partial<Transacao>>({
    tipo: 'Receita',
    valor: 0,
    data: new Date().toISOString().split('T')[0],
    descricao: '',
    status: 'Pendente',
    processoId: '',
    clienteId: '',
    contatoId: '',
    observacoes: ''
  });
  const [processSearch, setProcessSearch] = useState('');
  const [showProcessResults, setShowProcessResults] = useState(false);

  const [contactSearch, setContactSearch] = useState('');
  const [showContactResults, setShowContactResults] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = state.settings.itemsPerPage || 20;

  // Reseta para primeira página ao filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

  const canWrite = hasPermission('financeiro', 'write');
  const canDelete = hasPermission('financeiro', 'delete');

  const filteredFinanceiro = state.financeiro.filter(t => {
    if (escritorioAtivoId && t.escritorioId !== escritorioAtivoId) return false;
    if (isAdmin()) return true;
    return (currentUser?.escritoriosIds || []).includes(t.escritorioId || '');
  });

  const filteredTransacoes = useMemo(() => {
    return filteredFinanceiro.filter(t => {
      const [year, month] = t.data.split('-').map(Number);
      const matchesMonth = (month - 1) === selectedMonth && year === selectedYear;
      const matchesFilter = filter === 'Todos' || t.tipo === filter;
      
      const cid = t.contatoId || t.clienteId;
      const contactObj = state.contatos.find(c => String(c.id) === String(cid));
      const contactMatch = contactObj ? contactObj.nome.toLowerCase().includes(searchTerm.toLowerCase()) : false;

      const matchesSearch = t.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (t.observacoes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           contactMatch;
      return matchesMonth && matchesFilter && matchesSearch;
    }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [filteredFinanceiro, filter, searchTerm, selectedMonth, selectedYear, state.contatos]);

  const totalPages = Math.ceil(filteredTransacoes.length / itemsPerPage);
  const paginatedTransacoes = useMemo(() => {
    return filteredTransacoes.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredTransacoes, currentPage, itemsPerPage]);

  const handleOpenModal = (mode: 'create' | 'edit' | 'view', transacao?: Transacao) => {
    setModalMode(mode);
    setShowProcessResults(false);
    setShowContactResults(false);
    if (transacao) {
      setSelectedTransaction(transacao);
      setFormData(transacao);
      
      const cid = transacao.clienteId || transacao.contatoId;
      if (cid) {
        const contact = state.contatos.find(c => String(c.id) === String(cid));
        setContactSearch(contact ? contact.nome : '');
      } else {
        setContactSearch('');
      }

      if (transacao.processoId) {
        const proc = state.processos.find(p => p.id === transacao.processoId);
        setProcessSearch(proc ? `${proc.titulo} - ${formatCNJ(proc.numero)}` : '');
      } else {
        setProcessSearch('');
      }
    } else {
      setSelectedTransaction(null);
      setProcessSearch('');
      setContactSearch('');
      setFormData({
        tipo: 'Receita',
        valor: 0,
        data: new Date().toISOString().split('T')[0],
        descricao: '',
        status: 'Pendente',
        processoId: '',
        clienteId: '',
        contatoId: '',
        observacoes: ''
      });
    }
    setIsModalOpen(true);
  };

  const filteredContatos = useMemo(() => {
    if (!contactSearch || contactSearch.trim().length === 0) {
      return state.contatos.slice(0, 15);
    }
    const searchLower = contactSearch.toLowerCase();
    return state.contatos.filter(c => {
      const nameMatch = (c.nome || '').toLowerCase().includes(searchLower);
      const cpfMatch = (c.cpfCnpj || '').toLowerCase().includes(searchLower);
      return nameMatch || cpfMatch;
    }).slice(0, 15);
  }, [state.contatos, contactSearch]);

  const filteredProcessos = useMemo(() => {
    if (processSearch.length < 4) return [];
    
    return state.processos.filter(p => {
      if (escritorioAtivoId && p.escritorioId !== escritorioAtivoId) return false;
      
      const searchLower = processSearch.toLowerCase();
      const numMatch = (p.numero || '').toLowerCase().includes(searchLower);
      const titleMatch = (p.titulo || '').toLowerCase().includes(searchLower);
      
      // Busca pelo nome do cliente vinculado ao processo
      const cliente = state.contatos.find(c => c.id === p.clienteId);
      const clienteMatch = cliente ? cliente.nome.toLowerCase().includes(searchLower) : false;
      
      return numMatch || titleMatch || clienteMatch;
    }).sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
  }, [state.processos, state.contatos, processSearch, escritorioAtivoId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;

    const data = {
      ...formData,
      valor: Number(formData.valor),
      clienteId: formData.clienteId || '',
      contatoId: formData.clienteId || formData.contatoId || '',
      escritorioId: formData.escritorioId || escritorioAtivoId || 'x',
      usuarioId: currentUser?.id || 'system'
    } as Transacao;

    if (modalMode === 'create') {
      addTransacao({
        ...data,
        id: `fin_${Date.now()}`
      });
    } else if (modalMode === 'edit' && selectedTransaction) {
      updateTransacao({
        ...data,
        id: selectedTransaction.id
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!canDelete) return;
    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
      deleteTransacao(id);
    }
  };

  const totalReceitas = useMemo(() => 
    filteredFinanceiro
      .filter(t => {
        const [year, month] = t.data.split('-').map(Number);
        return (month - 1) === selectedMonth && year === selectedYear && t.tipo === 'Receita' && t.status === 'Pago';
      })
      .reduce((acc, curr) => acc + curr.valor, 0),
    [filteredFinanceiro, selectedMonth, selectedYear]
  );
  
  const totalDespesas = useMemo(() => 
    filteredFinanceiro
      .filter(t => {
        const [year, month] = t.data.split('-').map(Number);
        return (month - 1) === selectedMonth && year === selectedYear && t.tipo === 'Despesa' && t.status === 'Pago';
      })
      .reduce((acc, curr) => acc + curr.valor, 0),
    [filteredFinanceiro, selectedMonth, selectedYear]
  );
  
  const saldo = totalReceitas - totalDespesas;

  const formatCNJ = (numero: string) => {
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <DollarSign className="mr-3 text-primary" />
          Financeiro
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-app-surface border border-app-border rounded-lg p-1">
            <button 
              onClick={() => setSelectedYear(prev => prev - 1)}
              className="p-1.5 hover:bg-app-bg text-app-text-muted rounded"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-sm font-bold text-app-text">{selectedYear}</span>
            <button 
              onClick={() => setSelectedYear(prev => prev + 1)}
              className="p-1.5 hover:bg-app-bg text-app-text-muted rounded"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button 
            onClick={() => handleOpenModal('create')}
            disabled={!canWrite}
            className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm disabled:opacity-50"
          >
            <Plus size={20} className="mr-2" />
            Nova Transação
          </button>
        </div>
      </div>

      {/* Month Tabs */}
      <div className="overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-center gap-2 min-w-max">
          {months.map((month, index) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(index)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                selectedMonth === index
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105 z-10'
                  : 'bg-app-surface text-app-text-muted border border-app-border hover:border-primary/50'
              }`}
            >
              {month}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-app-surface p-6 rounded-xl shadow-sm border border-app-border flex items-center justify-between">
          <div>
            <p className="text-sm text-app-text-muted font-medium mb-1">Receitas (Pagas)</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceitas)}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-full">
            <ArrowUpRight size={24} />
          </div>
        </div>

        <div className="bg-app-surface p-6 rounded-xl shadow-sm border border-app-border flex items-center justify-between">
          <div>
            <p className="text-sm text-app-text-muted font-medium mb-1">Despesas (Pagas)</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
            </p>
          </div>
          <div className="p-3 bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 rounded-full">
            <ArrowDownRight size={24} />
          </div>
        </div>

        <div className="bg-app-surface p-6 rounded-xl shadow-sm border border-app-border flex items-center justify-between">
          <div>
            <p className="text-sm text-app-text-muted font-medium mb-1">Saldo Atual</p>
            <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-app-text' : 'text-red-600 dark:text-red-400'}`}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldo)}
            </p>
          </div>
          <div className="p-3 bg-app-secondary text-primary rounded-full">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="p-4 border-b border-app-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
            <input 
              type="text" 
              placeholder="Buscar transações..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-app-secondary text-app-text placeholder-app-text-muted"
            />
          </div>
          <div className="flex space-x-2 w-full sm:w-auto">
            {['Todos', 'Receita', 'Despesa'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 sm:flex-none ${
                  filter === f 
                    ? 'bg-primary/10 text-primary dark:bg-primary/20 border border-primary/20 dark:border-primary/30' 
                    : 'bg-app-secondary text-app-text-muted border border-app-border hover:bg-app-bg'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-app-secondary text-app-text-muted text-sm uppercase tracking-wider">
                <th className="p-4 font-medium">Data</th>
                <th className="p-4 font-medium">Descrição</th>
                <th className="p-4 font-medium">Contato</th>
                <th className="p-4 font-medium">Processo</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Valor</th>
                <th className="p-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {paginatedTransacoes.map((transacao, index) => {
                const processo = state.processos.find(p => p.id === transacao.processoId || p.idProc === transacao.processoId || p.numero === transacao.processoId);
                const cid = transacao.contatoId || transacao.clienteId || (processo ? processo.clienteId : '');
                const contato = state.contatos.find(c => String(c.id) === String(cid));

                return (
                  <tr key={`${transacao.id}-${index}`} className="hover:bg-app-secondary/50 transition-colors">
                    <td className="p-4 text-app-text-muted whitespace-nowrap">
                      {formatDate(transacao.data)}
                    </td>
                    <td className="p-4 text-app-text font-medium min-w-[200px]">
                      <div className="flex items-center">
                        {transacao.tipo === 'Receita' ? (
                          <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg mr-3">
                            <ArrowUpRight size={16} />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg mr-3">
                            <ArrowDownRight size={16} />
                          </div>
                        )}
                        <span className="truncate">{transacao.descricao}</span>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {contato ? (
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-primary flex-shrink-0" />
                          <span className="text-sm font-medium text-app-text truncate max-w-[160px]" title={contato.nome}>
                            {contato.nome}
                          </span>
                        </div>
                      ) : (
                        <span className="text-app-text-muted opacity-50">-</span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {processo ? (
                        <div 
                          className="flex flex-col cursor-pointer hover:underline group/proc"
                          onClick={() => {
                            setSelectedProcessId(processo.id);
                            window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                          }}
                        >
                          <span className="font-mono text-[11px] text-primary group-hover/proc:font-bold">{formatCNJ(processo.numero)}</span>
                          <span className="text-[10px] text-app-text-muted truncate max-w-[150px]">{processo.titulo}</span>
                        </div>
                      ) : (
                        <span className="text-app-text-muted opacity-50">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        transacao.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                      }`}>
                        {transacao.status}
                      </span>
                    </td>
                    <td className={`p-4 text-right font-bold whitespace-nowrap ${
                      transacao.tipo === 'Receita' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {transacao.tipo === 'Despesa' ? '-' : ''}
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transacao.valor)}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center items-center space-x-2">
                        <button 
                          onClick={() => handleOpenModal('view', transacao)}
                          className="p-1.5 hover:bg-app-bg text-app-text-muted hover:text-primary rounded-lg transition-colors"
                          title="Visualizar"
                        >
                          <Eye size={16} />
                        </button>
                        {canWrite && (
                          <button 
                            onClick={() => handleOpenModal('edit', transacao)}
                            className="p-1.5 hover:bg-app-bg text-app-text-muted hover:text-primary rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(transacao.id)}
                            className="p-1.5 hover:bg-app-bg text-app-text-muted hover:text-red-500 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedTransacoes.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-app-text-muted">
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {filteredTransacoes.length > itemsPerPage && (
          <div className="px-4 py-3 bg-app-secondary/30 border-t border-app-border flex items-center justify-between">
            <div className="text-xs text-app-text-muted">
              Mostrando <span className="font-medium text-app-text">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium text-app-text">{Math.min(currentPage * itemsPerPage, filteredTransacoes.length)}</span> de <span className="font-medium text-app-text">{filteredTransacoes.length}</span> transações
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md hover:bg-app-surface text-app-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Página Anterior"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="flex items-center px-4 space-x-3">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Página</span>
                <div className="flex items-center gap-1.5 bg-app-surface border border-app-border px-3 py-1 rounded-lg">
                  <span className="text-sm font-bold text-app-text">{currentPage}</span>
                  <span className="text-app-text-muted/40 font-light translate-y-[1px]">/</span>
                  <span className="text-sm font-bold text-app-text-muted">{totalPages}</span>
                </div>
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md hover:bg-app-surface text-app-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Próxima Página"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === 'create' ? 'Nova Transação' : 
          modalMode === 'edit' ? 'Editar Transação' : 'Detalhes da Transação'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-app-text-muted uppercase">Tipo</label>
              <div className="flex space-x-2">
                {['Receita', 'Despesa'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={modalMode === 'view'}
                    onClick={() => setFormData({ ...formData, tipo: t as any })}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2 ${
                      formData.tipo === t
                        ? t === 'Receita' 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600' 
                          : 'bg-red-500/10 border-red-500 text-red-600'
                        : 'bg-app-secondary border-app-border text-app-text-muted opacity-60'
                    }`}
                  >
                    {t === 'Receita' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-app-text-muted uppercase">Valor</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm font-bold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  disabled={modalMode === 'view'}
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value as any })}
                  className="w-full pl-10 pr-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-app-text-muted uppercase">Data</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                <input
                  type="date"
                  required
                  disabled={modalMode === 'view'}
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-app-text-muted uppercase">Status</label>
              <select
                disabled={modalMode === 'view'}
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
              >
                <option value="Pago">Pago</option>
                <option value="Pendente">Pendente</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-app-text-muted uppercase">Descrição</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                <input
                  type="text"
                  required
                  placeholder="Ex: Honorários, Aluguel, custas..."
                  disabled={modalMode === 'view'}
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                />
              </div>
            </div>

            <div ref={clientSearchRef} className="space-y-1 md:col-span-2 relative">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-app-text-muted uppercase">Contato (Opcional)</label>
                {(formData.contatoId || formData.clienteId) && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Contato Vinculado
                  </span>
                )}
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                <input
                  type="text"
                  placeholder="Buscar no cadastro de contatos (nome, CPF/CNPJ)..."
                  disabled={modalMode === 'view'}
                  value={contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowContactResults(true);
                    if (!e.target.value) {
                      setFormData(prev => ({ ...prev, clienteId: '', contatoId: '' }));
                    }
                  }}
                  onFocus={() => {
                    if (modalMode !== 'view') setShowContactResults(true);
                  }}
                  className="w-full pl-10 pr-10 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text text-sm"
                />
                {contactSearch && modalMode !== 'view' && (
                  <button
                    type="button"
                    onClick={() => {
                      setContactSearch('');
                      setFormData(prev => ({ ...prev, clienteId: '', contatoId: '' }));
                      setShowContactResults(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {showContactResults && modalMode !== 'view' && (
                <div className="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {filteredContatos.length > 0 ? (
                    filteredContatos.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, clienteId: String(c.id), contatoId: String(c.id) }));
                          setContactSearch(c.nome);
                          setShowContactResults(false);
                        }}
                        className="w-full text-left p-3 hover:bg-primary/5 transition-colors border-b border-app-border last:border-0 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-app-text text-sm">{c.nome}</div>
                          {c.cpfCnpj && <div className="text-xs text-app-text-muted">{c.cpfCnpj}</div>}
                        </div>
                        {c.telefone && <div className="text-xs text-app-text-muted">{c.telefone}</div>}
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-app-text-muted text-xs">
                      Nenhum contato encontrado no cadastro.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div ref={searchRef} className="space-y-1 md:col-span-2 relative">
              <label className="text-xs font-medium text-app-text-muted uppercase">Vincular a Processo (Opcional)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                <input
                  type="text"
                  placeholder="Digite 4 dígitos do número ou nome do cliente..."
                  disabled={modalMode === 'view'}
                  value={processSearch}
                  onChange={(e) => {
                    setProcessSearch(e.target.value);
                    setShowProcessResults(true);
                    if (!e.target.value) setFormData(prev => ({ ...prev, processoId: '' }));
                  }}
                  onFocus={() => setShowProcessResults(true)}
                  className="w-full pl-10 pr-10 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text text-sm"
                />
                {processSearch && modalMode !== 'view' && (
                  <button
                    type="button"
                    onClick={() => {
                      setProcessSearch('');
                      setFormData(prev => ({ ...prev, processoId: '' }));
                      setShowProcessResults(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              
              {showProcessResults && processSearch.length >= 4 && modalMode !== 'view' && (
                <div className="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {filteredProcessos.length > 0 ? (
                    filteredProcessos.map((p, index) => {
                      const cliente = state.contatos.find(c => c.id === p.clienteId);
                      return (
                        <button
                          key={`${p.id}-${index}`}
                          type="button"
                          onClick={() => {
                            const newFormData: any = { ...formData, processoId: p.id };
                            if (p.clienteId && !formData.clienteId) {
                              newFormData.clienteId = String(p.clienteId);
                              newFormData.contatoId = String(p.clienteId);
                              if (cliente) setContactSearch(cliente.nome);
                            }
                            setFormData(newFormData);
                            setProcessSearch(`${p.titulo} - ${formatCNJ(p.numero)}`);
                            setShowProcessResults(false);
                          }}
                          className="w-full text-left p-3 hover:bg-primary/5 transition-colors border-b border-app-border last:border-0"
                        >
                          <div className="font-medium text-app-text truncate">{p.titulo}</div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-primary font-mono">{formatCNJ(p.numero)}</span>
                            {cliente && (
                              <span className="text-[10px] text-app-text-muted italic">Cliente: {cliente.nome}</span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-app-text-muted text-xs">
                      Nenhum processo encontrado.
                    </div>
                  )}
                </div>
              )}
            </div>

            {isGlobalAdmin && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-app-text-muted uppercase">Escritório</label>
                <select
                  disabled={modalMode === 'view'}
                  value={formData.escritorioId || ''}
                  onChange={(e) => setFormData({ ...formData, escritorioId: e.target.value })}
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text text-sm font-medium"
                >
                  <option value="">Selecione um escritório</option>
                  {state.escritorios.map(esc => (
                    <option key={esc.id} value={esc.id}>{esc.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-app-text-muted uppercase">Observações</label>
              <textarea
                rows={3}
                disabled={modalMode === 'view'}
                placeholder="Detalhes adicionais..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text resize-none"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors"
            >
              {modalMode === 'view' ? 'Fechar' : 'Cancelar'}
            </button>
            {modalMode !== 'view' && canWrite && (
              <button
                type="submit"
                className="px-6 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm font-bold"
              >
                {modalMode === 'create' ? 'Salvar Lançamento' : 'Atualizar Lançamento'}
              </button>
            )}
            {modalMode === 'view' && canWrite && (
              <button
                type="button"
                onClick={() => setModalMode('edit')}
                className="px-6 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm font-bold flex items-center gap-2"
              >
                <Edit2 size={18} />
                Editar
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
