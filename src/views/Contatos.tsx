import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context';
import { Users, Plus, Search, Mail, Phone, Building2, ChevronRight, Edit2, Trash2, Eye, MapPin, Briefcase, User, Activity, ChevronLeft, ArrowUp, ArrowDown, Calendar, ArrowDownToLine, Loader2, DollarSign, FileText, SlidersHorizontal, RotateCcw, CheckSquare, Settings2, Scale } from 'lucide-react';
import Modal from '../components/Modal';
import { Contato } from '../types';
import Pagination from '../components/Pagination';
import { importFromGoogleForms } from '../services/googleSheets';

const defaultVisibleFields: Record<string, boolean> = {
  email: true,
  telefone: true,
  cpfCnpj: true,
  rg: true,
  apelido: true,
  statusCivil: true,
  profissao: true,
  cep: true,
  endereco: true,
  municipio: true,
  dadosPagamento: true,
  observacoes: true
};

export default function Contatos() {
  const { state, addContato, addContatos, updateContato, deleteContato, hasPermission, escritorioAtivoId, isAdmin, currentUser } = useAppContext();
  const isGlobalAdmin = isAdmin() && (escritorioAtivoId === "" || !escritorioAtivoId);

  const userOfficeIds = (currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase());
  const availableOffices = state.escritorios.filter(esc => 
    isAdmin() || userOfficeIds.includes(esc.id.toString().trim().toUpperCase())
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedContato, setSelectedContato] = useState<Contato | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'geral' | 'processos'>('geral');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = state.settings.itemsPerPage;

  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('contatos_visible_fields');
      if (saved) return { ...defaultVisibleFields, ...JSON.parse(saved) };
    } catch (e) {
      console.error(e);
    }
    return defaultVisibleFields;
  });

  const toggleFieldVisibility = (key: string) => {
    setVisibleFields(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('contatos_visible_fields', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const selectAllFields = () => {
    const allTrue = Object.keys(defaultVisibleFields).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setVisibleFields(allTrue);
    localStorage.setItem('contatos_visible_fields', JSON.stringify(allTrue));
  };

  const resetFieldsDefault = () => {
    setVisibleFields(defaultVisibleFields);
    localStorage.setItem('contatos_visible_fields', JSON.stringify(defaultVisibleFields));
  };

  const [novoContato, setNovoContato] = useState<Partial<Contato>>({
    nome: '',
    tipo: 'Cliente',
    email: '',
    telefone: '',
    cpfCnpj: '',
    statusCivil: '',
    status: 'Ativo',
    apelido: '',
    profissao: '',
    rg: '',
    endereco: '',
    cep: '',
    municipio: '',
    estado: '',
    dadosPagamento: '',
    observacoes: '',
    escritorioId: escritorioAtivoId || ''
  });

  const [isImportingFromForms, setIsImportingFromForms] = useState(false);

  const handleImportFromGoogleForms = async () => {
    if (!escritorioAtivoId) {
      alert("Por favor, selecione um escritório ativo na barra superior antes de importar.");
      return;
    }

    const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
    if (!activeOffice) {
      alert("Escritório ativo não encontrado.");
      return;
    }

    const sheetId = activeOffice.googleFormsSpreadsheetId?.trim();
    if (!sheetId) {
      alert(`O escritório "${activeOffice.nome}" não possui uma planilha do Google Forms configurada.\n\nPor favor, vá no menu "Escritórios", edite este escritório e configure o "ID da Planilha do Google Forms".`);
      return;
    }

    const sheetName = activeOffice.googleFormsSheetName?.trim() || 'Respostas ao formulário 1';

    try {
      setIsImportingFromForms(true);
      const imported = await importFromGoogleForms(sheetId, sheetName);
      
      if (imported.length === 0) {
        alert("Nenhum registro encontrado na planilha do Google Forms.");
        setIsImportingFromForms(false);
        return;
      }

      // Filtrar duplicados
      const existingInOffice = state.contatos.filter(c => {
        const contactOfficeId = (c.escritorioId || '').toString().trim();
        const activeOfficeId = (escritorioAtivoId || '').toString().trim();
        return contactOfficeId === activeOfficeId || contactOfficeId.toLowerCase() === 'x';
      });
      
      const newContactsToAdd: Contato[] = [];
      let duplicatesCount = 0;

      imported.forEach(item => {
        // Verifica duplicidade por nome, email, telefone ou CPF/CNPJ
        const isDuplicate = existingInOffice.some(existing => {
          const nameMatch = existing.nome.toLowerCase().trim() === item.nome?.toLowerCase().trim();
          const emailMatch = item.email && existing.email?.toLowerCase().trim() === item.email.toLowerCase().trim();
          
          const cleanExistingPhone = existing.telefone?.replace(/\D/g, '') || '';
          const cleanItemPhone = item.telefone?.replace(/\D/g, '') || '';
          const phoneMatch = cleanItemPhone && cleanExistingPhone === cleanItemPhone;
          
          const cleanExistingCpf = existing.cpfCnpj?.replace(/\D/g, '') || '';
          const cleanItemCpf = item.cpfCnpj?.replace(/\D/g, '') || '';
          const cpfMatch = cleanItemCpf && cleanExistingCpf === cleanItemCpf;
          
          return nameMatch || emailMatch || phoneMatch || cpfMatch;
        });

        if (isDuplicate) {
          duplicatesCount++;
        } else {
          newContactsToAdd.push({
            id: 'CONT_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            nome: item.nome || 'Contato sem Nome',
            tipo: 'Cliente',
            email: item.email || '',
            telefone: item.telefone || '',
            cpfCnpj: item.cpfCnpj || '',
            rg: item.rg || '',
            endereco: item.endereco || '',
            cep: item.cep || '',
            municipio: item.municipio || '',
            estado: item.estado || '',
            statusCivil: item.statusCivil || '',
            profissao: item.profissao || '',
            dadosPagamento: item.dadosPagamento || '',
            status: 'Ativo',
            observacoes: item.observacoes || '',
            escritorioId: escritorioAtivoId,
            dataCadastro: item.dataCadastro || new Date().toLocaleString('pt-BR')
          });
        }
      });

      if (newContactsToAdd.length === 0) {
        alert(`Sincronização concluída!\n\nTodos os ${imported.length} registros encontrados no formulário já existem no sistema.`);
      } else {
        addContatos(newContactsToAdd);
        alert(`Sincronização concluída com sucesso!\n\n- ${newContactsToAdd.length} novos contatos importados.\n- ${duplicatesCount} duplicados ignorados.`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao importar do Google Forms: ${err.message || err.toString()}\n\nCertifique-se de que:\n1. O ID da planilha está correto.\n2. O nome da aba está correto.\n3. A planilha de respostas está compartilhada como "Qualquer pessoa com o link pode ler".`);
    } finally {
      setIsImportingFromForms(false);
    }
  };

  const filteredContatos = state.contatos.filter(c => {
    const contactOfficeId = (c.escritorioId || '').toString().trim();
    const activeOfficeId = (escritorioAtivoId || '').toString().trim();

    // Regra: se id_escritorio = x, exibe em todos os escritórios
    const isGlobal = contactOfficeId.toLowerCase() === 'x';
    const isFromActiveOffice = contactOfficeId === activeOfficeId;

    // Se estamos em modo "Todos os Escritórios" (activeOfficeId vazio)
    // E o usuário é Admin, mostra tudo.
    if (!activeOfficeId && isAdmin()) return true;

    // Se estamos em um escritório específico, mostra os dele + os globais
    if (activeOfficeId) {
      if (isGlobal || isFromActiveOffice) return true;
      return false;
    }

    // Se não há escritório ativo selecionado (pode acontecer no início)
    // Admins veem tudo, outros veem apenas o que for global ou sem escritório (se permitido)
    if (isAdmin()) return true;
    if (isGlobal || !contactOfficeId) return true;

    return false;
  }).filter(c => {
    if (typeFilter !== 'Todos') {
      return c.tipo === typeFilter;
    }
    return true;
  }).filter(c => {
    const normName = (c.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normEmail = (c.email || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normApelido = (c.apelido || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normPhone = (c.telefone || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanPhone = (c.telefone || '').replace(/\D/g, '');
    const cleanSearch = (searchTerm || '').replace(/\D/g, '');
    const normSearch = (searchTerm || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const phoneMatch = normPhone.includes(normSearch) || (cleanSearch.length > 0 && cleanPhone.includes(cleanSearch));

    return normName.includes(normSearch) || 
           normEmail.includes(normSearch) ||
           phoneMatch ||
           (c.cpfCnpj || '').includes(searchTerm) ||
           normApelido.includes(normSearch);
  });

  const sortedContatos = [...filteredContatos].sort((a, b) => {
    const nameA = (a.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const nameB = (b.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (sortOrder === 'asc') {
      return nameA.localeCompare(nameB);
    } else {
      return nameB.localeCompare(nameA);
    }
  });

  const totalPages = Math.ceil(sortedContatos.length / itemsPerPage);
  const paginatedContatos = sortedContatos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoContato.nome) return;
    
    // Obter data e hora local formatada em DD/MM/YYYY HH:mm:ss
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const hr = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    const formattedDateTime = `${d}/${m}/${y} ${hr}:${min}:${sec}`;

    addContato({
      id: Math.random().toString(36).substr(2, 9),
      nome: novoContato.nome || '',
      tipo: (novoContato.tipo as any) || 'Cliente',
      email: novoContato.email || '',
      telefone: novoContato.telefone || '',
      cpfCnpj: novoContato.cpfCnpj || '',
      statusCivil: novoContato.statusCivil || '',
      status: novoContato.status || 'Ativo',
      apelido: novoContato.apelido,
      profissao: novoContato.profissao,
      rg: novoContato.rg,
      endereco: novoContato.endereco,
      cep: novoContato.cep,
      municipio: novoContato.municipio || '',
      estado: novoContato.estado || '',
      dadosPagamento: novoContato.dadosPagamento || '',
      observacoes: novoContato.observacoes || '',
      escritorioId: novoContato.escritorioId || escritorioAtivoId || '',
      dataCadastro: formattedDateTime
    });
    setIsModalOpen(false);
    resetNovoContato();
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContato || !selectedContato.nome) return;
    
    updateContato(selectedContato);
    setIsEditModalOpen(false);
    setSelectedContato(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este contato?')) {
      deleteContato(id);
      setIsViewModalOpen(false);
      setSelectedContato(null);
    }
  };

  const resetNovoContato = () => {
    setNovoContato({
      nome: '',
      tipo: 'Cliente',
      email: '',
      telefone: '',
      cpfCnpj: '',
      statusCivil: '',
      status: 'Ativo',
      apelido: '',
      profissao: '',
      rg: '',
      endereco: '',
      cep: '',
      municipio: '',
      estado: '',
      dadosPagamento: '',
      observacoes: '',
      escritorioId: escritorioAtivoId || ''
    });
  };

  const contactProcesses = useMemo(() => {
    if (!selectedContato) return [];
    const cid = String(selectedContato.id).trim();

    return state.processos.filter(p => {
      // 1. Cliente principal
      if (String(p.clienteId || '').trim() === cid) return true;
      
      // 2. IDs no array envolvidosIds
      if (p.envolvidosIds && p.envolvidosIds.map(id => String(id).trim()).includes(cid)) return true;

      // 3. Tabela de envolvimentos (state.envolvidos)
      const isInEnvolvidos = state.envolvidos.some(e => 
        String(e.contatoId || '').trim() === cid && String(e.processoId || '').trim() === String(p.id).trim()
      );
      if (isInEnvolvidos) return true;

      return false;
    }).map(p => {
      const roles: string[] = [];
      const pid = String(p.id).trim();

      if (String(p.clienteId || '').trim() === cid) {
        roles.push('Cliente Principal');
      }

      const envs = state.envolvidos.filter(e => 
        String(e.contatoId || '').trim() === cid && String(e.processoId || '').trim() === pid
      );

      envs.forEach(e => {
        if (e.tipoEnvolvimento && !roles.includes(e.tipoEnvolvimento)) {
          roles.push(e.tipoEnvolvimento);
        }
      });

      if (roles.length === 0 && p.envolvidosIds?.map(id => String(id).trim()).includes(cid)) {
        roles.push('Parte Envolvida');
      }

      return {
        processo: p,
        roles: roles.length > 0 ? roles : ['Parte Envolvida']
      };
    });
  }, [selectedContato, state.processos, state.envolvidos]);

  const openViewModal = (contato: Contato) => {
    setSelectedContato(contato);
    setActiveDetailTab('geral');
    setIsViewModalOpen(true);
  };

  const openEditModal = (contato: Contato) => {
    setSelectedContato({ ...contato });
    setIsEditModalOpen(true);
  };

  return (
    <div className="p-6 w-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <Users className="mr-3 text-primary" />
          Contatos
        </h1>
        {hasPermission('contatos', 'write') && (
          <div className="flex items-center gap-2">
            <button 
              onClick={handleImportFromGoogleForms}
              disabled={isImportingFromForms}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm text-sm font-medium h-[38px]"
              title="Importar contatos da planilha de respostas do Google Forms vinculada a este escritório"
            >
              {isImportingFromForms ? (
                <Loader2 size={18} className="mr-2 animate-spin" />
              ) : (
                <ArrowDownToLine size={18} className="mr-2" />
              )}
              {isImportingFromForms ? 'Importando...' : 'Google Forms'}
            </button>
            <button 
              onClick={() => {
                resetNovoContato();
                setIsModalOpen(true);
              }}
              className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm text-sm font-medium h-[38px]"
            >
              <Plus size={20} className="mr-2" />
              Novo Contato
            </button>
          </div>
        )}
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="p-4 border-b border-app-border flex flex-col md:flex-row items-stretch md:items-center gap-4 justify-between">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button 
              id="btn-column-config"
              onClick={() => setIsConfigModalOpen(true)}
              className="p-2 border border-app-border rounded-lg text-app-text-muted hover:text-primary hover:border-primary transition-all bg-app-secondary flex items-center justify-center shadow-sm shrink-0"
              title="Configurar Colunas e Campos"
            >
              <Settings2 size={20} />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
              <input 
                type="text" 
                placeholder="Buscar por nome, email, telefone ou CPF/CNPJ..." 
                className="w-full pl-10 pr-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-app-secondary text-app-text placeholder-app-text-muted"
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-sm font-medium text-app-text-muted whitespace-nowrap">Filtrar por Tipo:</span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-app-secondary border border-app-border rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all text-app-text cursor-pointer min-w-[120px]"
            >
              <option value="Todos">Todos</option>
              <option value="Cliente">Cliente</option>
              <option value="Contato">Contato</option>
              <option value="Lead">Lead</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-app-border rounded-xl">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-app-secondary text-app-text-muted text-sm uppercase tracking-wider">
                <th 
                  className="p-4 font-medium cursor-pointer hover:text-primary transition-colors select-none whitespace-nowrap"
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  <div className="flex items-center gap-1.5">
                    Nome / Tipo
                    {sortOrder === 'asc' ? (
                      <ArrowUp size={14} className="text-primary" />
                    ) : (
                      <ArrowDown size={14} className="text-primary" />
                    )}
                  </div>
                </th>
                {visibleFields.email && <th className="p-4 font-medium whitespace-nowrap">Email</th>}
                {visibleFields.telefone && <th className="p-4 font-medium whitespace-nowrap">Telefone</th>}
                {visibleFields.cpfCnpj && <th className="p-4 font-medium whitespace-nowrap">CPF/CNPJ</th>}
                {visibleFields.rg && <th className="p-4 font-medium whitespace-nowrap">RG</th>}
                {visibleFields.apelido && <th className="p-4 font-medium whitespace-nowrap">Apelido</th>}
                {visibleFields.statusCivil && <th className="p-4 font-medium whitespace-nowrap">Estado Civil</th>}
                {visibleFields.profissao && <th className="p-4 font-medium whitespace-nowrap">Profissão</th>}
                {visibleFields.endereco && <th className="p-4 font-medium whitespace-nowrap">Endereço</th>}
                {visibleFields.cep && <th className="p-4 font-medium whitespace-nowrap">CEP</th>}
                {visibleFields.municipio && <th className="p-4 font-medium whitespace-nowrap">Município / UF</th>}
                {visibleFields.dadosPagamento && <th className="p-4 font-medium whitespace-nowrap">Dados Pagamento</th>}
                {visibleFields.observacoes && <th className="p-4 font-medium whitespace-nowrap">Observações</th>}
                <th className="p-4 font-medium whitespace-nowrap">Status</th>
                <th className="p-4 font-medium text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {paginatedContatos.map((contato, index) => (
                <tr key={`${contato.id}-${index}`} className="hover:bg-app-secondary/50 transition-colors group cursor-pointer" onClick={() => openViewModal(contato)}>
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {contato.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-app-text flex items-center gap-2">
                          {contato.nome}
                          {contato.escritorioId?.toLowerCase() === 'x' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase">
                              Global
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          contato.tipo === 'Cliente' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          contato.tipo === 'Contato' ? 'bg-primary/10 text-primary' :
                          contato.tipo === 'Lead' ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400' :
                          'bg-app-bg text-app-text-muted border border-app-border'
                        }`}>
                          {contato.tipo}
                        </span>
                      </div>
                    </div>
                  </td>
                  {visibleFields.email && (
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-app-text">
                        <Mail size={14} className="mr-2 text-app-text-muted flex-shrink-0" />
                        <span className="truncate max-w-[200px]">{contato.email || '-'}</span>
                      </div>
                    </td>
                  )}
                  {visibleFields.telefone && (
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-app-text">
                        <Phone size={14} className="mr-2 text-app-text-muted flex-shrink-0" />
                        <span>{contato.telefone || '-'}</span>
                      </div>
                    </td>
                  )}
                  {visibleFields.cpfCnpj && (
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-app-text">
                        <Building2 size={14} className="mr-2 text-app-text-muted flex-shrink-0" />
                        <span>{contato.cpfCnpj || '-'}</span>
                      </div>
                    </td>
                  )}
                  {visibleFields.rg && (
                    <td className="p-4 whitespace-nowrap text-sm text-app-text">
                      {contato.rg || '-'}
                    </td>
                  )}
                  {visibleFields.apelido && (
                    <td className="p-4 whitespace-nowrap text-sm text-app-text">
                      {contato.apelido || '-'}
                    </td>
                  )}
                  {visibleFields.statusCivil && (
                    <td className="p-4 whitespace-nowrap text-sm text-app-text">
                      {contato.statusCivil || '-'}
                    </td>
                  )}
                  {visibleFields.profissao && (
                    <td className="p-4 whitespace-nowrap text-sm text-app-text">
                      {contato.profissao || '-'}
                    </td>
                  )}
                  {visibleFields.endereco && (
                    <td className="p-4 whitespace-nowrap text-sm text-app-text">
                      <span className="truncate max-w-[220px] block" title={contato.endereco || ''}>
                        {contato.endereco || '-'}
                      </span>
                    </td>
                  )}
                  {visibleFields.cep && (
                    <td className="p-4 whitespace-nowrap text-sm text-app-text">
                      {contato.cep || '-'}
                    </td>
                  )}
                  {visibleFields.municipio && (
                    <td className="p-4 whitespace-nowrap text-sm text-app-text">
                      {contato.municipio ? `${contato.municipio}${contato.estado ? ` - ${contato.estado}` : ''}` : '-'}
                    </td>
                  )}
                  {visibleFields.dadosPagamento && (
                    <td className="p-4 whitespace-nowrap text-sm text-app-text">
                      <span className="truncate max-w-[200px] block" title={contato.dadosPagamento || ''}>
                        {contato.dadosPagamento || '-'}
                      </span>
                    </td>
                  )}
                  {visibleFields.observacoes && (
                    <td className="p-4 whitespace-nowrap text-sm text-app-text">
                      <span className="truncate max-w-[220px] block" title={contato.observacoes || ''}>
                        {contato.observacoes || '-'}
                      </span>
                    </td>
                  )}
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center text-sm">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                        contato.status === 'Inativo' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {contato.status || 'Ativo'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => openViewModal(contato)}
                        className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                        title="Visualizar"
                      >
                        <Eye size={18} />
                      </button>
                      {hasPermission('contatos', 'write') && (
                        <button 
                          onClick={() => openEditModal(contato)}
                          className="text-app-text-muted hover:text-amber-500 transition-colors p-2 rounded-full hover:bg-amber-500/10"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                      {hasPermission('contatos', 'delete') && (
                        <button 
                          onClick={() => handleDelete(contato.id)}
                          className="text-app-text-muted hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-500/10"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedContatos.length === 0 && (
                <tr>
                  <td colSpan={3 + Object.values(visibleFields).filter(Boolean).length} className="p-8 text-center text-app-text-muted">
                    Nenhum contato encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredContatos.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          label="contatos"
        />
      </div>

      {/* Modal Novo Contato */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Contato">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Nome *</label>
              <input 
                type="text" 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.nome || ''}
                onChange={e => setNovoContato({...novoContato, nome: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Tipo *</label>
              <select 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.tipo || 'Cliente'}
                onChange={e => setNovoContato({...novoContato, tipo: e.target.value as any})}
              >
                <option value="Cliente">Cliente</option>
                <option value="Contato">Contato</option>
                <option value="Lead">Lead</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Status *</label>
              <select 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.status || 'Ativo'}
                onChange={e => setNovoContato({...novoContato, status: e.target.value})}
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Apelido</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.apelido || ''}
                onChange={e => setNovoContato({...novoContato, apelido: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Estado Civil</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.statusCivil || ''}
                onChange={e => setNovoContato({...novoContato, statusCivil: e.target.value})}
                placeholder="Ex: Solteiro, Casado..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Profissão</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.profissao || ''}
                onChange={e => setNovoContato({...novoContato, profissao: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">CPF/CNPJ</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.cpfCnpj || ''}
                onChange={e => setNovoContato({...novoContato, cpfCnpj: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">RG</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.rg || ''}
                onChange={e => setNovoContato({...novoContato, rg: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Email</label>
              <input 
                type="email" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.email || ''}
                onChange={e => setNovoContato({...novoContato, email: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Telefone</label>
              <input 
                type="tel" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.telefone || ''}
                onChange={e => setNovoContato({...novoContato, telefone: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">CEP</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.cep || ''}
                onChange={e => setNovoContato({...novoContato, cep: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Município</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.municipio || ''}
                onChange={e => setNovoContato({...novoContato, municipio: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Estado</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.estado || ''}
                onChange={e => setNovoContato({...novoContato, estado: e.target.value})}
                placeholder="Ex: AM, SP..."
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text">Endereço</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoContato.endereco || ''}
                onChange={e => setNovoContato({...novoContato, endereco: e.target.value})}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text">Dados de Pagamento (Pix, Conta Bancária, etc.)</label>
              <textarea 
                rows={2}
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text text-sm"
                value={novoContato.dadosPagamento || ''}
                onChange={e => setNovoContato({...novoContato, dadosPagamento: e.target.value})}
                placeholder="Ex: Chave PIX: pix@email.com, Banco: Nubank, Conta: ..."
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text">Observações</label>
              <textarea 
                rows={3}
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text text-sm"
                value={novoContato.observacoes || ''}
                onChange={e => setNovoContato({...novoContato, observacoes: e.target.value})}
                placeholder="Observações adicionais ou resumo dos fatos..."
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text flex items-center gap-1.5">
                <Building2 size={16} className="text-primary" />
                Escritório Responsável *
              </label>
              <select 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text text-sm font-medium"
                value={novoContato.escritorioId || ''}
                onChange={e => setNovoContato({...novoContato, escritorioId: e.target.value})}
              >
                <option value="">Selecione um escritório</option>
                {(isAdmin() || isGlobalAdmin) && (
                  <option value="x">GLOBAL (Todos os Escritórios)</option>
                )}
                {availableOffices.map(esc => (
                  <option key={esc.id} value={esc.id}>{esc.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm"
            >
              Salvar Contato
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Visualizar Contato */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Detalhes do Contato">
        {selectedContato && (
          <div className="space-y-6">
            <div className="flex items-center space-x-4 bg-app-secondary/50 p-4 rounded-xl border border-app-border">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl flex-shrink-0">
                {selectedContato.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-app-text truncate">{selectedContato.nome}</h2>
                <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    selectedContato.tipo === 'Cliente' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    selectedContato.tipo === 'Contato' ? 'bg-primary/10 text-primary' :
                    selectedContato.tipo === 'Lead' ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400' :
                    'bg-app-bg text-app-text-muted border border-app-border'
                  }`}>
                    {selectedContato.tipo}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    selectedContato.status === 'Inativo' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {selectedContato.status || 'Ativo'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                    <Building2 size={12} />
                    {selectedContato.escritorioId === 'x' 
                      ? 'GLOBAL (Todos os Escritórios)' 
                      : (state.escritorios.find(e => e.id === selectedContato.escritorioId)?.nome || 'Sem escritório')}
                  </span>
                </div>
              </div>
            </div>

            {/* Tab Header Navigation */}
            <div className="flex border-b border-app-border space-x-2">
              <button
                type="button"
                onClick={() => setActiveDetailTab('geral')}
                className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                  activeDetailTab === 'geral'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-app-text-muted hover:text-app-text'
                }`}
              >
                <User size={16} />
                Informações Gerais
              </button>

              <button
                type="button"
                onClick={() => setActiveDetailTab('processos')}
                className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                  activeDetailTab === 'processos'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-app-text-muted hover:text-app-text'
                }`}
              >
                <Scale size={16} />
                Processos
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeDetailTab === 'processos' ? 'bg-primary/20 text-primary' : 'bg-app-secondary text-app-text-muted'
                }`}>
                  {contactProcesses.length}
                </span>
              </button>
            </div>

            {activeDetailTab === 'geral' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Coluna 1: Dados Pessoais & Contato */}
                  <div className="space-y-4 bg-app-surface p-4 rounded-xl border border-app-border">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider pb-2 border-b border-app-border flex items-center gap-1.5">
                      <User size={15} />
                      Dados Pessoais e Contato
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Email</p>
                        <p className="text-sm font-medium text-app-text truncate">{selectedContato.email || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Telefone</p>
                        <p className="text-sm font-medium text-app-text">{selectedContato.telefone || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">CPF / CNPJ</p>
                        <p className="text-sm font-medium text-app-text">{selectedContato.cpfCnpj || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">RG</p>
                        <p className="text-sm font-medium text-app-text">{selectedContato.rg || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Apelido</p>
                        <p className="text-sm font-medium text-app-text">{selectedContato.apelido || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Estado Civil</p>
                        <p className="text-sm font-medium text-app-text">{selectedContato.statusCivil || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Profissão</p>
                        <p className="text-sm font-medium text-app-text">{selectedContato.profissao || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Data Cadastro</p>
                        <p className="text-sm font-medium text-app-text">{selectedContato.dataCadastro || 'Não informado'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Coluna 2: Endereço & Escritório */}
                  <div className="space-y-4 bg-app-surface p-4 rounded-xl border border-app-border">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider pb-2 border-b border-app-border flex items-center gap-1.5">
                      <MapPin size={15} />
                      Endereço & Escritório
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Endereço</p>
                        <p className="text-sm font-medium text-app-text">{selectedContato.endereco || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">CEP</p>
                        <p className="text-sm font-medium text-app-text">{selectedContato.cep || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Município / UF</p>
                        <p className="text-sm font-medium text-app-text">
                          {selectedContato.municipio ? `${selectedContato.municipio}${selectedContato.estado ? ` - ${selectedContato.estado}` : ''}` : 'Não informado'}
                        </p>
                      </div>
                      <div className="sm:col-span-2 pt-2 border-t border-app-border/50">
                        <p className="text-xs text-app-text-muted uppercase font-semibold">Escritório Responsável</p>
                        <p className="text-sm font-semibold text-app-text flex items-center gap-1.5 mt-0.5">
                          <Building2 size={16} className="text-primary" />
                          {selectedContato.escritorioId === 'x' 
                            ? 'GLOBAL (Todos os Escritórios)' 
                            : (state.escritorios.find(e => e.id === selectedContato.escritorioId)?.nome || 'Sem escritório vinculado')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linha Inferior: Pagamento e Observações */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 bg-app-surface p-4 rounded-xl border border-app-border">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider pb-2 border-b border-app-border flex items-center gap-1.5">
                      <DollarSign size={15} />
                      Dados de Pagamento
                    </h3>
                    <p className="text-sm text-app-text whitespace-pre-wrap">{selectedContato.dadosPagamento || 'Não informado'}</p>
                  </div>

                  <div className="space-y-2 bg-app-surface p-4 rounded-xl border border-app-border">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider pb-2 border-b border-app-border flex items-center gap-1.5">
                      <FileText size={15} />
                      Observações / Resumo dos Fatos
                    </h3>
                    <p className="text-sm text-app-text whitespace-pre-wrap">{selectedContato.observacoes || 'Não informado'}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {contactProcesses.length === 0 ? (
                  <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border space-y-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <Scale size={24} />
                    </div>
                    <p className="font-semibold text-app-text">Nenhum processo vinculado</p>
                    <p className="text-xs text-app-text-muted max-w-md mx-auto">
                      Este contato não figura como cliente principal nem como parte envolvida em nenhum processo cadastrado no sistema.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    <div className="flex items-center justify-between text-xs text-app-text-muted px-1">
                      <span>Total de {contactProcesses.length} processo(s) encontrado(s)</span>
                    </div>
                    {contactProcesses.map(({ processo, roles }) => {
                      const mainClient = state.contatos.find(c => String(c.id) === String(processo.clienteId));
                      const vara = state.varas.find(v => String(v.id) === String(processo.varaId));

                      return (
                        <div 
                          key={processo.id}
                          className="p-4 bg-app-surface rounded-xl border border-app-border hover:border-primary/40 transition-all space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-primary">
                                  {processo.numero || 'Sem Número'}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  processo.status === 'Inativo'
                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                }`}>
                                  {processo.status || 'Ativo'}
                                </span>
                              </div>
                              {processo.titulo && (
                                <p className="text-xs font-semibold text-app-text mt-1">{processo.titulo}</p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {roles.map((r, i) => (
                                <span 
                                  key={i}
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                    r === 'Cliente Principal' 
                                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                                      : r === 'Autor' 
                                      ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' 
                                      : r === 'Réu' 
                                      ? 'bg-red-500/10 text-red-600 border-red-500/20' 
                                      : 'bg-primary/10 text-primary border-primary/20'
                                  }`}
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-app-text bg-app-bg/60 p-3 rounded-lg border border-app-border/40">
                            <div>
                              <span className="text-app-text-muted font-medium">Cliente Principal: </span>
                              <span className="font-semibold text-app-text">{mainClient ? mainClient.nome : 'Não informado'}</span>
                            </div>
                            <div>
                              <span className="text-app-text-muted font-medium">Parte Contrária: </span>
                              <span className="font-semibold text-app-text">{processo.parteContraria || 'Não informada'}</span>
                            </div>
                            <div>
                              <span className="text-app-text-muted font-medium">Tribunal / Vara: </span>
                              <span className="text-app-text">
                                {processo.tribunal || ''} {vara ? `- ${vara.nome}` : ''}
                              </span>
                            </div>
                            <div>
                              <span className="text-app-text-muted font-medium">Classe / Ação: </span>
                              <span className="text-app-text">{processo.classe || processo.assunto || 'Não informada'}</span>
                            </div>
                            {processo.dataDistribuicao && (
                              <div>
                                <span className="text-app-text-muted font-medium">Data Distribuição: </span>
                                <span className="text-app-text">{processo.dataDistribuicao}</span>
                              </div>
                            )}
                            {processo.valorCausa ? (
                              <div>
                                <span className="text-app-text-muted font-medium">Valor da Causa: </span>
                                <span className="text-app-text font-medium">
                                  {Number(processo.valorCausa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="pt-6 flex justify-between border-t border-app-border">
              {hasPermission('contatos', 'delete') && (
                <button 
                  onClick={() => handleDelete(selectedContato.id)}
                  className="px-4 py-2 text-red-600 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors flex items-center"
                >
                  <Trash2 size={18} className="mr-2" />
                  Excluir
                </button>
              )}
              <div className="flex space-x-3">
                <button 
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors"
                >
                  Fechar
                </button>
                {hasPermission('contatos', 'write') && (
                  <button 
                    onClick={() => {
                      setIsViewModalOpen(false);
                      openEditModal(selectedContato);
                    }}
                    className="px-4 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors flex items-center shadow-sm"
                  >
                    <Edit2 size={18} className="mr-2" />
                    Editar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Editar Contato */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Contato">
        {selectedContato && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Nome *</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.nome || ''}
                  onChange={e => setSelectedContato({...selectedContato, nome: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Tipo *</label>
                <select 
                  required
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.tipo || 'Cliente'}
                  onChange={e => setSelectedContato({...selectedContato, tipo: e.target.value as any})}
                >
                  <option value="Cliente">Cliente</option>
                  <option value="Contato">Contato</option>
                  <option value="Lead">Lead</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Status *</label>
                <select 
                  required
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.status || 'Ativo'}
                  onChange={e => setSelectedContato({...selectedContato, status: e.target.value})}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Apelido</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.apelido || ''}
                  onChange={e => setSelectedContato({...selectedContato, apelido: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Estado Civil</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.statusCivil || ''}
                  onChange={e => setSelectedContato({...selectedContato, statusCivil: e.target.value})}
                  placeholder="Ex: Solteiro, Casado..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Profissão</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.profissao || ''}
                  onChange={e => setSelectedContato({...selectedContato, profissao: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">CPF/CNPJ</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.cpfCnpj || ''}
                  onChange={e => setSelectedContato({...selectedContato, cpfCnpj: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">RG</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.rg || ''}
                  onChange={e => setSelectedContato({...selectedContato, rg: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Email</label>
                <input 
                  type="email" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.email || ''}
                  onChange={e => setSelectedContato({...selectedContato, email: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Telefone</label>
                <input 
                  type="tel" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.telefone || ''}
                  onChange={e => setSelectedContato({...selectedContato, telefone: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">CEP</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.cep || ''}
                  onChange={e => setSelectedContato({...selectedContato, cep: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Município</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.municipio || ''}
                  onChange={e => setSelectedContato({...selectedContato, municipio: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Estado</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.estado || ''}
                  onChange={e => setSelectedContato({...selectedContato, estado: e.target.value})}
                  placeholder="Ex: AM, SP..."
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text">Endereço</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedContato.endereco || ''}
                  onChange={e => setSelectedContato({...selectedContato, endereco: e.target.value})}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text">Dados de Pagamento (Pix, Conta Bancária, etc.)</label>
                <textarea 
                  rows={2}
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text text-sm"
                  value={selectedContato.dadosPagamento || ''}
                  onChange={e => setSelectedContato({...selectedContato, dadosPagamento: e.target.value})}
                  placeholder="Ex: Chave PIX: pix@email.com, Banco: Nubank, Conta: ..."
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text">Observações</label>
                <textarea 
                  rows={3}
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text text-sm"
                  value={selectedContato.observacoes || ''}
                  onChange={e => setSelectedContato({...selectedContato, observacoes: e.target.value})}
                  placeholder="Observações adicionais ou resumo dos fatos..."
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text flex items-center gap-1.5">
                  <Building2 size={16} className="text-primary" />
                  Escritório Responsável *
                </label>
                <select 
                  required
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text text-sm font-medium"
                  value={selectedContato.escritorioId || ''}
                  onChange={e => setSelectedContato({...selectedContato, escritorioId: e.target.value})}
                >
                  <option value="">Selecione um escritório</option>
                  {(isAdmin() || isGlobalAdmin) && (
                    <option value="x">GLOBAL (Todos os Escritórios)</option>
                  )}
                  {availableOffices.map(esc => (
                    <option key={esc.id} value={esc.id}>{esc.nome}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
              <button 
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="px-4 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Configurar Exibição de Campos */}
      <Modal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} title="Configuração de Colunas da Tabela">
        <div className="space-y-5">
          <div className="bg-app-secondary/60 p-3.5 rounded-xl border border-app-border text-sm text-app-text-muted flex items-start gap-3">
            <SlidersHorizontal size={20} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-app-text">Personalizar Colunas da Tabela</p>
              <p className="text-xs mt-0.5 text-app-text-muted">
                Selecione as colunas opcionais que deseja exibir na tabela de listagem de contatos.
                Todos os campos permanecem sempre acessíveis para preenchimento nos formulários de cadastro e edição.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-app-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">Campos Opcionais</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllFields}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/10 transition-colors"
              >
                <CheckSquare size={14} />
                Marcar Todos
              </button>
              <span className="text-app-border">|</span>
              <button
                type="button"
                onClick={resetFieldsDefault}
                className="text-xs font-medium text-app-text-muted hover:text-app-text flex items-center gap-1 px-2 py-1 rounded hover:bg-app-secondary transition-colors"
              >
                <RotateCcw size={14} />
                Restaurar Padrão
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {[
              { id: 'email', label: 'Email', table: true },
              { id: 'telefone', label: 'Telefone', table: true },
              { id: 'cpfCnpj', label: 'CPF / CNPJ', table: true },
              { id: 'rg', label: 'RG' },
              { id: 'apelido', label: 'Apelido' },
              { id: 'statusCivil', label: 'Estado Civil' },
              { id: 'profissao', label: 'Profissão' },
              { id: 'endereco', label: 'Endereço Completo' },
              { id: 'cep', label: 'CEP' },
              { id: 'municipio', label: 'Município / Estado' },
              { id: 'dadosPagamento', label: 'Dados de Pagamento (PIX / Banco)' },
              { id: 'observacoes', label: 'Observações / Resumo dos Fatos' },
            ].map((field) => (
              <label
                key={field.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  (visibleFields as any)[field.id]
                    ? 'bg-primary/5 border-primary/30 text-app-text'
                    : 'bg-app-secondary/40 border-app-border text-app-text-muted hover:bg-app-secondary'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={!!(visibleFields as any)[field.id]}
                    onChange={() => toggleFieldVisibility(field.id as any)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-app-border bg-app-surface cursor-pointer"
                  />
                  <span className="text-sm font-medium">{field.label}</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  Tabela
                </span>
              </label>
            ))}
          </div>

          <div className="pt-4 flex justify-end border-t border-app-border">
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(false)}
              className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm"
            >
              Salvar e Fechar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
