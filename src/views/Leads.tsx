import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Search, Calendar, FileText, Download, Copy, Eye, FolderPlus, UserPlus, Scale, ShieldAlert, CheckCircle, Clock, Trash2, Mail, Phone, Building2, User, Briefcase, MapPin, Activity, Edit2, Save, ExternalLink, ChevronUp, ChevronDown, DollarSign, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context';
import { CreateContatoModal, CreateProcessoModal } from '../components/CreateModals';
import Modal from '../components/Modal';
import { getTodayInTimezone } from '../utils/date';
import { Lead, Contato, LeadStatus, DEFAULT_LEAD_STATUSES } from '../types';

export default function Leads() {
  const { state, escritorioAtivoId, currentUser, setSelectedProcessId, addLead, updateLead, deleteLead, addContato, updateContato, addLeadStatus, updateLeadStatusItem, deleteLeadStatus } = useAppContext();
  const today = getTodayInTimezone(state.settings.timezone);

  const availableStatuses = useMemo(() => {
    const list = (state.leadsStatus && state.leadsStatus.length > 0)
      ? state.leadsStatus
      : DEFAULT_LEAD_STATUSES;
    
    return list.filter(s => {
      const escId = s.escritorioId || s.idEscritorio;
      return !escId || escId === 'x' || !escritorioAtivoId || escId === escritorioAtivoId;
    });
  }, [state.leadsStatus, escritorioAtivoId]);

  const getStatusColor = (statusName: string) => {
    const st = availableStatuses.find(s => s.nome.toLowerCase() === (statusName || '').toLowerCase());
    return st?.cor || '#3B82F6';
  };

  const [activeTab, setActiveTab] = useState<'busca' | 'salvos' | 'tabela' | 'status'>('busca');
  const [savedSearch, setSavedSearch] = useState('');
  const [savedStatusFilters, setSavedStatusFilters] = useState<string[]>(['Novo']);
  const [isStatusDropdownOpenCards, setIsStatusDropdownOpenCards] = useState(false);
  const [isStatusDropdownOpenTable, setIsStatusDropdownOpenTable] = useState(false);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<LeadStatus | null>(null);
  const [statusForm, setStatusForm] = useState({
    nome: '',
    cor: '#3B82F6',
    escritorioId: escritorioAtivoId || 'x'
  });

  const getStatusFilterLabel = () => {
    if (savedStatusFilters.length === 0) return 'Nenhum selecionado';
    if (savedStatusFilters.length === availableStatuses.length) return '📋 Todos os Status';
    if (savedStatusFilters.length === 1) {
      const selected = savedStatusFilters[0];
      const found = availableStatuses.find(s => s.nome.toLowerCase() === selected.toLowerCase());
      return found ? found.nome : selected;
    }
    return `📋 ${savedStatusFilters.length} selecionados`;
  };

  const toggleStatusFilter = (statusName: string) => {
    setSavedStatusFilters(prev => {
      const exists = prev.some(s => s.toLowerCase() === statusName.toLowerCase());
      if (exists) {
        return prev.filter(s => s.toLowerCase() !== statusName.toLowerCase());
      } else {
        return [...prev, statusName];
      }
    });
  };

  const handleSelectAllStatuses = () => {
    if (savedStatusFilters.length === availableStatuses.length) {
      setSavedStatusFilters([]);
    } else {
      setSavedStatusFilters(availableStatuses.map(s => s.nome));
    }
  };

  const handleSaveStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusForm.nome.trim()) return;

    if (editingStatus) {
      updateLeadStatusItem({
        ...editingStatus,
        nome: statusForm.nome.trim(),
        cor: statusForm.cor,
        escritorioId: statusForm.escritorioId,
        idEscritorio: statusForm.escritorioId
      });
    } else {
      addLeadStatus({
        id: `status_${Date.now()}`,
        nome: statusForm.nome.trim(),
        cor: statusForm.cor,
        escritorioId: statusForm.escritorioId,
        idEscritorio: statusForm.escritorioId
      });
    }

    setEditingStatus(null);
    setStatusForm({
      nome: '',
      cor: '#3B82F6',
      escritorioId: escritorioAtivoId || 'x'
    });
  };

  const [leadSortConfig, setLeadSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const [isContatoModalOpen, setIsContatoModalOpen] = useState(false);
  const [initialContatoData, setInitialContatoData] = useState<any>(null);

  const [selectedSavedContato, setSelectedSavedContato] = useState<Contato | null>(null);
  const [isViewContatoModalOpen, setIsViewContatoModalOpen] = useState(false);
  const [isEditingContato, setIsEditingContato] = useState(false);
  const [editContatoData, setEditContatoData] = useState<Contato | null>(null);

  const [isManualLeadModalOpen, setIsManualLeadModalOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [manualLeadForm, setManualLeadForm] = useState({
    numero: '',
    classe: '',
    tribunal: 'TJAM',
    orgao: '',
    partes: '',
    advogados: '',
    disponibilizacao: '',
    publicacao: '',
    status: 'Novo' as Lead['status'],
    prioridade: 'Média' as 'Baixa' | 'Média' | 'Alta' | 'Urgente',
    resumo: '',
  });

  const handleContactClick = (name: string) => {
    if (!name) return;
    const normalizedName = name.trim().toLowerCase();
    
    // Check if contact already exists
    const existingContact = state.contatos?.find(
      c => c.nome.toLowerCase().trim() === normalizedName
    );

    if (existingContact) {
      // Open contact view details
      setSelectedSavedContato(existingContact);
      setIsViewContatoModalOpen(true);
    } else {
      // Se não estiver salvo, adicionar!
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      const hr = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const sec = String(now.getSeconds()).padStart(2, '0');
      const formattedDateTime = `${d}/${m}/${y} ${hr}:${min}:${sec}`;

      const newContact: Contato = {
        id: `CT${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        nome: name.trim(),
        tipo: 'Lead',
        status: 'Ativo',
        statusCivil: '',
        email: '',
        telefone: '',
        cpfCnpj: '',
        apelido: '',
        profissao: '',
        rg: '',
        endereco: '',
        cep: '',
        dadosPagamento: '',
        escritorioId: escritorioAtivoId || '',
        dataCadastro: formattedDateTime,
      };

      addContato(newContact);
      
      // Auto open visualization of the newly created contact for superb UX!
      setSelectedSavedContato(newContact);
      setIsViewContatoModalOpen(true);
      
      alert(`Contato "${name.trim()}" adicionado automaticamente ao escritório atual com status "Lead"!`);
    }
  };

  const [isProcessoModalOpen, setIsProcessoModalOpen] = useState(false);
  const [initialProcessoData, setInitialProcessoData] = useState<any>(null);

  const [isResumoModalOpen, setIsResumoModalOpen] = useState(false);
  const [selectedLeadForResumo, setSelectedLeadForResumo] = useState<Lead | null>(null);
  const [resumoText, setResumoText] = useState('');
  const [isEditingResumo, setIsEditingResumo] = useState(false);

  const [formData, setFormData] = useState({
    tribunal: 'TJAM',
    varaInput: '',
    varaId: '',
    dataInicio: today,
    dataFim: today
  });

  const [showVaraDropdown, setShowVaraDropdown] = useState(false);
  const [semAdvogado, setSemAdvogado] = useState(false);
  const [bancario, setBancario] = useState(false);
  const [julgado, setJulgado] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const TRIBUNALS_LIST = [
    { id: 'TJAM', sigla: 'TJAM', nome: 'TJ Amazonas (TJAM)' },
    { id: 'TJSP', sigla: 'TJSP', nome: 'TJ São Paulo (TJSP)' },
    { id: 'TJRJ', sigla: 'TJRJ', nome: 'TJ Rio de Janeiro (TJRJ)' },
    { id: 'TJMG', sigla: 'TJMG', nome: 'TJ Minas Gerais (TJMG)' },
    { id: 'TJPR', sigla: 'TJPR', nome: 'TJ Paraná (TJPR)' },
    { id: 'TJRS', sigla: 'TJRS', nome: 'TJ Rio Grande do Sul (TJRS)' },
    { id: 'TJBA', sigla: 'TJBA', nome: 'TJ Bahia (TJBA)' },
    { id: 'TJPE', sigla: 'TJPE', nome: 'TJ Pernambuco (TJPE)' },
    { id: 'TJCE', sigla: 'TJCE', nome: 'TJ Ceará (TJCE)' },
    { id: 'TJSC', sigla: 'TJSC', nome: 'TJ Santa Catarina (TJSC)' },
    { id: 'TJGO', sigla: 'TJGO', nome: 'TJ Goiás (TJGO)' },
    { id: 'TJMA', sigla: 'TJMA', nome: 'TJ Maranhão (TJMA)' },
    { id: 'TJPA', sigla: 'TJPA', nome: 'TJ Pará (TJPA)' },
    { id: 'TJES', sigla: 'TJES', nome: 'TJ Espírito Santo (TJES)' },
    { id: 'TJDF', sigla: 'TJDF', nome: 'TJ Distrito Federal (TJDFT)' }
  ];

  const tribunals = useMemo(() => {
    const merged = [...state.tribunais];
    TRIBUNALS_LIST.forEach(t => {
      const exists = merged.some(m => (m.sigla || m.id || '').toUpperCase() === t.sigla.toUpperCase() || (m.id || '').toUpperCase() === t.id.toUpperCase());
      if (!exists) {
        merged.push(t);
      }
    });
    return merged;
  }, [state.tribunais]);

  const filteredVarasForAutocomplete = useMemo(() => {
    if (formData.varaInput.length < 2) return [];
    const searchLower = formData.varaInput.toLowerCase();
    return state.varas.filter(v => 
      (v.nome || '').toLowerCase().includes(searchLower) || (v.id || '').toLowerCase().includes(searchLower)
    );
  }, [formData.varaInput, state.varas]);

  const activeOfficeLeads = useMemo(() => {
    let list = state.leads || [];
    if (escritorioAtivoId) {
      list = list.filter(l => l.escritorioId === escritorioAtivoId);
    }
    return list;
  }, [state.leads, escritorioAtivoId]);

  const filteredSavedLeads = useMemo(() => {
    let list = [...activeOfficeLeads];
    
    if (savedStatusFilters.length > 0) {
      list = list.filter(l => savedStatusFilters.some(sf => sf.toLowerCase() === (l.status || 'Novo').toLowerCase()));
    }
    
    if (savedSearch.trim()) {
      const searchLower = savedSearch.toLowerCase();
      list = list.filter(l => 
        (l.numero || '').toLowerCase().includes(searchLower) ||
        (l.classe || '').toLowerCase().includes(searchLower) ||
        (l.orgao || '').toLowerCase().includes(searchLower) ||
        (l.partes || '').toLowerCase().includes(searchLower) ||
        (l.advogados || '').toLowerCase().includes(searchLower)
      );
    }
    return list;
  }, [activeOfficeLeads, savedSearch, savedStatusFilters]);

  const requestLeadSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (leadSortConfig && leadSortConfig.key === key && leadSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setLeadSortConfig({ key, direction });
  };

  const sortedSavedLeads = useMemo(() => {
    let list = [...filteredSavedLeads];
    if (leadSortConfig) {
      list.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        switch (leadSortConfig.key) {
          case 'numero':
            aValue = a.numero || '';
            bValue = b.numero || '';
            break;
          case 'tribunal':
            aValue = `${a.tribunal || ''} ${a.orgao || ''}`;
            bValue = `${b.tribunal || ''} ${b.orgao || ''}`;
            break;
          case 'classe':
            aValue = a.classe || '';
            bValue = b.classe || '';
            break;
          case 'partes':
            aValue = a.partes || '';
            bValue = b.partes || '';
            break;
          case 'dataCadastro':
            aValue = a.dataCadastro || '';
            bValue = b.dataCadastro || '';
            break;
          case 'status':
            aValue = a.status || '';
            bValue = b.status || '';
            break;
          case 'prioridade':
            const priorityWeight = { 'Urgente': 4, 'Alta': 3, 'Média': 2, 'Baixa': 1, '': 0 };
            aValue = priorityWeight[a.prioridade || 'Média'] || 0;
            bValue = priorityWeight[b.prioridade || 'Média'] || 0;
            break;
          default:
            aValue = (a as any)[leadSortConfig.key] || '';
            bValue = (b as any)[leadSortConfig.key] || '';
        }

        if (leadSortConfig.key !== 'prioridade') {
          if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          }
          if (typeof bValue === 'string') {
            bValue = bValue.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          }
          if (aValue < bValue) return leadSortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return leadSortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        } else {
          return leadSortConfig.direction === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
        }
      });
    }
    return list;
  }, [filteredSavedLeads, leadSortConfig]);

  const exportToXLSX = () => {
    if (!filteredSavedLeads || filteredSavedLeads.length === 0) {
      alert("Nenhum lead encontrado para exportação baseada nos filtros atuais.");
      return;
    }

    // Format leads for Excel sheet
    const exportData = filteredSavedLeads.map(lead => ({
      'Número do Processo': lead.numero || '',
      'Status': lead.status || 'Novo',
      'Prioridade': lead.prioridade || 'Média',
      'Tribunal': lead.tribunal || '',
      'Órgão Julgador': lead.orgao || '',
      'Classe': lead.classe || '',
      'Partes': lead.partes || '',
      'Advogados': lead.advogados || '',
      'Disponibilização': lead.disponibilizacao || '',
      'Publicação': lead.publicacao || '',
      'Data de Cadastro': lead.dataCadastro || '',
      'Resumo': lead.resumo || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

    // Create and download file
    const statusString = savedStatusFilters.length === 4 ? 'todos' : (savedStatusFilters.join('-') || 'nenhum');
    XLSX.writeFile(workbook, `Leads_${statusString}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleVaraSelect = (v: any) => {
    let associatedTribunalSigla = '';
    if (v.forum) {
      const forum = state.forums.find(f => f.id === v.forum);
      if (forum && forum.tribunalId) {
        const trib = state.tribunais.find(t => t.id === forum.tribunalId);
        if (trib) {
          associatedTribunalSigla = trib.sigla || trib.id;
        } else {
          associatedTribunalSigla = forum.tribunalId;
        }
      }
    }
    
    setFormData(prev => ({
      ...prev,
      varaInput: v.nome,
      varaId: v.id,
      tribunal: associatedTribunalSigla || prev.tribunal
    }));
    setShowVaraDropdown(false);
  };

  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Status de Leads locais gerenciados via localStorage
  const [leadsStatus, setLeadsStatus] = useState<Record<string, 'Novo' | 'Em Contato' | 'Convertido' | 'Descartado'>>(() => {
    try {
      const saved = localStorage.getItem('adv_leads_status');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const updateLeadStatus = (processoId: string, status: 'Novo' | 'Em Contato' | 'Convertido' | 'Descartado') => {
    const updated = { ...leadsStatus, [processoId]: status };
    setLeadsStatus(updated);
    try {
      localStorage.setItem('adv_leads_status', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

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

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    if (dateStr.includes('-')) {
      const [y, m, d] = dateStr.split('T')[0].split(' ')[0].split('-');
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  };

  const handleSaveManualLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLeadForm.numero.trim()) {
      alert('Por favor, informe o número do processo.');
      return;
    }
    
    if (editingLeadId) {
      const leadToUpdate = state.leads.find(l => l.id === editingLeadId);
      if (leadToUpdate) {
        updateLead({
          ...leadToUpdate,
          numero: formatCNJ(manualLeadForm.numero.trim()),
          classe: manualLeadForm.classe.trim() || 'N/A',
          tribunal: manualLeadForm.tribunal,
          orgao: manualLeadForm.orgao.trim() || 'N/A',
          partes: manualLeadForm.partes.trim() || 'Não informada',
          advogados: manualLeadForm.advogados.trim() || 'Sem Advogado Vinculado',
          disponibilizacao: manualLeadForm.disponibilizacao ? formatDate(manualLeadForm.disponibilizacao) : leadToUpdate.disponibilizacao,
          publicacao: manualLeadForm.publicacao ? formatDate(manualLeadForm.publicacao) : '',
          status: manualLeadForm.status,
          prioridade: manualLeadForm.prioridade,
          resumo: manualLeadForm.resumo.trim()
        });
      }
      setEditingLeadId(null);
      alert('Lead atualizado com sucesso!');
    } else {
      const newLead: Lead = {
        id: `ML${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        numero: formatCNJ(manualLeadForm.numero.trim()),
        classe: manualLeadForm.classe.trim() || 'N/A',
        tribunal: manualLeadForm.tribunal,
        orgao: manualLeadForm.orgao.trim() || 'N/A',
        partes: manualLeadForm.partes.trim() || 'Não informada',
        advogados: manualLeadForm.advogados.trim() || 'Sem Advogado Vinculado',
        disponibilizacao: manualLeadForm.disponibilizacao ? formatDate(manualLeadForm.disponibilizacao) : getTodayInTimezone(state.settings.timezone),
        publicacao: manualLeadForm.publicacao ? formatDate(manualLeadForm.publicacao) : '',
        dataCadastro: getTodayInTimezone(state.settings.timezone),
        status: manualLeadForm.status,
        prioridade: manualLeadForm.prioridade,
        escritorioId: escritorioAtivoId || state.settings?.idEscritorio || '',
        resumo: manualLeadForm.resumo.trim()
      };
      addLead(newLead);
      alert('Lead adicionado manualmente com sucesso!');
    }
    
    setIsManualLeadModalOpen(false);
    
    // Reset form
    setManualLeadForm({
      numero: '',
      classe: '',
      tribunal: 'TJAM',
      orgao: '',
      partes: '',
      advogados: '',
      disponibilizacao: '',
      publicacao: '',
      status: 'Novo',
      prioridade: 'Média',
      resumo: '',
    });
  };

  const handleSearch = async (e?: React.FormEvent, page: number = 1) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    if (page === 1) setResults(null);
    setCurrentPage(page);

    try {
      // Buscar focando no termo distribuição ou julgo com base no filtro selecionado
      const termoBusca = julgado ? 'julgo' : 'distribuição';
      let url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=${page}&itensPorPagina=50&dataDisponibilizacaoInicio=${formData.dataInicio}&dataDisponibilizacaoFim=${formData.dataFim}&texto=${encodeURIComponent(termoBusca)}`;
      
      if (formData.tribunal) {
        url += `&siglaTribunal=${encodeURIComponent(formData.tribunal)}`;
      }

      if (formData.varaId) {
        url += `&orgaoId=${encodeURIComponent(formData.varaId)}`;
      } else if (formData.varaInput.trim()) {
        url += `&nomeOrgao=${encodeURIComponent(formData.varaInput.trim())}`;
      }

      if (bancario) {
        url += `&nomeParte=banco`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Falha ao consultar a API de Comunicações');
      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao consultar API de comunicações de Leads');
    } finally {
      setLoading(false);
    }
  };

  const cleanText = (text: string) => {
    if (!text) return '';
    return text
      .replace(/PODER JUDICIÁRIO[\s\S]*?(?=Autos n|Processo n|Classe|Protocolado)/i, '')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  };

  const findLawyersInText = (text: string) => {
    if (!text) return [];
    const lawyers: string[] = [];
    const lawyerRegex = /(?:ADVOGADOS?|PATRONOS?)(?:\s+(?:DOS?|DAS?|DO[S]?|DA[S]?))?\s+(?:[A-ZÀ-Ú\s]+)?:\s*([^:\n\r]{10,150}?)(?=\s+(?:REPRESENTADO|RÉU|AUTOR|EXECUTADO|EXEQUENTE|PROTOCOLO|VALOR|D E C I S Ã O|$))/gi;
    
    let match;
    while ((match = lawyerRegex.exec(text)) !== null) {
      const namesSection = match[1].trim();
      const individualLawyers = namesSection.split(/(?<=OAB\s*nº?\s*[A-Z]{2}[0-9]+)\s*,?\s*/i);
      individualLawyers.forEach(lawyer => {
        const cleaned = lawyer.trim().replace(/\s+/g, ' ');
        if (
          cleaned && 
          cleaned.length > 8 && 
          !cleaned.includes('R$') && 
          !/^\d+$/.test(cleaned.replace(/\D/g, ''))
        ) {
          lawyers.push(cleaned);
        }
      });
    }
    return Array.from(new Set(lawyers));
  };

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
        /\d{5}-\d{3}/.test(s) || 
        /s\/n/.test(s) || 
        /^\d+$/.test(s.replace(/\D/g, '')) || 
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

  const extractSummaryAndDispositive = (text: string) => {
    if (!text) return { resumo: 'Não extraído', dispositivo: 'Não extraído' };
    const cleaned = cleanText(text);
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

    let dispositivo = '';
    let resumo = cleaned;

    for (const pattern of dispositivePatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        dispositivo = match[0].trim();
        resumo = cleaned.substring(0, match.index).trim();
        break;
      }
    }

    if (resumo.length > 800) {
      resumo = resumo.substring(0, 800) + '... (texto resumido para visualização)';
    }

    return { resumo, dispositivo };
  };

  const formatParties = (destinatarios: any, textParties: { autores: string[], reus: string[] }) => {
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
    
    // Add autores from text (with polo 'A')
    (textParties?.autores || []).forEach(tp => {
      const normalizedTp = tp.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W/g, '');
      if (normalizedTp.length < 5) return;
      
      const isDuplicate = combined.some(p => {
        const normalizedSn = p.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W/g, '');
        return normalizedSn.includes(normalizedTp) || normalizedTp.includes(normalizedSn);
      });
      
      if (!isDuplicate) {
        combined.push({ nome: tp.trim().toUpperCase(), polo: 'A' });
      }
    });

    // Add reus from text (with polo 'P')
    (textParties?.reus || []).forEach(tp => {
      const normalizedTp = tp.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W/g, '');
      if (normalizedTp.length < 5) return;
      
      const isDuplicate = combined.some(p => {
        const normalizedSn = p.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W/g, '');
        return normalizedSn.includes(normalizedTp) || normalizedTp.includes(normalizedSn);
      });
      
      if (!isDuplicate) {
        combined.push({ nome: tp.trim().toUpperCase(), polo: 'P' });
      }
    });
    
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

  const items = useMemo(() => {
    const rawItems = Array.isArray(results) ? results : (results?.items || results?.registros || []);
    // Filtrar para Distribuições ou Julgados dependendo do estado do filtro
    const filtered = rawItems.filter((reg: any) => {
      const tipoDoc = (reg.tipoDocumento || '').toLowerCase();
      const tipoCom = (reg.tipoComunicacao || '').toLowerCase();
      const txt = (reg.texto || '').toLowerCase();
      
      const isDistrib = tipoCom.includes('distribuição') || 
                        tipoDoc.includes('distribuição') || 
                        txt.includes('lista de distribuição') ||
                        txt.includes('distribuído') ||
                        txt.includes('distribuicao');

      const isJulgado = tipoCom.includes('sentença') ||
                        tipoCom.includes('decisão') ||
                        tipoCom.includes('acórdão') ||
                        tipoCom.includes('despacho') ||
                        tipoCom.includes('julgad') ||
                        tipoCom.includes('julgo') ||
                        tipoDoc.includes('sentença') ||
                        tipoDoc.includes('decisão') ||
                        tipoDoc.includes('acórdão') ||
                        tipoDoc.includes('despacho') ||
                        tipoDoc.includes('julgad') ||
                        tipoDoc.includes('julgo') ||
                        txt.includes('sentenca') ||
                        txt.includes('sentença') ||
                        txt.includes('julgad') ||
                        txt.includes('julgo') ||
                        txt.includes('julga') ||
                        txt.includes('acordao') ||
                        txt.includes('decido');

      const matchesType = julgado ? isJulgado : isDistrib;

      if (!matchesType) return false;

      // Se filtro de Vara está preenchido, validar também
      if (formData.varaInput.trim()) {
        const queryVara = formData.varaInput.toLowerCase().trim();
        const orgao = (reg.nomeOrgao || reg.orgaoJulgador || '').toLowerCase();
        if (!orgao.includes(queryVara)) return false;
      }

      return true;
    });

    if (semAdvogado) {
      return filtered.filter((reg: any) => {
        const textLawyers = findLawyersInText(reg.texto || '');
        const allLawyers = formatLawyers(reg.destinatarioadvogados, textLawyers);
        
        if (allLawyers.length === 0) return true;
        
        // Retorna true se TODOS os advogados listados pertencem a sistemas de intimação automática, 
        // representações gerais do tribunal, ou não estão identificados/cadastrados.
        return allLawyers.every((adv: string) => {
          const lower = adv.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return (
            lower.includes('advogado nao identificado') || 
            lower.includes('advogados nao identificados') ||
            lower.includes('advogado nao cadastrado') ||
            lower.includes('advogado sem oab') ||
            lower.includes('sem oab') ||
            lower.includes('oab s/n') ||
            lower.includes('99999999') ||
            lower.includes('9999999') ||
            lower.includes('999999') ||
            lower.includes('sistema de citacao') ||
            lower.includes('intimacao eletronica') ||
            lower.includes('citacao eletronica') ||
            lower.includes('notificacao eletronica') ||
            lower.includes('procuradoria') ||
            lower.includes('defensoria') ||
            lower.includes('ministerio publico') ||
            lower.includes('tribunal') ||
            lower.includes('portal de intimacoes') ||
            lower.includes('intimacoes eletronicas') ||
            lower.includes('fazenda publica') ||
            lower.includes('municipio') ||
            lower.includes('estado de') ||
            lower.includes('uniao federal')
          );
        });
      });
    }

    return filtered;
  }, [results, formData.varaInput, semAdvogado, bancario, julgado]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-app-text tracking-tight uppercase">Radar de Leads</h1>
          <p className="text-app-text-muted mt-1">Sistemática automatizada de prospecção</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('status')}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 border text-app-text font-bold rounded-xl shadow-sm text-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
              activeTab === 'status'
                ? 'bg-primary text-white border-primary'
                : 'bg-app-surface border-app-border hover:bg-app-secondary'
            }`}
          >
            <Settings size={18} />
            Gerenciar Status
          </button>
          <button
            onClick={() => setIsManualLeadModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-opacity-95 shadow-sm text-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <UserPlus size={18} />
            Adicionar Lead Manual
          </button>
        </div>
      </div>

      <div className="flex border-b border-app-border gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('busca')}
          className={`px-4 py-2.5 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'busca'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text hover:border-app-border'
          }`}
        >
          <Search size={16} />
          Busca de Leads
        </button>
        <button
          onClick={() => setActiveTab('salvos')}
          className={`px-4 py-2.5 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 relative whitespace-nowrap ${
            activeTab === 'salvos'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text hover:border-app-border'
          }`}
        >
          <Scale size={16} />
          Leads Salvos (Cards)
          {activeOfficeLeads && activeOfficeLeads.length > 0 && (
            <span className="bg-primary/20 text-primary text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ml-1">
              {activeOfficeLeads.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('tabela')}
          className={`px-4 py-2.5 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 relative whitespace-nowrap ${
            activeTab === 'tabela'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text hover:border-app-border'
          }`}
        >
          <FileText size={16} />
          Leads Salvos (Tabela)
          {activeOfficeLeads && activeOfficeLeads.length > 0 && (
            <span className="bg-primary/20 text-primary text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ml-1">
              {activeOfficeLeads.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2.5 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2 relative whitespace-nowrap ${
            activeTab === 'status'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text hover:border-app-border'
          }`}
        >
          <Settings size={16} />
          Status dos Leads (`leads_status`)
          {availableStatuses && availableStatuses.length > 0 && (
            <span className="bg-primary/20 text-primary text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ml-1">
              {availableStatuses.length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'busca' ? (
          <motion.div
            key="busca-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-1 space-y-6">
              <form onSubmit={(e) => handleSearch(e, 1)} className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-app-text mb-2">Filtros de Prospecção</h2>
                
                <div>
                  <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Tribunal</label>
                  <div className="mt-1">
                    <select
                      className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-medium"
                      value={formData.tribunal}
                      onChange={(e) => setFormData(prev => ({ ...prev, tribunal: e.target.value }))}
                    >
                      {tribunals.map(t => (
                        <option key={t.id || t.sigla} value={t.sigla || t.id}>
                          {t.nome || t.sigla}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Vara / Órgão Julgador</label>
                  <div className="mt-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                    <input
                      type="text"
                      className="w-full pl-10 pr-10 py-3 bg-app-bg border border-app-border rounded-xl text-app-text focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                      placeholder="Selecione ou digite a vara..."
                      value={formData.varaInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          varaInput: value,
                          varaId: prev.varaId && value === prev.varaInput ? prev.varaId : ''
                        }));
                        setShowVaraDropdown(true);
                      }}
                      onFocus={() => setShowVaraDropdown(true)}
                      onBlur={() => setTimeout(() => setShowVaraDropdown(false), 200)}
                    />
                    {formData.varaInput && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, varaInput: '', varaId: '' }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text text-sm font-bold"
                      >
                        ×
                      </button>
                    )}

                    {/* Dropdown de Autocomplete para Vara */}
                    {showVaraDropdown && formData.varaInput.length >= 2 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-app-surface border border-app-border rounded-xl shadow-lg max-h-60 overflow-y-auto z-50">
                        {filteredVarasForAutocomplete.length > 0 ? (
                          filteredVarasForAutocomplete.map(v => (
                            <button
                              key={v.id}
                              type="button"
                              onMouseDown={() => handleVaraSelect(v)}
                              className="w-full text-left px-4 py-2.5 hover:bg-app-bg text-app-text text-xs transition-colors border-b border-app-border last:border-b-0 flex flex-col gap-0.5"
                            >
                              <span className="font-semibold">{v.nome}</span>
                              <span className="text-[10px] text-app-text-muted">ID / órgão ID: {v.id}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs text-app-text-muted bg-app-surface">
                            Nenhuma vara cadastrada correspondente
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {formData.varaId && (
                    <div className="mt-1 text-xs text-emerald-500 font-semibold flex items-center gap-1.5">
                      <CheckCircle size={12} />
                      <span>Vara selecionada (órgão ID: {formData.varaId})</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Data Início</label>
                    <div className="mt-1 relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                      <input
                        type="date"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={formData.dataInicio}
                        onChange={(e) => setFormData(prev => ({ ...prev, dataInicio: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Data Fim</label>
                    <div className="mt-1 relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                      <input
                        type="date"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={formData.dataFim}
                        onChange={(e) => setFormData(prev => ({ ...prev, dataFim: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 py-2.5 bg-app-bg/30 px-3 rounded-xl border border-app-border/40">
                  <input
                    type="checkbox"
                    id="semAdvogado"
                    checked={semAdvogado}
                    onChange={(e) => setSemAdvogado(e.target.checked)}
                    className="w-4 h-4 text-primary bg-app-bg border-app-border rounded focus:ring-primary focus:ring-2 accent-primary cursor-pointer"
                  />
                  <label htmlFor="semAdvogado" className="text-xs font-semibold text-app-text select-none cursor-pointer flex flex-col">
                    <span>Apenas sem advogado</span>
                    <span className="text-[10px] text-app-text-muted font-normal">OAB nula, não identificada ou de representação geral (99999999N)</span>
                  </label>
                </div>

                <div className="flex items-center gap-2.5 py-2.5 bg-app-bg/30 px-3 rounded-xl border border-app-border/40">
                  <input
                    type="checkbox"
                    id="bancario"
                    checked={bancario}
                    onChange={(e) => setBancario(e.target.checked)}
                    className="w-4 h-4 text-primary bg-app-bg border-app-border rounded focus:ring-primary focus:ring-2 accent-primary cursor-pointer"
                  />
                  <label htmlFor="bancario" className="text-xs font-semibold text-app-text select-none cursor-pointer flex flex-col">
                    <span>Filtro Bancário</span>
                    <span className="text-[10px] text-app-text-muted font-normal">Filtra distribuições buscando banco na API (&nomeParte=banco)</span>
                  </label>
                </div>

                <div className="flex items-center gap-2.5 py-2.5 bg-app-bg/30 px-3 rounded-xl border border-app-border/40">
                  <input
                    type="checkbox"
                    id="julgado"
                    checked={julgado}
                    onChange={(e) => setJulgado(e.target.checked)}
                    className="w-4 h-4 text-primary bg-app-bg border-app-border rounded focus:ring-primary focus:ring-2 accent-primary cursor-pointer"
                  />
                  <label htmlFor="julgado" className="text-xs font-semibold text-app-text select-none cursor-pointer flex flex-col">
                    <span>Filtro Julgado</span>
                    <span className="text-[10px] text-app-text-muted font-normal">Filtra decisões/sentenças na API (&texto=julgo)</span>
                  </label>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Buscando Leads...' : julgado ? 'Mapear Julgados' : 'Mapear Listas de Distribuição'}
                  </button>

                  <a
                    href={`https://comunica.pje.jus.br/consulta?texto=julgo&siglaTribunal=${encodeURIComponent(formData.tribunal)}&dataDisponibilizacaoInicio=${formData.dataInicio}&dataDisponibilizacaoFim=${formData.dataFim}${formData.varaId ? `&orgaoId=${formData.varaId}` : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 bg-app-secondary border border-app-border text-app-text hover:text-primary font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2"
                    title="Explorar julgamentos no portal oficial do PJe"
                  >
                    <ExternalLink size={14} className="shrink-0" />
                    Consultar Julgados no Comunica PJe
                  </a>
                </div>
              </form>

              {/* Dica de Prospecção */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-sm space-y-3">
                <h4 className="font-bold text-primary flex items-center gap-2">💡 Dica de Prospecção Ativa</h4>
                <p className="text-app-text-muted text-xs leading-relaxed">
                  Mapeando novos processos distribuídos na comarca de interesse nas últimas 24h, você pode identificar potenciais clientes que necessitam de assessoria imediata antes mesmo de serem citados judicialmente.
                </p>
              </div>
            </div>

            <div className="lg:col-span-2">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 text-sm">
                  <ShieldAlert size={20} />
                  <span>{error}</span>
                </div>
              )}

              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-app-surface border border-app-border rounded-2xl p-20 flex flex-col items-center justify-center text-center space-y-4"
                  >
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <h3 className="text-lg font-bold text-app-text">Mapeando Redes de Tribunais...</h3>
                    <p className="text-app-text-muted text-sm max-w-xs">Varrendo comunicações eletrônicas de distribuição em tempo real.</p>
                  </motion.div>
                ) : items.length > 0 ? (
                  <motion.div 
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Métricas rápidas */}
                    <div className="grid grid-cols-3 gap-4 bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm">
                      <div className="text-center p-2 border-r border-app-border">
                        <p className="text-[10px] font-extrabold text-app-text-muted uppercase">Total de Leads</p>
                        <p className="text-2xl font-bold text-app-text mt-1">{items.length}</p>
                      </div>
                      <div className="text-center p-2 border-r border-app-border">
                        <p className="text-[10px] font-extrabold text-app-text-muted uppercase">Contatados</p>
                        <p className="text-2xl font-bold text-amber-500 mt-1">
                          {Object.values(leadsStatus).filter(s => s === 'Em Contato').length}
                        </p>
                      </div>
                      <div className="text-center p-2">
                        <p className="text-[10px] font-extrabold text-app-text-muted uppercase">Convertidos</p>
                        <p className="text-2xl font-bold text-green-500 mt-1">
                          {Object.values(leadsStatus).filter(s => s === 'Convertido').length}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {items.map((reg: any, idx: number) => {
                        const { resumo } = extractSummaryAndDispositive(reg.texto || '');
                        const textParties = findPartiesInText(reg.texto || '');
                        const textLawyers = findLawyersInText(reg.texto || '');
                        const allParties = formatParties(reg.destinatarios, textParties);
                        const allLawyers = formatLawyers(reg.destinatarioadvogados, textLawyers);
                        const rawData = reg.datadisponibilizacao || reg.dataDisponibilizacao || reg.dataPublicacao || 'N/A';
                        const pubInfo = getNthBusinessDay(rawData, reg.siglaTribunal || 'TJ', 1);

                        const displayData = {
                          id: reg.id || `lead-${idx}`,
                          tribunal: reg.siglaTribunal || 'TJ',
                          orgao: reg.nomeOrgao || reg.orgaoJulgador || 'Portal PJe',
                          processo: reg.numeroprocessocommascara || reg.numeroProcesso || 'N/A',
                          classe: reg.nomeClasse || reg.classeProcessual || 'N/A',
                          tipo: `${reg.tipoDocumento || 'ATO'} – ${reg.tipoComunicacao || 'COMUNICAÇÃO'}`,
                          partes: allParties,
                          advogados: allLawyers,
                          resumo: resumo,
                          disponibilizacao: formatDate(rawData),
                          publicacao: pubInfo.formatted,
                        };

                        const rawProcessoStr = displayData.processo.replace(/\D/g, '');
                        const leadState = leadsStatus[rawProcessoStr] || 'Novo';

                        return (
                          <motion.article 
                            key={idx}
                            className="bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            {/* Status bar */}
                            <div className="bg-app-bg px-6 py-3 border-b border-app-border flex items-center justify-between">
                              <span className="text-xs font-bold text-app-text-muted uppercase tracking-wider">
                                Disponibilizado em {displayData.disponibilizacao}
                              </span>
                              
                              {/* Leads CRM Selector */}
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-extrabold text-app-text-muted uppercase">Acompanhamento:</span>
                                <select
                                  value={leadState}
                                  onChange={(e) => updateLeadStatus(rawProcessoStr, e.target.value as any)}
                                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none ${
                                    leadState === 'Novo' ? 'bg-primary/10 border-primary text-primary' :
                                    leadState === 'Em Contato' ? 'bg-amber-500/10 border-amber-500 text-amber-500' :
                                    leadState === 'Convertido' ? 'bg-green-500/10 border-green-500 text-green-500' :
                                    'bg-gray-500/10 border-gray-500 text-gray-500'
                                  }`}
                                >
                                  <option value="Novo">🆕 Novo Lead</option>
                                  <option value="Em Contato">📞 Em Contato</option>
                                  <option value="Convertido">✅ Convertido</option>
                                  <option value="Descartado">❌ Descartado</option>
                                </select>
                              </div>
                            </div>

                            <div className="p-6 space-y-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <span className="text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    {displayData.tribunal} • {displayData.orgao}
                                  </span>
                                  <h3 className="text-xl font-bold text-app-text mt-2 font-mono flex items-center gap-2">
                                    {displayData.processo}
                                    <button 
                                      onClick={() => navigator.clipboard.writeText(displayData.processo)}
                                      className="p-1 hover:bg-app-bg rounded-lg text-app-text-muted transition-colors"
                                      title="Copiar CNJ"
                                    >
                                      <Copy size={14} />
                                    </button>
                                  </h3>
                                  <p className="text-xs text-app-text-muted mt-1 uppercase">Classe: {displayData.classe}</p>
                                </div>
                                
                                <div className="flex items-center gap-1.5">
                                  {/* Botão de Adicionar Lead */}
                                  {activeOfficeLeads?.some((l: any) => l.numero.replace(/\D/g, '') === rawProcessoStr) ? (
                                    <span className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 border border-primary/20">
                                      <CheckCircle size={14} />
                                      Lead Adicionado
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newLead: Lead = {
                                          id: displayData.id,
                                          numero: displayData.processo,
                                          classe: displayData.classe,
                                          tribunal: displayData.tribunal,
                                          orgao: displayData.orgao,
                                          partes: displayData.partes.map((p: any, i: number) => {
                                            const finalPolo = p.polo ? (p.polo.toString().toUpperCase().startsWith('A') ? 'A' : 'P') : (i === 0 ? 'A' : 'P');
                                            return `${finalPolo}: ${p.nome}`;
                                          }).join(' | '),
                                          advogados: displayData.advogados.join(' | '),
                                          disponibilizacao: displayData.disponibilizacao,
                                          publicacao: displayData.publicacao,
                                          dataCadastro: new Date().toISOString().split('T')[0],
                                          status: leadState as Lead['status'],
                                          prioridade: 'Média',
                                          escritorioId: escritorioAtivoId || state.settings?.idEscritorio || ''
                                        };
                                        addLead(newLead);
                                      }}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                      title="Adicionar aos Leads Salvos"
                                    >
                                      <UserPlus size={14} />
                                      Adicionar Lead
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* PARTES PARSADAS */}
                              <div className="border-t border-app-border pt-3">
                                <p className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-wider mb-2">Partes:</p>
                                <div className="flex flex-wrap gap-2">
                                  {displayData.partes.map((p: any, i: number) => {
                                    const isAutor = p.polo ? p.polo.toString().toUpperCase().startsWith('A') : (i === 0);
                                    const exists = state.contatos?.some(c => c.nome.toLowerCase().trim() === p.nome.toLowerCase().trim());
                                    return (
                                      <div 
                                        key={i} 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all hover:bg-app-bg cursor-pointer`}
                                        style={{
                                          backgroundColor: isAutor ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                          borderColor: isAutor ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                          color: isAutor ? '#16a34a' : '#dc2626'
                                        }}
                                        onClick={() => handleContactClick(p.nome)}
                                        title={exists ? "Visualizar Contato" : "Adicionar Contato"}
                                      >
                                        <span className="uppercase text-[9px] font-extrabold opacity-60">
                                          {isAutor ? 'AUTOR' : 'RÉU'}:
                                        </span>
                                        <span>{p.nome}</span>
                                        {exists ? (
                                          <Eye size={12} className="opacity-70 text-primary" />
                                        ) : (
                                          <UserPlus size={12} className="opacity-70" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* ADVOGADOS PARSADOS */}
                              <div className="border-t border-app-border pt-3">
                                <p className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-wider mb-2">Advogados:</p>
                                <ul className="text-xs pl-2 space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                                  {displayData.advogados.map((adv: string, i: number) => (
                                    <li key={i} className="flex items-center gap-2 text-app-text">
                                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                      {adv}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* TEOR DA PUBLICAÇÃO (Apenas quando o filtro de Julgado/julgo está ativo) */}
                              {julgado && reg.texto && (
                                <div className="border-t border-app-border pt-4 mt-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                      <FileText size={12} />
                                      Teor do Julgamento / Publicação:
                                    </p>
                                    <button
                                      onClick={() => {
                                        try {
                                          navigator.clipboard.writeText(reg.texto || '');
                                          alert('Teor copiado com sucesso!');
                                        } catch (err) {
                                          console.error(err);
                                        }
                                      }}
                                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                                      type="button"
                                    >
                                      <Copy size={11} />
                                      Copiar Teor
                                    </button>
                                  </div>
                                  <div className="bg-app-bg/65 border border-app-border rounded-xl p-4 max-h-60 overflow-y-auto font-serif text-xs leading-relaxed text-app-text/90 whitespace-pre-wrap select-text scrollbar-thin scrollbar-thumb-app-border">
                                    {reg.texto}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.article>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-app-surface border border-dashed border-app-border rounded-2xl p-20 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-app-bg rounded-full flex items-center justify-center mb-6">
                      <Search size={32} className="text-app-text-muted" />
                    </div>
                    <h3 className="text-xl font-bold text-app-text">Nenhum Lead Encontrado</h3>
                    <p className="text-app-text-muted max-w-sm mx-auto mt-2 text-sm leading-relaxed">
                      Preencha os filtros de prospecção jurídica ao lado para buscar registros de novas distribuições eletrônicas.
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : activeTab === 'salvos' ? (
          <motion.div
            key="salvos-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Filters Bar for saved leads */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                <input
                  type="text"
                  placeholder="Pesquisar nos leads salvos (número, órgão, partes, advogados...)"
                  className="w-full pl-10 pr-4 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={savedSearch}
                  onChange={(e) => setSavedSearch(e.target.value)}
                />
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2 relative">
                  <span className="text-xs font-semibold text-app-text-muted uppercase shrink-0">Status:</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsStatusDropdownOpenCards(!isStatusDropdownOpenCards)}
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer min-w-[180px]"
                    >
                      <span>{getStatusFilterLabel()}</span>
                      <ChevronDown size={16} className={`transition-transform duration-200 ${isStatusDropdownOpenCards ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isStatusDropdownOpenCards && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setIsStatusDropdownOpenCards(false)} 
                        />
                        <div className="absolute right-0 mt-2 w-56 bg-app-surface border border-app-border rounded-xl shadow-lg py-2 z-20 space-y-1">
                          <label className="flex items-center gap-3 px-4 py-2 hover:bg-app-secondary cursor-pointer transition-colors text-sm text-app-text font-medium">
                            <input
                              type="checkbox"
                              className="rounded border-app-border text-primary focus:ring-primary focus:ring-offset-app-surface h-4 w-4"
                              checked={savedStatusFilters.length === availableStatuses.length}
                              onChange={handleSelectAllStatuses}
                            />
                            <span>📋 Todos os Status</span>
                          </label>
                          <div className="border-t border-app-border my-1" />
                          {availableStatuses.map(st => {
                            const isChecked = savedStatusFilters.some(s => s.toLowerCase() === st.nome.toLowerCase());
                            return (
                              <label key={st.id || st.nome} className="flex items-center gap-3 px-4 py-2 hover:bg-app-secondary cursor-pointer transition-colors text-sm text-app-text font-medium">
                                <input
                                  type="checkbox"
                                  className="rounded border-app-border text-primary focus:ring-primary focus:ring-offset-app-surface h-4 w-4"
                                  checked={isChecked}
                                  onChange={() => toggleStatusFilter(st.nome)}
                                />
                                <span className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.cor || '#3B82F6' }} />
                                  {st.nome}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={exportToXLSX}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  title="Exportar todos os leads filtrados para XLSX (Excel)"
                >
                  <Download size={16} />
                  Exportar XLSX
                </button>
              </div>
            </div>

            {/* Leads Grid */}
            {filteredSavedLeads.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredSavedLeads.map((lead) => {
                  const rawProcessoStr = lead.numero.replace(/\D/g, '');
                  
                  return (
                    <motion.article 
                      key={lead.id}
                      className="bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
                      layout
                    >
                      {/* Status header bar */}
                      <div className="bg-app-bg px-6 py-3 border-b border-app-border flex items-center justify-between">
                        <span className="text-xs font-semibold text-app-text-muted uppercase tracking-wider flex items-center gap-1.5">
                          <Clock size={12} />
                          Adicionado em {formatDate(lead.dataCadastro)}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <select
                            value={lead.status || 'Novo'}
                            onChange={(e) => {
                              updateLead({
                                ...lead,
                                status: e.target.value
                              });
                            }}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none transition-colors"
                            style={{
                              backgroundColor: `${getStatusColor(lead.status)}18`,
                              borderColor: getStatusColor(lead.status),
                              color: getStatusColor(lead.status)
                            }}
                          >
                            {availableStatuses.map(st => (
                              <option key={st.id || st.nome} value={st.nome} className="bg-app-surface text-app-text">
                                {st.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            {lead.tribunal} • {lead.orgao}
                          </span>
                          
                          <select
                            value={lead.prioridade || 'Média'}
                            onChange={(e) => {
                              updateLead({
                                ...lead,
                                prioridade: e.target.value as any
                              });
                            }}
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border focus:outline-none ${
                              lead.prioridade === 'Urgente' ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' :
                              lead.prioridade === 'Alta' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
                              lead.prioridade === 'Baixa' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                              'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            <option value="Baixa">🟢 Baixa</option>
                            <option value="Média">🔵 Média</option>
                            <option value="Alta">🟡 Alta</option>
                            <option value="Urgente">🔴 Urgente</option>
                          </select>
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-app-text mt-2 font-mono flex items-center gap-2">
                            {lead.numero}
                            <button 
                              onClick={() => navigator.clipboard.writeText(lead.numero)}
                              className="p-1 hover:bg-app-bg rounded-lg text-app-text-muted transition-colors"
                              title="Copiar CNJ"
                            >
                              <Copy size={14} />
                            </button>
                          </h3>
                          <p className="text-xs text-app-text-muted mt-1 uppercase">Classe: {lead.classe}</p>
                        </div>

                        {/* Partes */}
                        {lead.partes && (
                          <div className="border-t border-app-border pt-3">
                            <p className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-wider mb-2">Partes:</p>
                            <div className="flex flex-wrap gap-2">
                              {lead.partes.split(' | ').map((pStr, i) => {
                                const [polo, name] = pStr.includes(': ') ? pStr.split(': ') : [null, pStr];
                                const isAutor = polo === 'A';
                                const exists = state.contatos?.some(c => c.nome.toLowerCase().trim() === name.toLowerCase().trim());
                                return (
                                  <div 
                                    key={i} 
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all hover:bg-app-bg cursor-pointer`}
                                    style={{
                                      backgroundColor: isAutor ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                      borderColor: isAutor ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: isAutor ? '#16a34a' : '#dc2626'
                                    }}
                                    onClick={() => handleContactClick(name)}
                                    title={exists ? "Visualizar Contato" : "Adicionar Contato"}
                                  >
                                    <span className="uppercase text-[9px] font-extrabold opacity-60">
                                      {isAutor ? 'AUTOR' : 'RÉU'}:
                                    </span>
                                    <span className="truncate max-w-[150px]">{name}</span>
                                    {exists ? (
                                      <Eye size={12} className="opacity-70 text-primary" />
                                    ) : (
                                      <UserPlus size={12} className="opacity-70" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Advogados */}
                        {lead.advogados && (
                          <div className="border-t border-app-border pt-3">
                            <p className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-wider mb-1.5">Advogados:</p>
                            <ul className="text-xs text-app-text space-y-1 bg-app-bg/50 p-2.5 rounded-xl border border-app-border/40">
                              {lead.advogados.split(' | ').map((a, idx) => (
                                <li key={idx} className="flex items-center gap-1.5 font-medium text-app-text-muted break-all">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                                  <span>{a}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Date Fields */}
                        <div className="flex gap-4 border-t border-app-border pt-3 text-[11px] text-app-text-muted font-semibold">
                          <div>
                            <strong>Disponibilização:</strong> {lead.disponibilizacao}
                          </div>
                          {lead.publicacao && (
                            <div>
                              <strong>Publicação:</strong> {lead.publicacao}
                            </div>
                          )}
                        </div>

                        {/* Observações se houver */}
                        {lead.resumo && (
                          <div className="border-t border-app-border pt-3">
                            <p className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                              <FileText size={10} className="text-primary" />
                              Observações:
                            </p>
                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-xs text-app-text font-medium leading-relaxed max-h-[120px] overflow-y-auto whitespace-pre-wrap">
                              {lead.resumo}
                            </div>
                          </div>
                        )}

                        {/* CTA Buttons */}
                        <div className="border-t border-app-border pt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const alreadyRegistered = state.processos?.some((p: any) => p.numero.replace(/\D/g, '') === rawProcessoStr);
                                if (alreadyRegistered) {
                                  alert('Este processo já está cadastrado em sua carteira ativa.');
                                  return;
                                }
                                
                                const partesParsed = lead.partes ? lead.partes.split(' | ').map(pStr => {
                                  const [polo, name] = pStr.includes(': ') ? pStr.split(': ') : [null, pStr];
                                  return {
                                    nome: name,
                                    tipoPolo: polo === 'A' ? 'Ativo' : (polo === 'P' ? 'Passivo' : 'Outro')
                                  };
                                }) : [];

                                setInitialProcessoData({
                                  numeroProcesso: lead.numero,
                                  classe: lead.classe,
                                  tribunal: lead.tribunal,
                                  orgaoJulgador: lead.orgao,
                                  partes: partesParsed,
                                  link: '',
                                  disponibilizacao: lead.disponibilizacao,
                                  publicacao: lead.publicacao,
                                  escritorioId: lead.escritorioId || escritorioAtivoId || ''
                                });
                                setIsProcessoModalOpen(true);
                              }}
                              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm ${
                                state.processos?.some((p: any) => p.numero.replace(/\D/g, '') === rawProcessoStr)
                                  ? 'bg-green-500/10 text-green-500 cursor-not-allowed border border-green-500/20'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              <FolderPlus size={14} />
                              {state.processos?.some((p: any) => p.numero.replace(/\D/g, '') === rawProcessoStr)
                                ? 'Processo Cadastrado'
                                : 'Importar como Processo'
                              }
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLeadForResumo(lead);
                                setResumoText(lead.resumo || '');
                                setIsEditingResumo(!lead.resumo);
                                setIsResumoModalOpen(true);
                              }}
                              className="px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm border border-app-border bg-app-bg hover:bg-app-border text-app-text-muted hover:text-app-text cursor-pointer"
                            >
                              <FileText size={14} />
                              {lead.resumo ? 'Observações' : 'Adicionar Observações'}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingLeadId(lead.id);
                              setManualLeadForm({
                                numero: lead.numero,
                                classe: lead.classe || '',
                                tribunal: lead.tribunal,
                                orgao: lead.orgao || '',
                                partes: lead.partes || '',
                                advogados: lead.advogados || '',
                                disponibilizacao: lead.disponibilizacao || '',
                                publicacao: lead.publicacao || '',
                                status: lead.status,
                                prioridade: lead.prioridade || 'Média',
                                resumo: lead.resumo || '',
                              });
                              setIsManualLeadModalOpen(true);
                            }}
                            className="p-2 border border-app-border hover:bg-app-secondary text-app-text rounded-xl transition-colors shadow-sm flex items-center justify-center shrink-0"
                            title="Editar Lead"
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Tem certeza de que deseja excluir este Lead?')) {
                                deleteLead(lead.id);
                              }
                            }}
                            className="p-2 border border-red-200 hover:bg-red-500/10 text-red-500 rounded-xl transition-colors shadow-sm flex items-center justify-center shrink-0"
                            title="Excluir Lead"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            ) : (
              <div className="bg-app-surface border border-dashed border-app-border rounded-2xl p-20 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-app-bg rounded-full flex items-center justify-center mb-6">
                  <Scale size={32} className="text-app-text-muted" />
                </div>
                <h3 className="text-xl font-bold text-app-text">Nenhum Lead Salvo</h3>
                <p className="text-app-text-muted max-w-sm mx-auto mt-2 text-sm leading-relaxed">
                  Adicione leads a partir do radar de buscas para começar a gerenciar sua prospecção de forma centralizada.
                </p>
              </div>
            )}
          </motion.div>
        ) : activeTab === 'tabela' ? (
          <motion.div
            key="tabela-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Filters Bar for saved leads */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                <input
                  type="text"
                  placeholder="Pesquisar nos leads salvos (número, órgão, partes, advogados...)"
                  className="w-full pl-10 pr-4 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={savedSearch}
                  onChange={(e) => setSavedSearch(e.target.value)}
                />
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2 relative">
                  <span className="text-xs font-semibold text-app-text-muted uppercase shrink-0">Status:</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsStatusDropdownOpenTable(!isStatusDropdownOpenTable)}
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer min-w-[180px]"
                    >
                      <span>{getStatusFilterLabel()}</span>
                      <ChevronDown size={16} className={`transition-transform duration-200 ${isStatusDropdownOpenTable ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isStatusDropdownOpenTable && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setIsStatusDropdownOpenTable(false)} 
                        />
                        <div className="absolute right-0 mt-2 w-56 bg-app-surface border border-app-border rounded-xl shadow-lg py-2 z-20 space-y-1">
                          <label className="flex items-center gap-3 px-4 py-2 hover:bg-app-secondary cursor-pointer transition-colors text-sm text-app-text font-medium">
                            <input
                              type="checkbox"
                              className="rounded border-app-border text-primary focus:ring-primary focus:ring-offset-app-surface h-4 w-4"
                              checked={savedStatusFilters.length === availableStatuses.length}
                              onChange={handleSelectAllStatuses}
                            />
                            <span>📋 Todos os Status</span>
                          </label>
                          <div className="border-t border-app-border my-1" />
                          {availableStatuses.map(st => {
                            const isChecked = savedStatusFilters.some(s => s.toLowerCase() === st.nome.toLowerCase());
                            return (
                              <label key={st.id || st.nome} className="flex items-center gap-3 px-4 py-2 hover:bg-app-secondary cursor-pointer transition-colors text-sm text-app-text font-medium">
                                <input
                                  type="checkbox"
                                  className="rounded border-app-border text-primary focus:ring-primary focus:ring-offset-app-surface h-4 w-4"
                                  checked={isChecked}
                                  onChange={() => toggleStatusFilter(st.nome)}
                                />
                                <span className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.cor || '#3B82F6' }} />
                                  {st.nome}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={exportToXLSX}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  title="Exportar todos os leads filtrados para XLSX (Excel)"
                >
                  <Download size={16} />
                  Exportar XLSX
                </button>
              </div>
            </div>

            {/* Table layout */}
            {sortedSavedLeads.length > 0 ? (
              <div className="bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-app-bg border-b border-app-border text-xs font-semibold text-app-text-muted uppercase tracking-wider">
                        <th className="p-4 cursor-pointer hover:bg-app-secondary/50 select-none transition-colors" onClick={() => requestLeadSort('numero')}>
                          <div className="flex items-center gap-1.5">
                            <span>Número / CNJ</span>
                            {leadSortConfig?.key === 'numero' && (
                              <span className="text-primary">{leadSortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                            )}
                          </div>
                        </th>
                        <th className="p-4 cursor-pointer hover:bg-app-secondary/50 select-none transition-colors" onClick={() => requestLeadSort('prioridade')}>
                          <div className="flex items-center gap-1.5">
                            <span>Prioridade</span>
                            {leadSortConfig?.key === 'prioridade' && (
                              <span className="text-primary">{leadSortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                            )}
                          </div>
                        </th>
                        <th className="p-4 cursor-pointer hover:bg-app-secondary/50 select-none transition-colors" onClick={() => requestLeadSort('status')}>
                          <div className="flex items-center gap-1.5">
                            <span>Status</span>
                            {leadSortConfig?.key === 'status' && (
                              <span className="text-primary">{leadSortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                            )}
                          </div>
                        </th>
                        <th className="p-4 cursor-pointer hover:bg-app-secondary/50 select-none transition-colors" onClick={() => requestLeadSort('tribunal')}>
                          <div className="flex items-center gap-1.5">
                            <span>Tribunal / Órgão</span>
                            {leadSortConfig?.key === 'tribunal' && (
                              <span className="text-primary">{leadSortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                            )}
                          </div>
                        </th>
                        <th className="p-4 cursor-pointer hover:bg-app-secondary/50 select-none transition-colors" onClick={() => requestLeadSort('partes')}>
                          <div className="flex items-center gap-1.5">
                            <span>Partes</span>
                            {leadSortConfig?.key === 'partes' && (
                              <span className="text-primary">{leadSortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                            )}
                          </div>
                        </th>
                        <th className="p-4 cursor-pointer hover:bg-app-secondary/50 select-none transition-colors" onClick={() => requestLeadSort('dataCadastro')}>
                          <div className="flex items-center gap-1.5">
                            <span>Cadastro</span>
                            {leadSortConfig?.key === 'dataCadastro' && (
                              <span className="text-primary">{leadSortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                            )}
                          </div>
                        </th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border text-sm text-app-text">
                      {sortedSavedLeads.map((lead) => {
                        const rawProcessoStr = lead.numero.replace(/\D/g, '');
                        return (
                          <tr key={lead.id} className="hover:bg-app-bg/40 transition-colors">
                            <td className="p-4 font-mono font-semibold">
                              <div className="flex items-center gap-2">
                                <span>{lead.numero}</span>
                                <button 
                                  onClick={() => navigator.clipboard.writeText(lead.numero)}
                                  className="p-1 hover:bg-app-secondary rounded text-app-text-muted hover:text-app-text transition-colors"
                                  title="Copiar CNJ"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                            </td>
                            <td className="p-4">
                              <select
                                value={lead.prioridade || 'Média'}
                                onChange={(e) => {
                                  updateLead({
                                    ...lead,
                                    prioridade: e.target.value as any
                                  });
                                }}
                                className={`text-xs font-bold px-2 py-1 rounded-lg border focus:outline-none ${
                                  lead.prioridade === 'Urgente' ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' :
                                  lead.prioridade === 'Alta' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
                                  lead.prioridade === 'Baixa' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                  'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                                }`}
                              >
                                <option value="Baixa">🟢 Baixa</option>
                                <option value="Média">🔵 Média</option>
                                <option value="Alta">🟡 Alta</option>
                                <option value="Urgente">🔴 Urgente</option>
                              </select>
                            </td>
                            <td className="p-4">
                              <select
                                value={lead.status || 'Novo'}
                                onChange={(e) => {
                                  updateLead({
                                    ...lead,
                                    status: e.target.value
                                  });
                                }}
                                className="text-xs font-bold px-2 py-1 rounded-lg border focus:outline-none transition-colors"
                                style={{
                                  backgroundColor: `${getStatusColor(lead.status)}18`,
                                  borderColor: getStatusColor(lead.status),
                                  color: getStatusColor(lead.status)
                                }}
                              >
                                {availableStatuses.map(st => (
                                  <option key={st.id || st.nome} value={st.nome} className="bg-app-surface text-app-text">
                                    {st.nome}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-xs text-primary">{lead.tribunal}</span>
                                <span className="text-xs text-app-text-muted truncate max-w-[200px]" title={lead.orgao}>{lead.orgao}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              {lead.partes ? (
                                <div className="flex flex-wrap gap-1.5 max-w-[300px]">
                                  {lead.partes.split(' | ').map((pStr, i) => {
                                    const [polo, name] = pStr.includes(': ') ? pStr.split(': ') : [null, pStr];
                                    const isAutor = polo === 'A';
                                    const exists = state.contatos?.some(c => c.nome.toLowerCase().trim() === name.toLowerCase().trim());
                                    return (
                                      <div 
                                        key={i} 
                                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border transition-all hover:bg-app-bg cursor-pointer`}
                                        style={{
                                          backgroundColor: isAutor ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                          borderColor: isAutor ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                          color: isAutor ? '#16a34a' : '#dc2626'
                                        }}
                                        onClick={() => handleContactClick(name)}
                                        title={exists ? "Visualizar Contato" : "Adicionar Contato"}
                                      >
                                        <span className="uppercase text-[8px] font-extrabold opacity-60">
                                          {isAutor ? 'AUTOR' : 'RÉU'}:
                                        </span>
                                        <span className="truncate max-w-[100px]">{name}</span>
                                        {exists ? (
                                          <Eye size={10} className="opacity-70 text-primary" />
                                        ) : (
                                          <UserPlus size={10} className="opacity-70" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-xs text-app-text-muted">-</span>
                              )}
                            </td>
                            <td className="p-4 text-xs text-app-text-muted">
                              {formatDate(lead.dataCadastro)}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const alreadyRegistered = state.processos?.some((p: any) => p.numero.replace(/\D/g, '') === rawProcessoStr);
                                    if (alreadyRegistered) {
                                      alert('Este processo já está cadastrado em sua carteira ativa.');
                                      return;
                                    }
                                    
                                    const partesParsed = lead.partes ? lead.partes.split(' | ').map(pStr => {
                                      const [polo, name] = pStr.includes(': ') ? pStr.split(': ') : [null, pStr];
                                      return {
                                        nome: name,
                                        tipoPolo: polo === 'A' ? 'Ativo' : (polo === 'P' ? 'Passivo' : 'Outro')
                                      };
                                    }) : [];

                                    setInitialProcessoData({
                                      numeroProcesso: lead.numero,
                                      classe: lead.classe,
                                      tribunal: lead.tribunal,
                                      orgaoJulgador: lead.orgao,
                                      partes: partesParsed,
                                      link: '',
                                      disponibilizacao: lead.disponibilizacao,
                                      publicacao: lead.publicacao,
                                      escritorioId: lead.escritorioId || escritorioAtivoId || ''
                                    });
                                    setIsProcessoModalOpen(true);
                                  }}
                                  className={`p-1.5 rounded-lg transition-all ${
                                    state.processos?.some((p: any) => p.numero.replace(/\D/g, '') === rawProcessoStr)
                                      ? 'bg-green-500/10 text-green-500 cursor-not-allowed border border-green-500/20'
                                      : 'bg-emerald-600/10 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-600/20'
                                  }`}
                                  title={state.processos?.some((p: any) => p.numero.replace(/\D/g, '') === rawProcessoStr) ? "Processo Cadastrado" : "Importar como Processo"}
                                >
                                  <FolderPlus size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLeadForResumo(lead);
                                    setResumoText(lead.resumo || '');
                                    setIsEditingResumo(!lead.resumo);
                                    setIsResumoModalOpen(true);
                                  }}
                                  className="p-1.5 border border-app-border bg-app-bg hover:bg-app-border text-app-text-muted hover:text-app-text rounded-lg transition-all shadow-sm"
                                  title={lead.resumo ? 'Ver Observações' : 'Adicionar Observações'}
                                >
                                  <FileText size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingLeadId(lead.id);
                                    setManualLeadForm({
                                      numero: lead.numero,
                                      classe: lead.classe || '',
                                      tribunal: lead.tribunal,
                                      orgao: lead.orgao || '',
                                      partes: lead.partes || '',
                                      advogados: lead.advogados || '',
                                      disponibilizacao: lead.disponibilizacao || '',
                                      publicacao: lead.publicacao || '',
                                      status: lead.status,
                                      prioridade: lead.prioridade || 'Média',
                                      resumo: lead.resumo || '',
                                    });
                                    setIsManualLeadModalOpen(true);
                                  }}
                                  className="p-1.5 border border-app-border hover:bg-app-secondary text-app-text rounded-lg transition-all"
                                  title="Editar Lead"
                                >
                                  <Edit2 size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm('Tem certeza de que deseja excluir este Lead?')) {
                                      deleteLead(lead.id);
                                    }
                                  }}
                                  className="p-1.5 border border-red-200 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                  title="Excluir Lead"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-app-surface border border-dashed border-app-border rounded-2xl p-20 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-app-bg rounded-full flex items-center justify-center mb-6">
                  <Scale size={32} className="text-app-text-muted" />
                </div>
                <h3 className="text-xl font-bold text-app-text">Nenhum Lead Encontrado</h3>
                <p className="text-app-text-muted max-w-sm mx-auto mt-2 text-sm leading-relaxed">
                  Não há registros correspondentes aos filtros de busca e status.
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="status-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-app-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-app-text flex items-center gap-2">
                    <Settings size={20} className="text-primary" />
                    Gerenciamento de Status (`leads_status`)
                  </h2>
                  <p className="text-xs text-app-text-muted mt-1">
                    Cadastre, edite e personalize as opções de status dos leads salvas na tabela <code className="bg-app-bg px-1.5 py-0.5 rounded font-mono text-primary">leads_status</code> do Google Sheets.
                  </p>
                </div>
              </div>

              {/* Form de Criação/Edição de Status */}
              <form onSubmit={handleSaveStatus} className="bg-app-bg border border-app-border rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-app-text uppercase tracking-tight">
                    {editingStatus ? 'Editar Status' : 'Novo Status'}
                  </h3>
                  {editingStatus && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStatus(null);
                        setStatusForm({ nome: '', cor: '#3B82F6', escritorioId: escritorioAtivoId || 'x' });
                      }}
                      className="text-xs font-bold text-app-text-muted hover:text-app-text underline cursor-pointer"
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Nome do Status <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Em Qualificação"
                      className="w-full px-3.5 py-2.5 bg-app-surface border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
                      value={statusForm.nome}
                      onChange={e => setStatusForm({ ...statusForm, nome: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Cor do Badge</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent p-0 shrink-0"
                        value={statusForm.cor}
                        onChange={e => setStatusForm({ ...statusForm, cor: e.target.value })}
                      />
                      <input
                        type="text"
                        className="w-full px-3.5 py-2.5 bg-app-surface border border-app-border rounded-xl text-sm font-mono text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
                        value={statusForm.cor}
                        onChange={e => setStatusForm({ ...statusForm, cor: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Escritório Vinculado</label>
                    <select
                      className="w-full px-3.5 py-2.5 bg-app-surface border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
                      value={statusForm.escritorioId}
                      onChange={e => setStatusForm({ ...statusForm, escritorioId: e.target.value })}
                    >
                      <option value="x">Global (Todos os Escritórios)</option>
                      {(state.escritorios || []).map(esc => (
                        <option key={esc.id} value={esc.id}>{esc.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-opacity-90 transition-all cursor-pointer shadow-sm flex items-center gap-2"
                  >
                    <Save size={14} />
                    {editingStatus ? 'Atualizar Status' : 'Adicionar Novo Status'}
                  </button>
                </div>
              </form>

              {/* Tabela de Status */}
              <div className="border border-app-border rounded-xl overflow-hidden bg-app-surface shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-app-bg text-app-text-muted uppercase border-b border-app-border font-bold">
                    <tr>
                      <th className="p-4">ID</th>
                      <th className="p-4">Nome</th>
                      <th className="p-4">Badge Preview</th>
                      <th className="p-4">Cor Hex</th>
                      <th className="p-4">Escritório</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border text-app-text">
                    {availableStatuses.map(st => (
                      <tr key={st.id || st.nome} className="hover:bg-app-bg/50 transition-colors">
                        <td className="p-4 font-mono text-app-text-muted">{st.id}</td>
                        <td className="p-4 font-bold text-sm">{st.nome}</td>
                        <td className="p-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border"
                            style={{
                              backgroundColor: `${st.cor || '#3B82F6'}18`,
                              borderColor: st.cor || '#3B82F6',
                              color: st.cor || '#3B82F6'
                            }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.cor || '#3B82F6' }} />
                            {st.nome}
                          </span>
                        </td>
                        <td className="p-4 font-mono">{st.cor || '#3B82F6'}</td>
                        <td className="p-4 text-app-text-muted">
                          {st.escritorioId === 'x' || !st.escritorioId ? 'Global' : (state.escritorios.find(e => e.id === st.escritorioId)?.nome || st.escritorioId)}
                        </td>
                        <td className="p-4 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStatus(st);
                              setStatusForm({
                                nome: st.nome,
                                cor: st.cor || '#3B82F6',
                                escritorioId: st.escritorioId || st.idEscritorio || 'x'
                              });
                            }}
                            className="p-2 hover:bg-app-secondary rounded-lg text-primary cursor-pointer transition-colors"
                            title="Editar Status"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Deseja excluir o status "${st.nome}"?`)) {
                                deleteLeadStatus(st.id);
                              }
                            }}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 cursor-pointer transition-colors"
                            title="Excluir Status"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Query Response JSON Section */}
      {results && (
        <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between border-b border-app-border pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <h3 className="text-sm font-bold text-app-text uppercase tracking-tight animate-in fade-in">
                Resposta da Consulta API (JSON)
              </h3>
            </div>
            <button
              onClick={() => {
                try {
                  navigator.clipboard.writeText(JSON.stringify(results, null, 2));
                  setCopiedJson(true);
                  setTimeout(() => setCopiedJson(false), 2000);
                } catch (err) {
                  console.error('Failed to copy text: ', err);
                }
              }}
              className="px-3 py-1.5 bg-app-bg border border-app-border rounded-xl text-xs font-bold text-app-text-muted hover:text-primary hover:border-primary/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              type="button"
            >
              {copiedJson ? (
                <>
                  <CheckCircle size={13} className="text-emerald-500 animate-in zoom-in-50" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copiar JSON</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-app-text-muted leading-relaxed">
            Abaixo estão os dados brutos recebidos em tempo real da API pública do Conselho Nacional de Justiça (Comunica PJe) relacionados à sua busca.
          </p>
          <div className="bg-app-bg rounded-xl border border-app-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-app-secondary border-b border-app-border text-[11px] font-semibold text-app-text-muted font-mono">
              <span className="text-emerald-600 dark:text-emerald-400">STATUS: 200 API OK</span>
              <span>TAMANHO: {Math.round(JSON.stringify(results).length / 1024 * 10) / 10} KB</span>
            </div>
            <pre className="p-4 text-xs font-mono text-app-text-muted overflow-x-auto max-h-96 leading-relaxed select-text scrollbar-thin scrollbar-thumb-app-border">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        </div>
      )}

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

      <Modal
        isOpen={isManualLeadModalOpen}
        onClose={() => {
          setIsManualLeadModalOpen(false);
          setEditingLeadId(null);
          setManualLeadForm({
            numero: '',
            classe: '',
            tribunal: 'TJAM',
            orgao: '',
            partes: '',
            advogados: '',
            disponibilizacao: '',
            publicacao: '',
            status: 'Novo',
            prioridade: 'Média',
            resumo: '',
          });
        }}
        title={editingLeadId ? "Editar Lead" : "Adicionar Lead Manualmente"}
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleSaveManualLead} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Campos de formulário no lado esquerdo */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                    Número do Processo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 0643798-50.2023.8.04.0001"
                    className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder-app-text-muted"
                    value={manualLeadForm.numero}
                    onChange={(e) => setManualLeadForm(prev => ({ ...prev, numero: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                    Tribunal <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    value={manualLeadForm.tribunal}
                    onChange={(e) => setManualLeadForm(prev => ({ ...prev, tribunal: e.target.value }))}
                  >
                    {tribunals.map(t => (
                      <option key={t.id || t.sigla} value={t.sigla || t.id}>
                        {t.nome || t.sigla}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                    Classe Processual
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Procedimento Comum Cível"
                    className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder-app-text-muted"
                    value={manualLeadForm.classe}
                    onChange={(e) => setManualLeadForm(prev => ({ ...prev, classe: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                    Órgão Julgador / Vara
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 2ª Vara Cível de Manaus"
                    className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder-app-text-muted"
                    value={manualLeadForm.orgao}
                    onChange={(e) => setManualLeadForm(prev => ({ ...prev, orgao: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                    Partes (Autores / Réus)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: A: João da Silva | P: Banco do Brasil"
                    className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder-app-text-muted"
                    value={manualLeadForm.partes}
                    onChange={(e) => setManualLeadForm(prev => ({ ...prev, partes: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                    Advogados
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Dr. Pedro OAB/AM 12345"
                    className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder-app-text-muted"
                    value={manualLeadForm.advogados}
                    onChange={(e) => setManualLeadForm(prev => ({ ...prev, advogados: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                    Data de Disponibilização
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    value={manualLeadForm.disponibilizacao}
                    onChange={(e) => setManualLeadForm(prev => ({ ...prev, disponibilizacao: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                    Data de Publicação
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    value={manualLeadForm.publicacao}
                    onChange={(e) => setManualLeadForm(prev => ({ ...prev, publicacao: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                    Status Inicial <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    value={manualLeadForm.status}
                    onChange={(e) => setManualLeadForm(prev => ({ ...prev, status: e.target.value }))}
                  >
                    {availableStatuses.map(st => (
                      <option key={st.id || st.nome} value={st.nome}>
                        {st.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                    Prioridade <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    value={manualLeadForm.prioridade}
                    onChange={(e) => setManualLeadForm(prev => ({ ...prev, prioridade: e.target.value as any }))}
                  >
                    <option value="Baixa">🟢 Baixa</option>
                    <option value="Média">🔵 Média</option>
                    <option value="Alta">🟡 Alta</option>
                    <option value="Urgente">🔴 Urgente</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Observações e Resumos no lado direito */}
            <div className="lg:col-span-5 flex flex-col">
              <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                Observações / Resumo
              </label>
              <textarea
                placeholder="Digite aqui anotações ou observações iniciais para o lead..."
                className="w-full flex-grow min-h-[350px] lg:min-h-[440px] px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder-app-text-muted leading-relaxed"
                value={manualLeadForm.resumo}
                onChange={(e) => setManualLeadForm(prev => ({ ...prev, resumo: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-app-border">
            <button
              type="button"
              onClick={() => {
                setIsManualLeadModalOpen(false);
                setEditingLeadId(null);
                setManualLeadForm({
                  numero: '',
                  classe: '',
                  tribunal: 'TJAM',
                  orgao: '',
                  partes: '',
                  advogados: '',
                  disponibilizacao: '',
                  publicacao: '',
                  status: 'Novo',
                  prioridade: 'Média',
                  resumo: '',
                });
              }}
              className="px-4 py-2 bg-app-bg border border-app-border rounded-xl text-sm font-semibold text-app-text-muted hover:text-app-text transition-colors hover:bg-app-secondary cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Save size={16} />
              {editingLeadId ? "Salvar Alterações" : "Salvar Lead"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isResumoModalOpen}
        onClose={() => {
          setIsResumoModalOpen(false);
          setSelectedLeadForResumo(null);
          setResumoText('');
        }}
        title={isEditingResumo ? (selectedLeadForResumo?.resumo ? "Editar Observações" : "Adicionar Observações") : "Observações do Lead"}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
              Número do Processo
            </label>
            <p className="text-sm font-bold font-mono text-app-text bg-app-bg px-3 py-2 rounded-xl border border-app-border">
              {selectedLeadForResumo?.numero}
            </p>
          </div>

          {isEditingResumo ? (
            <div>
              <label htmlFor="lead-resumo-textarea" className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2 font-sans">
                Observações
              </label>
              <textarea
                id="lead-resumo-textarea"
                rows={14}
                value={resumoText}
                onChange={(e) => setResumoText(e.target.value)}
                placeholder="Digite aqui as observações e andamento deste lead..."
                className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder-app-text-muted leading-relaxed"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2 font-sans">
                Observações
              </label>
              <div className="w-full px-4 py-3 bg-app-bg border border-app-border rounded-xl text-app-text text-sm font-medium min-h-[300px] whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[450px]">
                {selectedLeadForResumo?.resumo ? (
                  selectedLeadForResumo.resumo
                ) : (
                  <span className="text-app-text-muted italic">Nenhuma observação registrada para este lead.</span>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {isEditingResumo ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedLeadForResumo?.resumo) {
                      setResumoText(selectedLeadForResumo.resumo);
                      setIsEditingResumo(false);
                    } else {
                      setIsResumoModalOpen(false);
                      setSelectedLeadForResumo(null);
                      setResumoText('');
                    }
                  }}
                  className="px-4 py-2 bg-app-bg border border-app-border rounded-xl text-sm font-semibold text-app-text-muted hover:text-app-text transition-colors hover:bg-app-secondary cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedLeadForResumo) return;
                    const updatedLead = {
                      ...selectedLeadForResumo,
                      resumo: resumoText.trim()
                    };
                    updateLead(updatedLead);
                    setSelectedLeadForResumo(updatedLead);
                    setIsEditingResumo(false);
                  }}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={16} />
                  Salvar Observações
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsResumoModalOpen(false);
                    setSelectedLeadForResumo(null);
                    setResumoText('');
                  }}
                  className="px-4 py-2 bg-app-bg border border-app-border rounded-xl text-sm font-semibold text-app-text-muted hover:text-app-text transition-colors hover:bg-app-secondary cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingResumo(true);
                  }}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Edit2 size={16} />
                  Editar
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Visualizar Detalhes do Contato */}
      <Modal 
        isOpen={isViewContatoModalOpen} 
        onClose={() => {
          setIsViewContatoModalOpen(false);
          setSelectedSavedContato(null);
          setIsEditingContato(false);
          setEditContatoData(null);
        }} 
        title={isEditingContato ? "Editar Detalhes do Contato" : "Detalhes do Contato"}
        maxWidth="max-w-lg"
      >
        {selectedSavedContato && (
          <div className="space-y-6">
            {isEditingContato && editContatoData ? (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!editContatoData.nome) return;
                  updateContato(editContatoData);
                  setSelectedSavedContato(editContatoData);
                  setIsEditingContato(false);
                }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                  {/* Nome */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Nome *</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                      value={editContatoData.nome}
                      onChange={e => setEditContatoData({...editContatoData, nome: e.target.value})}
                    />
                  </div>

                  {/* Apelido */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Apelido</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                      value={editContatoData.apelido || ''}
                      onChange={e => setEditContatoData({...editContatoData, apelido: e.target.value})}
                    />
                  </div>

                  {/* Tipo */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Tipo *</label>
                    <select 
                      required
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold"
                      value={editContatoData.tipo}
                      onChange={e => setEditContatoData({...editContatoData, tipo: e.target.value as any})}
                    >
                      <option value="Cliente">Cliente</option>
                      <option value="Contato">Contato</option>
                      <option value="Lead">Lead</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Status *</label>
                    <select 
                      required
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold"
                      value={editContatoData.status || 'Ativo'}
                      onChange={e => setEditContatoData({...editContatoData, status: e.target.value})}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Email</label>
                    <input 
                      type="email" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                      value={editContatoData.email || ''}
                      onChange={e => setEditContatoData({...editContatoData, email: e.target.value})}
                    />
                  </div>

                  {/* Telefone */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Telefone</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                      value={editContatoData.telefone || ''}
                      onChange={e => setEditContatoData({...editContatoData, telefone: e.target.value})}
                    />
                  </div>

                  {/* CPF/CNPJ */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">CPF/CNPJ</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                      value={editContatoData.cpfCnpj || ''}
                      onChange={e => setEditContatoData({...editContatoData, cpfCnpj: e.target.value})}
                    />
                  </div>

                  {/* RG */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">RG</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                      value={editContatoData.rg || ''}
                      onChange={e => setEditContatoData({...editContatoData, rg: e.target.value})}
                    />
                  </div>

                  {/* Estado Civil */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Estado Civil</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                      value={editContatoData.statusCivil || ''}
                      onChange={e => setEditContatoData({...editContatoData, statusCivil: e.target.value})}
                    />
                  </div>

                  {/* Profissão */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Profissão</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                      value={editContatoData.profissao || ''}
                      onChange={e => setEditContatoData({...editContatoData, profissao: e.target.value})}
                    />
                  </div>

                  {/* Endereço */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Endereço</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                      value={editContatoData.endereco || ''}
                      onChange={e => setEditContatoData({...editContatoData, endereco: e.target.value})}
                    />
                  </div>

                  {/* CEP */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">CEP</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                      value={editContatoData.cep || ''}
                      onChange={e => setEditContatoData({...editContatoData, cep: e.target.value})}
                    />
                  </div>

                  {/* Dados de Pagamento */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Dados de Pagamento (Pix, Conta Bancária, etc.)</label>
                    <textarea 
                      rows={2}
                      className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                      value={editContatoData.dadosPagamento || ''}
                      onChange={e => setEditContatoData({...editContatoData, dadosPagamento: e.target.value})}
                      placeholder="Ex: Chave PIX: pix@email.com, Banco: Nubank, Conta: ..."
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-app-border">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingContato(false);
                      setEditContatoData(null);
                    }}
                    className="px-4 py-2 bg-app-bg border border-app-border rounded-xl text-sm font-semibold text-app-text hover:bg-app-secondary transition-colors cursor-pointer text-app-text-muted"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Save size={16} />
                    Salvar Alterações
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl">
                    {selectedSavedContato.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-app-text leading-tight">{selectedSavedContato.nome}</h2>
                    <div className="flex gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        selectedSavedContato.tipo === 'Cliente' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        selectedSavedContato.tipo === 'Contato' ? 'bg-primary/10 text-primary' :
                        selectedSavedContato.tipo === 'Lead' ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400' :
                        'bg-app-bg text-app-text-muted border border-app-border'
                      }`}>
                        {selectedSavedContato.tipo}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        selectedSavedContato.status === 'Inativo' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {selectedSavedContato.status || 'Ativo'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-app-border">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Mail className="text-app-text-muted mt-1 flex-shrink-0" size={18} />
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Email</p>
                        <p className="text-app-text text-sm font-medium">{selectedSavedContato.email || 'Não informado'}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Phone className="text-app-text-muted mt-1 flex-shrink-0" size={18} />
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Telefone</p>
                        <p className="text-app-text text-sm font-medium">{selectedSavedContato.telefone || 'Não informado'}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Building2 className="text-app-text-muted mt-1 flex-shrink-0" size={18} />
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">CPF/CNPJ</p>
                        <p className="text-app-text text-sm font-medium">{selectedSavedContato.cpfCnpj || 'Não informado'}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <User className="text-app-text-muted mt-1 flex-shrink-0" size={18} />
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">RG</p>
                        <p className="text-app-text text-sm font-medium">{selectedSavedContato.rg || 'Não informado'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <User className="text-app-text-muted mt-1 flex-shrink-0" size={18} />
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Apelido</p>
                        <p className="text-app-text text-sm font-medium">{selectedSavedContato.apelido || 'Não informado'}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Activity className="text-app-text-muted mt-1 flex-shrink-0" size={18} />
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Estado Civil</p>
                        <p className="text-app-text text-sm font-medium">{selectedSavedContato.statusCivil || 'Não informado'}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Briefcase className="text-app-text-muted mt-1 flex-shrink-0" size={18} />
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Profissão</p>
                        <p className="text-app-text text-sm font-medium">{selectedSavedContato.profissao || 'Não informado'}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Calendar className="text-app-text-muted mt-1 flex-shrink-0" size={18} />
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Data Cadastro</p>
                        <p className="text-app-text text-sm font-medium">{selectedSavedContato.dataCadastro || 'Não informado'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-app-border">
                  <div className="flex items-start space-x-3">
                    <MapPin className="text-app-text-muted mt-1 flex-shrink-0" size={18} />
                    <div className="flex-1">
                      <p className="text-xs text-app-text-muted uppercase font-semibold">Endereço</p>
                      <p className="text-app-text text-sm font-medium">{selectedSavedContato.endereco || 'Não informado'}</p>
                      {selectedSavedContato.cep && (
                        <p className="text-xs text-app-text-muted mt-0.5">CEP: {selectedSavedContato.cep}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-app-border">
                  <div className="flex items-start space-x-3">
                    <DollarSign className="text-app-text-muted mt-1 flex-shrink-0" size={18} />
                    <div className="flex-1">
                      <p className="text-xs text-app-text-muted uppercase font-semibold">Dados de Pagamento</p>
                      <p className="text-app-text text-sm font-medium whitespace-pre-wrap">{selectedSavedContato.dadosPagamento || 'Não informado'}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-app-border">
                  <button 
                    onClick={() => {
                      setEditContatoData({...selectedSavedContato});
                      setIsEditingContato(true);
                    }}
                    className="px-4 py-2 bg-app-bg border border-app-border rounded-xl text-sm font-semibold text-primary hover:bg-primary/5 hover:border-primary/40 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit2 size={15} />
                    Editar Contato
                  </button>
                  <button 
                    onClick={() => {
                      setIsViewContatoModalOpen(false);
                      setSelectedSavedContato(null);
                    }}
                    className="px-5 py-2 bg-app-bg border border-app-border rounded-xl text-sm font-semibold text-app-text hover:bg-app-secondary transition-colors cursor-pointer text-app-text-muted"
                  >
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Gerenciar Status dos Leads */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setEditingStatus(null);
          setStatusForm({ nome: '', cor: '#3B82F6', escritorioId: escritorioAtivoId || 'x' });
        }}
        title="Gerenciar Tabela leads_status"
      >
        <div className="space-y-6">
          <p className="text-xs text-app-text-muted">
            Cadastre e edite os status da tabela <code className="bg-app-bg px-1.5 py-0.5 rounded font-mono text-primary">leads_status</code>. Os status configurados serão lidos e salvos na planilha do Google Sheets.
          </p>

          <form onSubmit={handleSaveStatus} className="bg-app-bg border border-app-border rounded-xl p-4 space-y-4">
            <h4 className="text-sm font-bold text-app-text flex items-center gap-2">
              {editingStatus ? 'Editar Status' : 'Novo Status'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Nome do Status <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Em Qualificação"
                  className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
                  value={statusForm.nome}
                  onChange={e => setStatusForm({ ...statusForm, nome: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Cor da Badge</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-9 h-9 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                    value={statusForm.cor}
                    onChange={e => setStatusForm({ ...statusForm, cor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-sm text-app-text font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    value={statusForm.cor}
                    onChange={e => setStatusForm({ ...statusForm, cor: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Escritório</label>
                <select
                  className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary"
                  value={statusForm.escritorioId}
                  onChange={e => setStatusForm({ ...statusForm, escritorioId: e.target.value })}
                >
                  <option value="x">Global (Todos)</option>
                  {(state.escritorios || []).map(esc => (
                    <option key={esc.id} value={esc.id}>{esc.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-app-border">
              {editingStatus && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingStatus(null);
                    setStatusForm({ nome: '', cor: '#3B82F6', escritorioId: escritorioAtivoId || 'x' });
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-app-text-muted hover:text-app-text cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-opacity-90 transition-all cursor-pointer"
              >
                {editingStatus ? 'Atualizar Status' : 'Adicionar Status'}
              </button>
            </div>
          </form>

          <div className="border border-app-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-app-bg text-app-text-muted uppercase border-b border-app-border">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Cor</th>
                  <th className="p-3">Escritório</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border text-app-text">
                {availableStatuses.map(st => (
                  <tr key={st.id || st.nome} className="hover:bg-app-bg/50 transition-colors">
                    <td className="p-3 font-mono text-app-text-muted">{st.id}</td>
                    <td className="p-3 font-bold">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: st.cor || '#3B82F6' }} />
                        <span>{st.nome}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono">{st.cor}</td>
                    <td className="p-3 text-app-text-muted">
                      {st.escritorioId === 'x' || !st.escritorioId ? 'Global' : (state.escritorios.find(e => e.id === st.escritorioId)?.nome || st.escritorioId)}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStatus(st);
                          setStatusForm({
                            nome: st.nome,
                            cor: st.cor || '#3B82F6',
                            escritorioId: st.escritorioId || st.idEscritorio || 'x'
                          });
                        }}
                        className="p-1.5 hover:bg-app-secondary rounded text-primary cursor-pointer transition-colors"
                        title="Editar Status"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Deseja excluir o status "${st.nome}"?`)) {
                            deleteLeadStatus(st.id);
                          }
                        }}
                        className="p-1.5 hover:bg-red-500/10 rounded text-red-500 cursor-pointer transition-colors"
                        title="Excluir Status"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
