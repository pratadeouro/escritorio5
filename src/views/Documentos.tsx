import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Trash2,
  Edit2,
  Copy,
  Check,
  FilePlus,
  FolderOpen,
  Printer,
  ArrowLeftRight,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Download,
  FileUp,
  RefreshCw
} from 'lucide-react';
import { formatDate } from '../utils/date';
import { Documento, Processo, Contato } from '../types';
import WordDocumentEditor, { WordDocumentEditorHandle } from '../components/WordDocumentEditor';
import {
  downloadDocx,
  htmlToPlainText,
  importDocxToHtml,
  isHtmlContent,
  normalizeContentToHtml,
  printHtmlDocument
} from '../utils/docxUtils';
import {
  ConfirmDeleteModal,
  matchesOfficeFilter,
  normalizeSearchStr
} from '../components/CadastrosTableHelper';

const AVAILABLE_VARIABLES = [
  {
    category: 'Processo',
    items: [
      { name: '%NUMERO_PROCESSO%', desc: 'Número único CNJ do processo' },
      { name: '%TITULO_PROCESSO%', desc: 'Título/Nome do Processo' },
      { name: '%STATUS_PROCESSO%', desc: 'Status do processo (Ativo/Inativo)' },
      { name: '%DATA_DISTRIBUICAO%', desc: 'Data de distribuição' },
      { name: '%TIPO_PROCESSO%', desc: 'Tipo do processo' },
      { name: '%CLASSE_PROCESSO%', desc: 'Classe judicial' },
      { name: '%ASSUNTO_PROCESSO%', desc: 'Assunto principal do processo' },
      { name: '%VALOR_CAUSA%', desc: 'Valor da causa formatado em R$' },
      { name: '%PASTA_PROCESSO%', desc: 'Pasta/Arquivo de referência' },
      { name: '%PARTE_CONTRARIA%', desc: 'Parte contrária' },
      { name: '%LINK_PROCESSO%', desc: 'Link de consulta externa' },
      { name: '%VARA_NOME%', desc: 'Nome da Vara vinculada' }
    ]
  },
  {
    category: 'Cliente / Contato',
    items: [
      { name: '%CLIENTE_NOME%', desc: 'Nome completo do cliente' },
      { name: '%CLIENTE_APELIDO%', desc: 'Apelido ou Nome Social' },
      { name: '%CLIENTE_STATUS_CIVIL%', desc: 'Estado civil' },
      { name: '%CLIENTE_PROFISSAO%', desc: 'Profissão do cliente' },
      { name: '%CLIENTE_RG%', desc: 'Registro Geral (RG)' },
      { name: '%CLIENTE_CPF_CNPJ%', desc: 'CPF ou CNPJ' },
      { name: '%CLIENTE_ENDERECO%', desc: 'Endereço completo' },
      { name: '%CLIENTE_CEP%', desc: 'Código Postal (CEP)' },
      { name: '%CLIENTE_TELEFONE%', desc: 'Telefone de contato' },
      { name: '%CLIENTE_EMAIL%', desc: 'E-mail principal' }
    ]
  },
  {
    category: 'Escritório',
    items: [
      { name: '%ESCRITORIO_NOME%', desc: 'Nome do escritório ativo' },
      { name: '%ESCRITORIO_CNPJ%', desc: 'CNPJ do escritório' },
      { name: '%ESCRITORIO_ENDERECO%', desc: 'Endereço do escritório' },
      { name: '%ESCRITORIO_EMAIL%', desc: 'E-mail corporativo' },
      { name: '%ESCRITORIO_TELEFONE%', desc: 'Telefone comercial' },
      { name: '%ESCRITORIO_RESPONSAVEL%', desc: 'Advogado responsável' },
      { name: '%ESCRITORIO_OAB%', desc: 'Inscrição OAB do responsável' }
    ]
  },
  {
    category: 'Gerais',
    items: [
      { name: '%DATA_ATUAL%', desc: 'Data de hoje formatada' },
      { name: '%HORA_ATUAL%', desc: 'Hora atual formatada' }
    ]
  }
];

function safeVal(rawVal: string | undefined | null, escapeForHtml: boolean): string {
  const str = String(rawVal ?? '');
  if (!escapeForHtml) return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function replaceVariables(
  templateText: string,
  options: { processo?: Processo; cliente?: Contato; office?: any; varas?: any[] }
) {
  if (!templateText) return '';
  let text = templateText;
  const escapeHtmlVal = isHtmlContent(templateText);

  // Processo variables
  if (options.processo) {
    const p = options.processo;
    text = text.replace(/%NUMERO_PROCESSO%/g, safeVal(p.numero, escapeHtmlVal));
    text = text.replace(/%TITULO_PROCESSO%/g, safeVal(p.titulo, escapeHtmlVal));
    text = text.replace(/%STATUS_PROCESSO%/g, safeVal(p.status, escapeHtmlVal));
    text = text.replace(/%DATA_DISTRIBUICAO%/g, safeVal(p.dataDistribuicao, escapeHtmlVal));
    text = text.replace(/%TIPO_PROCESSO%/g, safeVal(p.tipo, escapeHtmlVal));
    text = text.replace(/%CLASSE_PROCESSO%/g, safeVal(p.classe, escapeHtmlVal));
    text = text.replace(/%ASSUNTO_PROCESSO%/g, safeVal(p.assunto, escapeHtmlVal));
    const formattedValor = p.valorCausa
      ? `R$ ${Number(p.valorCausa).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`
      : 'R$ 0,00';
    text = text.replace(/%VALOR_CAUSA%/g, safeVal(formattedValor, escapeHtmlVal));
    text = text.replace(/%PASTA_PROCESSO%/g, safeVal(p.pasta, escapeHtmlVal));
    text = text.replace(/%PARTE_CONTRARIA%/g, safeVal(p.parteContraria, escapeHtmlVal));
    text = text.replace(/%LINK_PROCESSO%/g, safeVal(p.link, escapeHtmlVal));
    if (options.varas && p.varaId) {
      const v = options.varas.find(vara => vara.id === p.varaId);
      text = text.replace(/%VARA_NOME%/g, safeVal(v ? v.nome : '', escapeHtmlVal));
    } else {
      text = text.replace(/%VARA_NOME%/g, '');
    }
  } else {
    text = text.replace(/%NUMERO_PROCESSO%/g, '');
    text = text.replace(/%TITULO_PROCESSO%/g, '');
    text = text.replace(/%STATUS_PROCESSO%/g, '');
    text = text.replace(/%DATA_DISTRIBUICAO%/g, '');
    text = text.replace(/%TIPO_PROCESSO%/g, '');
    text = text.replace(/%CLASSE_PROCESSO%/g, '');
    text = text.replace(/%ASSUNTO_PROCESSO%/g, '');
    text = text.replace(/%VALOR_CAUSA%/g, '');
    text = text.replace(/%PASTA_PROCESSO%/g, '');
    text = text.replace(/%PARTE_CONTRARIA%/g, '');
    text = text.replace(/%LINK_PROCESSO%/g, '');
    text = text.replace(/%VARA_NOME%/g, '');
  }

  // Cliente/Contato variables
  if (options.cliente) {
    const c = options.cliente;
    text = text.replace(/%CLIENTE_NOME%/g, safeVal(c.nome, escapeHtmlVal));
    text = text.replace(/%CLIENTE_APELIDO%/g, safeVal(c.apelido, escapeHtmlVal));
    text = text.replace(/%CLIENTE_STATUS_CIVIL%/g, safeVal(c.statusCivil, escapeHtmlVal));
    text = text.replace(/%CLIENTE_PROFISSAO%/g, safeVal(c.profissao, escapeHtmlVal));
    text = text.replace(/%CLIENTE_RG%/g, safeVal(c.rg, escapeHtmlVal));
    text = text.replace(/%CLIENTE_CPF_CNPJ%/g, safeVal(c.cpfCnpj, escapeHtmlVal));
    text = text.replace(/%CLIENTE_ENDERECO%/g, safeVal(c.endereco, escapeHtmlVal));
    text = text.replace(/%CLIENTE_CEP%/g, safeVal(c.cep, escapeHtmlVal));
    text = text.replace(/%CLIENTE_TELEFONE%/g, safeVal(c.telefone, escapeHtmlVal));
    text = text.replace(/%CLIENTE_EMAIL%/g, safeVal(c.email, escapeHtmlVal));
  } else {
    text = text.replace(/%CLIENTE_NOME%/g, '');
    text = text.replace(/%CLIENTE_APELIDO%/g, '');
    text = text.replace(/%CLIENTE_STATUS_CIVIL%/g, '');
    text = text.replace(/%CLIENTE_PROFISSAO%/g, '');
    text = text.replace(/%CLIENTE_RG%/g, '');
    text = text.replace(/%CLIENTE_CPF_CNPJ%/g, '');
    text = text.replace(/%CLIENTE_ENDERECO%/g, '');
    text = text.replace(/%CLIENTE_CEP%/g, '');
    text = text.replace(/%CLIENTE_TELEFONE%/g, '');
    text = text.replace(/%CLIENTE_EMAIL%/g, '');
  }

  // Office variables
  if (options.office) {
    const o = options.office;
    text = text.replace(/%ESCRITORIO_NOME%/g, safeVal(o.nome, escapeHtmlVal));
    text = text.replace(/%ESCRITORIO_CNPJ%/g, safeVal(o.cnpj, escapeHtmlVal));
    text = text.replace(/%ESCRITORIO_ENDERECO%/g, safeVal(o.endereco, escapeHtmlVal));
    text = text.replace(/%ESCRITORIO_EMAIL%/g, safeVal(o.email, escapeHtmlVal));
    text = text.replace(/%ESCRITORIO_TELEFONE%/g, safeVal(o.telefone, escapeHtmlVal));
    text = text.replace(/%ESCRITORIO_RESPONSAVEL%/g, safeVal(o.responsavel, escapeHtmlVal));
    text = text.replace(/%ESCRITORIO_OAB%/g, safeVal(o.oab, escapeHtmlVal));
  } else {
    text = text.replace(/%ESCRITORIO_NOME%/g, '');
    text = text.replace(/%ESCRITORIO_CNPJ%/g, '');
    text = text.replace(/%ESCRITORIO_ENDERECO%/g, '');
    text = text.replace(/%ESCRITORIO_EMAIL%/g, '');
    text = text.replace(/%ESCRITORIO_TELEFONE%/g, '');
    text = text.replace(/%ESCRITORIO_RESPONSAVEL%/g, '');
    text = text.replace(/%ESCRITORIO_OAB%/g, '');
  }

  // General variables
  text = text.replace(/%DATA_ATUAL%/g, new Date().toLocaleDateString('pt-BR'));
  text = text.replace(
    /%HORA_ATUAL%/g,
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );

  return text;
}

export default function Documentos() {
  const {
    state,
    escritorioAtivoId,
    isAdmin,
    currentUser,
    hasPermission,
    addDocumento,
    updateDocumento,
    deleteDocumento
  } = useAppContext();

  const canWrite = hasPermission('documentos', 'write');
  const canDelete = hasPermission('documentos', 'delete');

  const [activeTab, setActiveTab] = useState<
    'salvos' | 'editor' | 'gerar-processo' | 'gerar-contrato'
  >('salvos');

  // Search state for list tab
  const [searchTerm, setSearchTerm] = useState('');

  // Editor states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorDocKey, setEditorDocKey] = useState<string>('new-0');
  const [editorTitle, setEditorTitle] = useState('');
  const [editorType, setEditorType] = useState<Documento['tipo']>('Outro');
  const [editorContent, setEditorContent] = useState('');
  const [variableSearch, setVariableSearch] = useState('');
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [showEditorPreview, setShowEditorPreview] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Generation States (Processo)
  const [genProcTemplateId, setGenProcTemplateId] = useState('');
  const [genProcProcessoId, setGenProcProcessoId] = useState('');
  const [genProcTitle, setGenProcTitle] = useState('');
  const [genProcRawTemplateHtml, setGenProcRawTemplateHtml] = useState('');
  const [genProcContent, setGenProcContent] = useState('');
  const [genProcDocKey, setGenProcDocKey] = useState('proc-init');
  const [procSearchTerm, setProcSearchTerm] = useState('');
  const [showProcDropdown, setShowProcDropdown] = useState(false);

  // Generation States (Contrato/Cliente)
  const [genCliTemplateId, setGenCliTemplateId] = useState('');
  const [genCliClienteId, setGenCliClienteId] = useState('');
  const [genCliTitle, setGenCliTitle] = useState('');
  const [genCliRawTemplateHtml, setGenCliRawTemplateHtml] = useState('');
  const [genCliContent, setGenCliContent] = useState('');
  const [genCliDocKey, setGenCliDocKey] = useState('cli-init');
  const [cliSearchTerm, setCliSearchTerm] = useState('');
  const [showCliDropdown, setShowCliDropdown] = useState(false);

  // Modal & status states
  const [viewingDoc, setViewingDoc] = useState<Documento | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Documento | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [exportingDocId, setExportingDocId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wordEditorRef = useRef<WordDocumentEditorHandle>(null);
  const procWordEditorRef = useRef<WordDocumentEditorHandle>(null);
  const cliWordEditorRef = useRef<WordDocumentEditorHandle>(null);
  const quickImportInputRef = useRef<HTMLInputElement>(null);

  // Active office details
  const activeOffice =
    state.escritorios?.find(e => e.id === escritorioAtivoId) ||
    state.escritorios?.[0] ||
    (state.settings as any);

  const isAdminUser = isAdmin();

  // Office-scoped documents (supports 'x' global templates and case-insensitive office IDs)
  const accessibleDocumentos = state.documentos.filter(d =>
    matchesOfficeFilter(d.escritorioId, escritorioAtivoId, isAdminUser, currentUser?.escritoriosIds)
  );

  const normalizedQuery = normalizeSearchStr(searchTerm);
  const filteredDocumentos = accessibleDocumentos.filter(d => {
    if (!normalizedQuery) return true;
    return (
      normalizeSearchStr(d.titulo).includes(normalizedQuery) ||
      normalizeSearchStr(d.tipo).includes(normalizedQuery)
    );
  });

  const normalizedProcSearch = normalizeSearchStr(procSearchTerm);
  const filteredProcessos = state.processos.filter(p => {
    if (
      !matchesOfficeFilter(p.escritorioId, escritorioAtivoId, isAdminUser, currentUser?.escritoriosIds)
    ) {
      return false;
    }
    const client = state.contatos.find(c => c.id === p.clienteId);
    return (
      normalizeSearchStr(p.numero).includes(normalizedProcSearch) ||
      normalizeSearchStr(p.titulo).includes(normalizedProcSearch) ||
      normalizeSearchStr(client?.nome).includes(normalizedProcSearch)
    );
  });

  const normalizedCliSearch = normalizeSearchStr(cliSearchTerm);
  const filteredClientes = state.contatos.filter(c => {
    if (
      !matchesOfficeFilter(c.escritorioId, escritorioAtivoId, isAdminUser, currentUser?.escritoriosIds)
    ) {
      return false;
    }
    return (
      normalizeSearchStr(c.nome).includes(normalizedCliSearch) ||
      normalizeSearchStr(c.cpfCnpj).includes(normalizedCliSearch)
    );
  });

  const normalizedVarSearch = normalizeSearchStr(variableSearch);
  const filteredVariableGroups = AVAILABLE_VARIABLES.map(group => ({
    ...group,
    items: group.items.filter(
      item =>
        !normalizedVarSearch ||
        normalizeSearchStr(item.name).includes(normalizedVarSearch) ||
        normalizeSearchStr(item.desc).includes(normalizedVarSearch)
    )
  })).filter(group => group.items.length > 0);

  const selectedProcessObj = state.processos.find(p => p.id === genProcProcessoId);
  const selectedClientForProc = selectedProcessObj
    ? state.contatos.find(c => c.id === selectedProcessObj.clienteId)
    : undefined;
  const selectedTemplateObjForProc = state.documentos.find(d => d.id === genProcTemplateId);

  const selectedClientObj = state.contatos.find(c => c.id === genCliClienteId);
  const selectedTemplateObjForCli = state.documentos.find(d => d.id === genCliTemplateId);

  // Automatic message cleanups
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const notify = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setErrorMessage(null);
      setSuccessMessage(message);
    } else {
      setSuccessMessage(null);
      setErrorMessage(message);
    }
  };

  const resetEditor = () => {
    setEditingId(null);
    setEditorTitle('');
    setEditorContent('');
    setEditorType('Outro');
    setEditorDocKey(`new-${Date.now()}`);
  };

  const insertVariable = (variableName: string) => {
    if (wordEditorRef.current) {
      wordEditorRef.current.insertVariable(variableName);
    } else {
      setEditorContent(prev => `${prev} ${variableName}`);
    }
  };

  const copyVariableToClipboard = async (variableName: string) => {
    try {
      await navigator.clipboard.writeText(variableName);
      setCopiedVariable(variableName);
      setTimeout(() => setCopiedVariable(null), 1500);
    } catch {
      notify('error', 'Não foi possível copiar a variável para a área de transferência.');
    }
  };

  const copyDocumentPlainText = async (content: string) => {
    try {
      await navigator.clipboard.writeText(htmlToPlainText(content));
      notify('success', 'Texto copiado para a área de transferência.');
    } catch {
      notify('error', 'Não foi possível copiar o conteúdo.');
    }
  };

  const handleQuickImportDocx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
      notify('error', 'Selecione um arquivo Microsoft Word no formato .docx.');
      return;
    }

    try {
      const { html } = await importDocxToHtml(file);
      const baseName = file.name.replace(/\.docx$/i, '').replace(/[_-]+/g, ' ').trim();
      setEditingId(null);
      setEditorTitle(baseName || 'Documento Importado');
      setEditorType(
        /contrato/i.test(baseName)
          ? 'Contrato'
          : /procura/i.test(baseName)
          ? 'Procuração'
          : /peti/i.test(baseName)
          ? 'Petição'
          : 'Outro'
      );
      setEditorContent(html);
      setEditorDocKey(`import-${Date.now()}`);
      setActiveTab('editor');
      notify('success', `Arquivo "${file.name}" carregado no editor Word.`);
    } catch (err: any) {
      notify('error', `Falha ao importar o arquivo .docx: ${err?.message || 'arquivo inválido'}.`);
    }
  };

  const handleDownloadDocumentDocx = async (id: string, title: string, content: string) => {
    setExportingDocId(id);
    try {
      await downloadDocx(content, title || 'Documento');
      notify('success', `Arquivo "${title || 'Documento'}.docx" baixado com sucesso.`);
    } catch (err: any) {
      notify('error', `Erro ao exportar .docx: ${err?.message || 'falha inesperada'}.`);
    } finally {
      setExportingDocId(null);
    }
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorTitle.trim()) {
      notify('error', 'O título do documento é obrigatório.');
      return;
    }

    setIsSaving(true);
    try {
      const latestHtml = wordEditorRef.current
        ? wordEditorRef.current.getHtmlContent()
        : editorContent;
      const existingDoc = editingId ? state.documentos.find(d => d.id === editingId) : null;
      const docData: Documento = {
        id: editingId || `DOC_${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
        titulo: editorTitle.trim(),
        tipo: editorType,
        conteudo: latestHtml,
        dataCriacao: existingDoc?.dataCriacao || new Date().toISOString().split('T')[0],
        escritorioId: existingDoc?.escritorioId || escritorioAtivoId || 'x',
        processoId: existingDoc?.processoId || ''
      };

      if (editingId) {
        updateDocumento(docData);
        notify('success', 'Documento atualizado com sucesso!');
      } else {
        addDocumento(docData);
        notify('success', 'Documento criado e salvo com sucesso!');
      }

      resetEditor();
      setActiveTab('salvos');
    } catch (err: any) {
      notify('error', 'Erro ao salvar documento: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (doc: Documento) => {
    setEditingId(doc.id);
    setEditorTitle(doc.titulo);
    setEditorType(doc.tipo);
    setEditorContent(normalizeContentToHtml(doc.conteudo));
    setEditorDocKey(`doc-${doc.id}-${Date.now()}`);
    setViewingDoc(null);
    setActiveTab('editor');
  };

  const confirmDelete = () => {
    if (!deletingDoc) return;
    try {
      deleteDocumento(deletingDoc.id);
      notify('success', 'Documento excluído com sucesso.');
    } catch (err: any) {
      notify('error', 'Erro ao excluir documento: ' + err.message);
    } finally {
      setDeletingDoc(null);
    }
  };

  const computeProcEditorHtml = (baseTemplateHtml: string, processoObj?: Processo) => {
    const normalized = normalizeContentToHtml(baseTemplateHtml);
    if (!processoObj) return normalized;
    const clientObj = state.contatos.find(c => c.id === processoObj.clienteId);
    return replaceVariables(normalized, {
      processo: processoObj,
      cliente: clientObj,
      office: activeOffice,
      varas: state.varas
    });
  };

  const handleSelectProcTemplate = (newTemplateId: string) => {
    setGenProcTemplateId(newTemplateId);
    const tpl = state.documentos.find(d => d.id === newTemplateId);
    const baseHtml = tpl ? normalizeContentToHtml(tpl.conteudo) : '';
    setGenProcRawTemplateHtml(baseHtml);

    if (tpl) {
      setGenProcTitle(
        selectedProcessObj ? `${tpl.titulo} - Processo ${selectedProcessObj.numero}` : tpl.titulo
      );
      const nextHtml = computeProcEditorHtml(baseHtml, selectedProcessObj);
      setGenProcContent(nextHtml);
    } else {
      setGenProcTitle('');
      setGenProcContent('');
    }
    setGenProcDocKey(`proc-${newTemplateId || 'none'}-${genProcProcessoId || 'none'}-${Date.now()}`);
  };

  const handleSelectProcesso = (processo: Processo) => {
    setGenProcProcessoId(processo.id);
    setProcSearchTerm(processo.numero);
    setShowProcDropdown(false);

    const baseHtml = selectedTemplateObjForProc
      ? normalizeContentToHtml(selectedTemplateObjForProc.conteudo)
      : genProcRawTemplateHtml || procWordEditorRef.current?.getHtmlContent() || genProcContent;

    const baseTitle = selectedTemplateObjForProc
      ? selectedTemplateObjForProc.titulo
      : genProcTitle.replace(/\s*-\s*Processo\s+.*$/i, '').trim() || 'Documento';

    setGenProcTitle(`${baseTitle} - Processo ${processo.numero}`);

    if (baseHtml && baseHtml.trim()) {
      const nextHtml = computeProcEditorHtml(baseHtml, processo);
      setGenProcContent(nextHtml);
      setGenProcDocKey(`proc-${genProcTemplateId || 'custom'}-${processo.id}-${Date.now()}`);
    }
  };

  const handleReapplyProcVariables = () => {
    const baseHtml = selectedTemplateObjForProc
      ? normalizeContentToHtml(selectedTemplateObjForProc.conteudo)
      : genProcRawTemplateHtml || procWordEditorRef.current?.getHtmlContent() || genProcContent;

    if (!baseHtml) {
      notify('error', 'Selecione um modelo ou importe um arquivo .docx primeiro.');
      return;
    }

    const nextHtml = computeProcEditorHtml(baseHtml, selectedProcessObj);
    setGenProcContent(nextHtml);
    setGenProcDocKey(`proc-reapply-${Date.now()}`);
    notify('success', 'Variáveis do processo reaplicadas na folha do editor.');
  };

  const computeCliEditorHtml = (baseTemplateHtml: string, clienteObj?: Contato) => {
    const normalized = normalizeContentToHtml(baseTemplateHtml);
    if (!clienteObj) return normalized;
    return replaceVariables(normalized, {
      cliente: clienteObj,
      office: activeOffice,
      varas: state.varas
    });
  };

  const handleSelectCliTemplate = (newTemplateId: string) => {
    setGenCliTemplateId(newTemplateId);
    const tpl = state.documentos.find(d => d.id === newTemplateId);
    const baseHtml = tpl ? normalizeContentToHtml(tpl.conteudo) : '';
    setGenCliRawTemplateHtml(baseHtml);

    if (tpl) {
      setGenCliTitle(selectedClientObj ? `Contrato - ${selectedClientObj.nome}` : tpl.titulo);
      const nextHtml = computeCliEditorHtml(baseHtml, selectedClientObj);
      setGenCliContent(nextHtml);
    } else {
      setGenCliTitle('');
      setGenCliContent('');
    }
    setGenCliDocKey(`cli-${newTemplateId || 'none'}-${genCliClienteId || 'none'}-${Date.now()}`);
  };

  const handleSelectCliente = (cliente: Contato) => {
    setGenCliClienteId(cliente.id);
    setCliSearchTerm(cliente.nome);
    setShowCliDropdown(false);

    const baseHtml = selectedTemplateObjForCli
      ? normalizeContentToHtml(selectedTemplateObjForCli.conteudo)
      : genCliRawTemplateHtml || cliWordEditorRef.current?.getHtmlContent() || genCliContent;

    setGenCliTitle(`Contrato - ${cliente.nome}`);

    if (baseHtml && baseHtml.trim()) {
      const nextHtml = computeCliEditorHtml(baseHtml, cliente);
      setGenCliContent(nextHtml);
      setGenCliDocKey(`cli-${genCliTemplateId || 'custom'}-${cliente.id}-${Date.now()}`);
    }
  };

  const handleReapplyCliVariables = () => {
    const baseHtml = selectedTemplateObjForCli
      ? normalizeContentToHtml(selectedTemplateObjForCli.conteudo)
      : genCliRawTemplateHtml || cliWordEditorRef.current?.getHtmlContent() || genCliContent;

    if (!baseHtml) {
      notify('error', 'Selecione um modelo ou importe um arquivo .docx primeiro.');
      return;
    }

    const nextHtml = computeCliEditorHtml(baseHtml, selectedClientObj);
    setGenCliContent(nextHtml);
    setGenCliDocKey(`cli-reapply-${Date.now()}`);
    notify('success', 'Variáveis do cliente reaplicadas na folha do editor.');
  };

  const handleGenerateForProcess = async () => {
    if (!genProcProcessoId) {
      notify('error', 'Por favor, escolha o processo ao qual o documento será vinculado.');
      return;
    }

    const process = state.processos.find(p => p.id === genProcProcessoId);
    if (!process) return;

    const latestHtml = procWordEditorRef.current
      ? procWordEditorRef.current.getHtmlContent()
      : genProcContent;

    if (!htmlToPlainText(latestHtml).trim()) {
      notify('error', 'A folha do editor está vazia. Selecione um modelo, importe um .docx ou digite o texto.');
      return;
    }

    const template = state.documentos.find(d => d.id === genProcTemplateId);

    setIsSaving(true);
    try {
      const finalTitle =
        genProcTitle.trim() ||
        `${template?.titulo || 'Documento'} - Processo ${process.numero}`;

      const newDoc: Documento = {
        id: `DOC_${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
        titulo: finalTitle,
        tipo: template ? template.tipo : 'Petição',
        conteudo: latestHtml,
        processoId: process.id,
        dataCriacao: new Date().toISOString().split('T')[0],
        escritorioId: escritorioAtivoId || 'x'
      };

      addDocumento(newDoc);
      notify('success', 'Documento salvo com sucesso!');
      setActiveTab('salvos');
    } catch (err: any) {
      notify('error', 'Erro ao salvar documento: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateContract = async () => {
    if (!genCliClienteId) {
      notify('error', 'Por favor, escolha o cliente para salvar o contrato.');
      return;
    }

    const client = state.contatos.find(c => c.id === genCliClienteId);
    if (!client) return;

    const latestHtml = cliWordEditorRef.current
      ? cliWordEditorRef.current.getHtmlContent()
      : genCliContent;

    if (!htmlToPlainText(latestHtml).trim()) {
      notify('error', 'A folha do contrato está vazia. Selecione um modelo, importe um .docx ou digite o texto.');
      return;
    }

    setIsSaving(true);
    try {
      const finalTitle = genCliTitle.trim() || `Contrato - ${client.nome}`;

      const newDoc: Documento = {
        id: `DOC_${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
        titulo: finalTitle,
        tipo: 'Contrato',
        conteudo: latestHtml,
        dataCriacao: new Date().toISOString().split('T')[0],
        escritorioId: escritorioAtivoId || 'x'
      };

      addDocumento(newDoc);
      notify('success', 'Contrato salvo com sucesso!');
      setActiveTab('salvos');
    } catch (err: any) {
      notify('error', 'Erro ao salvar contrato: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const printDocument = (doc: Pick<Documento, 'titulo' | 'conteudo'>) => {
    printHtmlDocument(doc.titulo || 'Documento', doc.conteudo);
  };

  return (
    <div className="flex-1 h-full min-h-0 w-full flex flex-col px-4 sm:px-6 pt-3 pb-1 gap-3 overflow-y-auto xl:overflow-hidden">
      {/* Hidden input for quick .docx import from header */}
      <input
        ref={quickImportInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleQuickImportDocx}
      />

      {/* Header and alerts */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-app-text flex items-center">
            <FileText className="mr-2.5 text-primary" size={22} />
            Gerador de Documentos
          </h1>
          <p className="text-xs text-app-text-muted mt-0.5">
            Editor estilo Word com paginação A4 real, importação/exportação nativa .docx e variáveis automáticas.
          </p>
        </div>
        {canWrite && activeTab === 'salvos' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => quickImportInputRef.current?.click()}
              className="bg-app-surface hover:bg-app-bg text-app-text border border-app-border px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-xs sm:text-sm font-medium"
              title="Importar um arquivo .docx do computador para o editor"
            >
              <FileUp size={15} className="text-primary" />
              Importar .docx
            </button>
            <button
              type="button"
              onClick={() => {
                resetEditor();
                setActiveTab('editor');
              }}
              className="bg-primary hover:opacity-90 text-white px-3.5 py-1.5 rounded-lg flex items-center transition-colors shadow-sm text-xs sm:text-sm font-medium"
            >
              <Plus size={16} className="mr-1.5" />
              Novo Modelo / Texto
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 animate-fade-in shrink-0">
          <CheckCircle2 size={18} className="shrink-0" />
          <span className="text-xs sm:text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 animate-fade-in shrink-0">
          <AlertCircle size={18} className="shrink-0" />
          <span className="text-xs sm:text-sm font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-app-border pb-px no-scrollbar shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('salvos')}
          className={`px-3.5 py-2 font-medium text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'salvos'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text'
          }`}
        >
          <FolderOpen size={15} />
          Documentos Salvos
          <span className="text-xs text-app-text-muted tabular-nums">
            ({filteredDocumentos.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`px-3.5 py-2 font-medium text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'editor'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text'
          }`}
        >
          <FileCode size={15} />
          {editingId ? 'Editar no Word (.docx)' : 'Editor Word (.docx)'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gerar-processo')}
          className={`px-3.5 py-2 font-medium text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'gerar-processo'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text'
          }`}
        >
          <ArrowLeftRight size={15} />
          Gerar p/ Processo
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gerar-contrato')}
          className={`px-3.5 py-2 font-medium text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'gerar-contrato'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text'
          }`}
        >
          <Sparkles size={15} />
          Gerar Contrato (Cliente)
        </button>
      </div>

      {/* Tab contents - stretches down to the page footer */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* TAB 1: SAVED DOCUMENTS */}
        {activeTab === 'salvos' && (
          <div className="flex-1 min-h-0 bg-app-surface rounded-xl shadow-sm border border-app-border flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted"
                  size={17}
                />
                <input
                  type="text"
                  placeholder="Buscar documentos ou modelos salvos..."
                  className="w-full pl-9 pr-4 py-1.5 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <span className="text-xs text-app-text-muted tabular-nums">
                Exibindo {filteredDocumentos.length} de {accessibleDocumentos.length} documento(s)
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-app-surface">
                  <tr className="border-b border-app-border bg-app-bg/70 text-app-text-muted text-[11px] uppercase tracking-wider font-bold">
                    <th className="py-3 px-4 font-bold">Documento</th>
                    <th className="py-3 px-4 font-bold">Tipo</th>
                    <th className="py-3 px-4 font-bold">Processo Vinculado</th>
                    <th className="py-3 px-4 font-bold">Criado em</th>
                    <th className="py-3 px-4 text-right font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {filteredDocumentos.map(doc => {
                    const process = state.processos.find(p => p.id === doc.processoId);
                    return (
                      <tr key={doc.id} className="hover:bg-app-bg/30 transition-colors group">
                        <td className="py-3.5 px-4 font-medium text-app-text">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
                              <FileText size={16} />
                            </div>
                            <span
                              className="truncate max-w-xs sm:max-w-md font-semibold text-sm"
                              title={doc.titulo}
                            >
                              {doc.titulo}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              doc.tipo === 'Petição'
                                ? 'bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20'
                                : doc.tipo === 'Contrato'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                                : doc.tipo === 'Procuração'
                                ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                                : 'bg-app-bg text-app-text-muted'
                            }`}
                          >
                            {doc.tipo}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {process ? (
                            <span
                              className="text-xs font-mono text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 truncate inline-block max-w-[200px] tabular-nums"
                              title={process.numero}
                            >
                              {process.numero}
                            </span>
                          ) : (
                            <span className="text-xs text-app-text-muted italic">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-app-text-muted tabular-nums">
                          {formatDate(doc.dataCriacao)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingDoc(doc)}
                              className="px-2.5 py-1.5 text-xs text-app-text hover:text-primary hover:bg-app-bg rounded-lg border border-app-border transition-colors flex items-center gap-1"
                              title="Visualizar documento em folha A4"
                            >
                              <Eye size={13} />
                              Ver
                            </button>
                            <button
                              type="button"
                              disabled={exportingDocId === doc.id}
                              onClick={() =>
                                handleDownloadDocumentDocx(doc.id, doc.titulo, doc.conteudo)
                              }
                              className="px-2.5 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg border border-primary/20 transition-colors flex items-center gap-1 font-medium disabled:opacity-50"
                              title="Baixar arquivo Microsoft Word (.docx)"
                            >
                              <Download size={13} />
                              .docx
                            </button>
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => handleEdit(doc)}
                                className="p-1.5 text-app-text hover:text-primary hover:bg-app-bg rounded-lg border border-app-border transition-colors"
                                title="Abrir no Editor Word"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => printDocument(doc)}
                              className="p-1.5 text-app-text hover:text-primary hover:bg-app-bg rounded-lg border border-app-border transition-colors"
                              title="Imprimir / Salvar PDF"
                            >
                              <Printer size={13} />
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeletingDoc(doc)}
                                className="p-1.5 text-app-text hover:text-rose-600 hover:bg-app-bg rounded-lg border border-app-border transition-colors"
                                title="Excluir documento"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredDocumentos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-app-text-muted">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <FolderOpen size={44} className="text-app-text-muted opacity-30" />
                          <p className="text-sm font-medium">Nenhum documento salvo encontrado.</p>
                          <p className="text-xs">
                            Crie um novo modelo no Editor Word ou importe um arquivo .docx pronto.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: EMBEDDED WORD-STYLE A4 EDITOR (OPTION A) */}
        {activeTab === 'editor' && (
          <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-4 xl:h-full">
            {/* Left side column: Document settings & Variable picker */}
            {!sidebarCollapsed && (
              <div className="xl:col-span-3 flex flex-col gap-3 xl:h-full xl:min-h-0 xl:overflow-y-auto custom-scrollbar pr-0.5">
                <div className="bg-app-surface border border-app-border rounded-xl p-4 shadow-sm space-y-3.5 shrink-0">
                  <div className="flex items-center justify-between pb-2 border-b border-app-border">
                    <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
                      <FilePlus size={16} className="text-primary" />
                      {editingId ? 'Editando Modelo' : 'Dados do Modelo'}
                    </h2>
                  <button
                    type="button"
                    onClick={() => setShowEditorPreview(true)}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                    title="Visualizar folha limpa"
                  >
                    <Eye size={13} />
                    Prévia A4
                  </button>
                </div>

                <form onSubmit={handleSaveModel} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text">Título do Documento</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Procuração Ad Judicia"
                      className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      value={editorTitle}
                      onChange={(e) => setEditorTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-app-text">Tipo do Documento</label>
                    <select
                      className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      value={editorType}
                      onChange={(e) => setEditorType(e.target.value as Documento['tipo'])}
                    >
                      <option value="Outro">Outro / Geral</option>
                      <option value="Contrato">Contrato</option>
                      <option value="Petição">Petição</option>
                      <option value="Procuração">Procuração</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSaving || !canWrite}
                      className="flex-1 bg-primary hover:opacity-90 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
                    >
                      {isSaving
                        ? 'Salvando...'
                        : editingId
                        ? 'Salvar Alterações'
                        : 'Salvar Modelo'}
                    </button>
                    <button
                      type="button"
                      onClick={resetEditor}
                      className="px-3 py-2 border border-app-border hover:bg-app-bg text-app-text rounded-lg text-xs font-medium transition-all"
                    >
                      Limpar
                    </button>
                  </div>
                </form>
              </div>

                {/* Variable library card */}
                <div className="bg-app-surface border border-app-border rounded-xl p-4 shadow-sm space-y-3 flex flex-col flex-1 min-h-[260px]">
                <div>
                  <h3 className="text-sm font-semibold text-app-text flex items-center gap-1.5">
                    <Sparkles size={15} className="text-amber-500" />
                    Variáveis Automáticas
                  </h3>
                  <p className="text-[11px] text-app-text-muted mt-0.5">
                    Clique em <strong>Inserir</strong> para posicionar a variável exatamente onde está o cursor na folha.
                  </p>
                </div>

                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-text-muted"
                  />
                  <input
                    type="text"
                    placeholder="Filtrar variável (ex: CPF, Vara)..."
                    value={variableSearch}
                    onChange={(e) => setVariableSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-app-bg border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1 flex-1">
                  {filteredVariableGroups.map(group => (
                    <div key={group.category} className="space-y-1.5">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider block border-b border-app-border pb-1">
                        {group.category}
                      </span>
                      <div className="space-y-1.5">
                        {group.items.map(item => (
                          <div
                            key={item.name}
                            className="p-1.5 bg-app-bg hover:bg-app-border/60 border border-app-border rounded-lg flex items-center justify-between gap-2 text-xs transition-colors"
                          >
                            <div className="min-w-0">
                              <span className="font-mono text-primary font-semibold select-all block truncate text-[11px]">
                                {item.name}
                              </span>
                              <span
                                className="text-[10px] text-app-text-muted block truncate mt-0.5"
                                title={item.desc}
                              >
                                {item.desc}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => insertVariable(item.name)}
                                className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded text-[10px] font-semibold transition-colors"
                                title="Inserir na posição do cursor"
                              >
                                Inserir
                              </button>
                              <button
                                type="button"
                                onClick={() => copyVariableToClipboard(item.name)}
                                className="p-1 text-app-text-muted hover:text-primary transition-colors"
                                title="Copiar variável"
                              >
                                {copiedVariable === item.name ? (
                                  <Check size={12} className="text-emerald-500" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredVariableGroups.length === 0 && (
                    <p className="text-xs text-app-text-muted text-center py-4">
                      Nenhuma variável encontrada.
                    </p>
                  )}
                </div>
              </div>
              </div>
            )}

            {/* Right side column: Embedded Word-Style A4 Rich Editor */}
            <div className={`${sidebarCollapsed ? 'xl:col-span-12' : 'xl:col-span-9'} flex flex-col min-h-[600px] xl:min-h-0 xl:h-full`}>
              <WordDocumentEditor
                ref={wordEditorRef}
                value={editorContent}
                onChange={setEditorContent}
                documentKey={editorDocKey}
                documentTitle={editorTitle || 'Modelo_Juridico'}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
                onImportDocx={({ fileName }) => {
                  if (!editorTitle.trim()) {
                    const cleanName = fileName
                      .replace(/\.docx$/i, '')
                      .replace(/[_-]+/g, ' ')
                      .trim();
                    if (cleanName) setEditorTitle(cleanName);
                  }
                }}
                onNotify={notify}
              />
            </div>
          </div>
        )}

        {/* TAB 3: GENERATOR BY PROCESSO WITH EMBEDDED WORD EDITOR */}
        {activeTab === 'gerar-processo' && (
          <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-4 xl:h-full">
            {/* Left Column: Template & Process Selection */}
            {!sidebarCollapsed && (
              <div className="xl:col-span-3 flex flex-col gap-3 xl:h-full xl:min-h-0 xl:overflow-y-auto custom-scrollbar pr-0.5">
                <div className="bg-app-surface border border-app-border rounded-xl p-4 shadow-sm space-y-3.5 shrink-0">
                  <h2 className="text-sm font-semibold text-app-text flex items-center gap-2 pb-2 border-b border-app-border">
                    <ArrowLeftRight size={16} className="text-primary" />
                    Dados do Processo
                  </h2>

                {/* 1. Pick Template */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-text">
                    1. Modelo Base (ou importe .docx ao lado)
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    value={genProcTemplateId}
                    onChange={(e) => handleSelectProcTemplate(e.target.value)}
                  >
                    <option value="">-- Escolha um modelo --</option>
                    {accessibleDocumentos.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.titulo} ({doc.tipo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Search and Pick Process */}
                <div className="space-y-1 relative">
                  <label className="text-xs font-semibold text-app-text">2. Escolha o Processo</label>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="Pesquisar por nº ou cliente..."
                      className="w-full pl-9 pr-4 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      value={procSearchTerm}
                      onChange={(e) => {
                        setProcSearchTerm(e.target.value);
                        setShowProcDropdown(true);
                      }}
                      onFocus={() => setShowProcDropdown(true)}
                    />
                  </div>

                  {showProcDropdown && procSearchTerm && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-app-surface border border-app-border rounded-lg shadow-lg max-h-48 overflow-y-auto text-xs custom-scrollbar">
                      {filteredProcessos.map(p => {
                        const client = state.contatos.find(c => c.id === p.clienteId);
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleSelectProcesso(p)}
                            className="p-2 hover:bg-primary/10 cursor-pointer border-b border-app-border last:border-0 transition-colors flex flex-col gap-0.5"
                          >
                            <span className="font-mono text-primary font-bold tabular-nums">
                              {p.numero}
                            </span>
                            <span className="text-app-text truncate">
                              {p.titulo || 'Sem título'}
                            </span>
                            {client && (
                              <span className="text-app-text-muted text-[10px]">
                                Cliente: {client.nome}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {filteredProcessos.length === 0 && (
                        <div className="p-3 text-center text-app-text-muted">
                          Nenhum processo encontrado.
                        </div>
                      )}
                    </div>
                  )}

                  {selectedProcessObj && (
                    <div className="p-3 bg-primary/5 border border-primary/15 rounded-lg text-xs space-y-1 mt-2">
                      <p className="font-bold text-primary">Processo Selecionado:</p>
                      <p className="tabular-nums">
                        <span className="font-semibold">Nº:</span> {selectedProcessObj.numero}
                      </p>
                      <p>
                        <span className="font-semibold">Ação:</span>{' '}
                        {selectedProcessObj.titulo || 'Não informada'}
                      </p>
                      {selectedClientForProc && (
                        <p>
                          <span className="font-semibold">Cliente:</span>{' '}
                          {selectedClientForProc.nome}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Editable Document Title */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-text">
                    3. Título do Documento Gerado
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Petição Inicial - Processo..."
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    value={genProcTitle}
                    onChange={(e) => setGenProcTitle(e.target.value)}
                  />
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={isSaving || !genProcProcessoId || !canWrite}
                    onClick={handleGenerateForProcess}
                    className="w-full bg-primary hover:opacity-90 disabled:opacity-50 text-white py-2 px-4 rounded-lg font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <FilePlus size={16} />
                    {isSaving ? 'Salvando...' : 'Salvar Documento Gerado'}
                  </button>

                  {(genProcTemplateId || genProcRawTemplateHtml) && (
                    <button
                      type="button"
                      onClick={handleReapplyProcVariables}
                      className="w-full border border-app-border hover:bg-app-bg text-app-text py-1.5 px-3 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-1.5"
                      title="Recarregar modelo base e substituir variáveis novamente"
                    >
                      <RefreshCw size={13} className="text-primary" />
                      Reaplicar Modelo e Variáveis
                    </button>
                  )}
                </div>
              </div>

              {/* Status Variables & Quick Insert */}
              <div className="bg-app-surface border border-app-border rounded-xl p-4 shadow-sm space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-app-text uppercase tracking-wider block border-b border-app-border pb-1.5">
                    Dados Mapeados do Processo
                  </h3>
                  <p className="text-[11px] text-app-text-muted mt-1">
                    Clique em um campo para inserir o valor correspondente na posição do cursor.
                  </p>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto text-xs custom-scrollbar pr-1">
                  {[
                    { label: 'Nº Processo', token: '%NUMERO_PROCESSO%', val: selectedProcessObj?.numero },
                    { label: 'Ação / Título', token: '%TITULO_PROCESSO%', val: selectedProcessObj?.titulo },
                    { label: 'Cliente', token: '%CLIENTE_NOME%', val: selectedClientForProc?.nome },
                    { label: 'CPF/CNPJ', token: '%CLIENTE_CPF_CNPJ%', val: selectedClientForProc?.cpfCnpj },
                    { label: 'Parte Contrária', token: '%PARTE_CONTRARIA%', val: selectedProcessObj?.parteContraria },
                    { label: 'Valor da Causa', token: '%VALOR_CAUSA%', val: selectedProcessObj?.valorCausa ? `R$ ${Number(selectedProcessObj.valorCausa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '' },
                    { label: 'Escritório', token: '%ESCRITORIO_NOME%', val: activeOffice?.nome }
                  ].map(field => (
                    <button
                      key={field.token}
                      type="button"
                      onClick={() =>
                        procWordEditorRef.current?.insertVariable(field.val || field.token)
                      }
                      className="w-full text-left p-1.5 rounded-lg bg-app-bg hover:bg-app-border/60 border border-app-border flex items-center justify-between gap-2 transition-colors"
                      title={`Inserir "${field.val || field.token}" no cursor`}
                    >
                      <span className="font-semibold text-app-text-muted text-[11px] shrink-0">
                        {field.label}
                      </span>
                      <span
                        className="text-primary font-medium truncate max-w-[140px] tabular-nums text-[11px]"
                        title={field.val || field.token}
                      >
                        {field.val || 'Vazio'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              </div>
            )}

            {/* Right Column: Embedded Word-Style A4 Editor */}
            <div className={`${sidebarCollapsed ? 'xl:col-span-12' : 'xl:col-span-9'} flex flex-col min-h-[600px] xl:min-h-0 xl:h-full`}>
              <WordDocumentEditor
                ref={procWordEditorRef}
                value={genProcContent}
                onChange={setGenProcContent}
                documentKey={genProcDocKey}
                documentTitle={
                  genProcTitle ||
                  (selectedProcessObj
                    ? `Documento_Processo_${selectedProcessObj.numero}`
                    : 'Documento_Processo')
                }
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
                placeholder="Selecione um modelo e um processo ao lado (ou clique em 'Importar .docx') para preencher e editar o documento diretamente nesta folha A4..."
                onImportDocx={({ fileName, html }) => {
                  setGenProcTemplateId('');
                  setGenProcRawTemplateHtml(html);
                  const cleanName = fileName.replace(/\.docx$/i, '').replace(/[_-]+/g, ' ').trim();
                  if (cleanName) {
                    setGenProcTitle(
                      selectedProcessObj
                        ? `${cleanName} - Processo ${selectedProcessObj.numero}`
                        : cleanName
                    );
                  }
                  if (selectedProcessObj) {
                    const resolved = computeProcEditorHtml(html, selectedProcessObj);
                    setGenProcContent(resolved);
                    setGenProcDocKey(`proc-import-${Date.now()}`);
                  }
                }}
                onNotify={notify}
              />
            </div>
          </div>
        )}

        {/* TAB 4: GENERATOR FOR CLIENT CONTRATO WITH EMBEDDED WORD EDITOR */}
        {activeTab === 'gerar-contrato' && (
          <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-4 xl:h-full">
            {/* Left Column: Template & Client Selection */}
            {!sidebarCollapsed && (
              <div className="xl:col-span-3 flex flex-col gap-3 xl:h-full xl:min-h-0 xl:overflow-y-auto custom-scrollbar pr-0.5">
                <div className="bg-app-surface border border-app-border rounded-xl p-4 shadow-sm space-y-3.5 shrink-0">
                  <h2 className="text-sm font-semibold text-app-text flex items-center gap-2 pb-2 border-b border-app-border">
                    <Sparkles size={16} className="text-amber-500" />
                    Dados do Contrato
                  </h2>

                {/* 1. Pick Template */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-text">
                    1. Modelo Base (ou importe .docx ao lado)
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    value={genCliTemplateId}
                    onChange={(e) => handleSelectCliTemplate(e.target.value)}
                  >
                    <option value="">-- Escolha um modelo --</option>
                    {accessibleDocumentos.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.titulo} ({doc.tipo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Search and Pick Contact/Client */}
                <div className="space-y-1 relative">
                  <label className="text-xs font-semibold text-app-text">2. Escolha o Cliente</label>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="Pesquisar por nome ou CPF..."
                      className="w-full pl-9 pr-4 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      value={cliSearchTerm}
                      onChange={(e) => {
                        setCliSearchTerm(e.target.value);
                        setShowCliDropdown(true);
                      }}
                      onFocus={() => setShowCliDropdown(true)}
                    />
                  </div>

                  {showCliDropdown && cliSearchTerm && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-app-surface border border-app-border rounded-lg shadow-lg max-h-48 overflow-y-auto text-xs custom-scrollbar">
                      {filteredClientes.map(c => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCliente(c)}
                          className="p-2 hover:bg-primary/10 cursor-pointer border-b border-app-border last:border-0 transition-colors flex flex-col gap-0.5"
                        >
                          <span className="font-bold text-app-text">{c.nome}</span>
                          <span className="text-app-text-muted text-[10px] tabular-nums">
                            CPF: {c.cpfCnpj} | Tel: {c.telefone}
                          </span>
                        </div>
                      ))}
                      {filteredClientes.length === 0 && (
                        <div className="p-3 text-center text-app-text-muted">
                          Nenhum cliente encontrado.
                        </div>
                      )}
                    </div>
                  )}

                  {selectedClientObj && (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg text-xs space-y-1 mt-2">
                      <p className="font-bold text-amber-600 dark:text-amber-400">
                        Cliente Selecionado:
                      </p>
                      <p>
                        <span className="font-semibold">Nome:</span> {selectedClientObj.nome}
                      </p>
                      <p className="tabular-nums">
                        <span className="font-semibold">CPF/CNPJ:</span> {selectedClientObj.cpfCnpj}
                      </p>
                      <p className="tabular-nums">
                        <span className="font-semibold">Telefone:</span>{' '}
                        {selectedClientObj.telefone}
                      </p>
                      <p>
                        <span className="font-semibold">Endereço:</span>{' '}
                        {selectedClientObj.endereco || 'Não cadastrado'}
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Editable Contract Title */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-app-text">
                    3. Título do Contrato
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Contrato de Honorários - Cliente..."
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    value={genCliTitle}
                    onChange={(e) => setGenCliTitle(e.target.value)}
                  />
                </div>

                {/* Confirm contract generation */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={isSaving || !genCliClienteId || !canWrite}
                    onClick={handleGenerateContract}
                    className="w-full bg-primary hover:opacity-90 disabled:opacity-50 text-white py-2 px-4 rounded-lg font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <FilePlus size={16} />
                    {isSaving ? 'Salvando...' : 'Salvar Contrato Gerado'}
                  </button>

                  {(genCliTemplateId || genCliRawTemplateHtml) && (
                    <button
                      type="button"
                      onClick={handleReapplyCliVariables}
                      className="w-full border border-app-border hover:bg-app-bg text-app-text py-1.5 px-3 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-1.5"
                      title="Recarregar modelo base e substituir variáveis do cliente novamente"
                    >
                      <RefreshCw size={13} className="text-primary" />
                      Reaplicar Modelo e Variáveis
                    </button>
                  )}
                </div>
              </div>

              {/* Variable mapped fields & Quick Insert */}
              <div className="bg-app-surface border border-app-border rounded-xl p-4 shadow-sm space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-app-text uppercase tracking-wider block border-b border-app-border pb-1.5">
                    Dados Mapeados do Cliente
                  </h3>
                  <p className="text-[11px] text-app-text-muted mt-1">
                    Clique em um campo para inserir o valor correspondente na posição do cursor.
                  </p>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto text-xs custom-scrollbar pr-1">
                  {[
                    { label: 'Nome', token: '%CLIENTE_NOME%', val: selectedClientObj?.nome },
                    { label: 'CPF/CNPJ', token: '%CLIENTE_CPF_CNPJ%', val: selectedClientObj?.cpfCnpj },
                    { label: 'RG', token: '%CLIENTE_RG%', val: selectedClientObj?.rg },
                    { label: 'Estado Civil', token: '%CLIENTE_STATUS_CIVIL%', val: selectedClientObj?.statusCivil },
                    { label: 'Profissão', token: '%CLIENTE_PROFISSAO%', val: selectedClientObj?.profissao },
                    { label: 'Endereço', token: '%CLIENTE_ENDERECO%', val: selectedClientObj?.endereco },
                    { label: 'Telefone', token: '%CLIENTE_TELEFONE%', val: selectedClientObj?.telefone },
                    { label: 'Escritório', token: '%ESCRITORIO_NOME%', val: activeOffice?.nome }
                  ].map(field => (
                    <button
                      key={field.token}
                      type="button"
                      onClick={() =>
                        cliWordEditorRef.current?.insertVariable(field.val || field.token)
                      }
                      className="w-full text-left p-1.5 rounded-lg bg-app-bg hover:bg-app-border/60 border border-app-border flex items-center justify-between gap-2 transition-colors"
                      title={`Inserir "${field.val || field.token}" no cursor`}
                    >
                      <span className="font-semibold text-app-text-muted text-[11px] shrink-0">
                        {field.label}
                      </span>
                      <span
                        className="text-primary font-medium truncate max-w-[140px] tabular-nums text-[11px]"
                        title={field.val || field.token}
                      >
                        {field.val || 'Vazio'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              </div>
            )}

            {/* Right Column: Embedded Word-Style A4 Editor */}
            <div className={`${sidebarCollapsed ? 'xl:col-span-12' : 'xl:col-span-9'} flex flex-col min-h-[600px] xl:min-h-0 xl:h-full`}>
              <WordDocumentEditor
                ref={cliWordEditorRef}
                value={genCliContent}
                onChange={setGenCliContent}
                documentKey={genCliDocKey}
                documentTitle={
                  genCliTitle ||
                  (selectedClientObj
                    ? `Contrato_${selectedClientObj.nome}`
                    : 'Contrato_Cliente')
                }
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
                placeholder="Selecione um modelo e um cliente ao lado (ou clique em 'Importar .docx') para preencher e editar o contrato diretamente nesta folha A4..."
                onImportDocx={({ fileName, html }) => {
                  setGenCliTemplateId('');
                  setGenCliRawTemplateHtml(html);
                  const cleanName = fileName.replace(/\.docx$/i, '').replace(/[_-]+/g, ' ').trim();
                  if (cleanName) {
                    setGenCliTitle(
                      selectedClientObj ? `Contrato - ${selectedClientObj.nome}` : cleanName
                    );
                  }
                  if (selectedClientObj) {
                    const resolved = computeCliEditorHtml(html, selectedClientObj);
                    setGenCliContent(resolved);
                    setGenCliDocKey(`cli-import-${Date.now()}`);
                  }
                }}
                onNotify={notify}
              />
            </div>
          </div>
        )}
      </div>

      {/* EDITOR DRAFT PREVIEW MODAL */}
      {showEditorPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-app-border flex items-center justify-between bg-app-bg">
              <div className="flex items-center gap-2">
                <FileText className="text-primary" size={20} />
                <h3 className="font-semibold text-app-text text-sm sm:text-base truncate max-w-lg">
                  Pré-visualização A4 — {editorTitle || 'Sem Título'}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Rascunho
              </span>
            </div>

            <div className="flex-1 p-6 sm:p-8 bg-zinc-100 dark:bg-zinc-950 overflow-y-auto overflow-x-auto custom-scrollbar flex justify-center">
              <div className="w-[21cm] min-h-[29.7cm] bg-white text-zinc-900 shadow-md border border-zinc-300 p-[2.5cm] select-text">
                {editorContent ? (
                  <div
                    className="word-page-content"
                    dangerouslySetInnerHTML={{
                      __html: normalizeContentToHtml(editorContent)
                    }}
                  />
                ) : (
                  <p className="text-zinc-400 italic text-center py-12">
                    Nenhum conteúdo no modelo para visualizar.
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-app-border bg-app-bg flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() =>
                  handleDownloadDocumentDocx(
                    'draft',
                    editorTitle || 'Rascunho',
                    editorContent
                  )
                }
                className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Download size={14} />
                Baixar .docx
              </button>
              <button
                type="button"
                onClick={() =>
                  printDocument({
                    titulo: editorTitle || 'Rascunho',
                    conteudo: editorContent
                  })
                }
                className="px-4 py-2 bg-primary text-white hover:opacity-90 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Printer size={14} />
                Imprimir / PDF
              </button>
              <button
                type="button"
                onClick={() => copyDocumentPlainText(editorContent)}
                className="px-4 py-2 border border-app-border hover:bg-app-surface rounded-lg text-xs font-semibold text-app-text flex items-center gap-1.5 transition-all"
              >
                <Copy size={14} />
                Copiar Texto
              </button>
              <button
                type="button"
                onClick={() => setShowEditorPreview(false)}
                className="px-4 py-2 border border-app-border hover:bg-app-surface rounded-lg text-xs font-semibold text-app-text transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL PREVIEW MODAL */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-app-border flex items-center justify-between bg-app-bg">
              <div className="flex items-center gap-2">
                <FileText className="text-primary" size={20} />
                <h3
                  className="font-semibold text-app-text text-sm sm:text-base truncate max-w-lg"
                  title={viewingDoc.titulo}
                >
                  {viewingDoc.titulo}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">
                {viewingDoc.tipo}
              </span>
            </div>

            <div className="flex-1 p-6 sm:p-8 bg-zinc-100 dark:bg-zinc-950 overflow-y-auto overflow-x-auto custom-scrollbar flex justify-center">
              <div className="w-[21cm] min-h-[29.7cm] bg-white text-zinc-900 shadow-md border border-zinc-300 p-[2.5cm] select-text">
                <div
                  className="word-page-content"
                  dangerouslySetInnerHTML={{
                    __html: normalizeContentToHtml(viewingDoc.conteudo)
                  }}
                />
              </div>
            </div>

            <div className="p-4 border-t border-app-border bg-app-bg flex flex-wrap gap-2 justify-end">
              {canWrite && (
                <button
                  type="button"
                  onClick={() => handleEdit(viewingDoc)}
                  className="px-4 py-2 border border-app-border hover:bg-app-surface rounded-lg text-xs font-semibold text-app-text flex items-center gap-1.5 transition-all"
                >
                  <Edit2 size={14} className="text-primary" />
                  Editar no Word
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  handleDownloadDocumentDocx(
                    viewingDoc.id,
                    viewingDoc.titulo,
                    viewingDoc.conteudo
                  )
                }
                className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Download size={14} />
                Baixar .docx
              </button>
              <button
                type="button"
                onClick={() => printDocument(viewingDoc)}
                className="px-4 py-2 bg-primary text-white hover:opacity-90 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Printer size={14} />
                Imprimir / PDF
              </button>
              <button
                type="button"
                onClick={() => copyDocumentPlainText(viewingDoc.conteudo)}
                className="px-4 py-2 border border-app-border hover:bg-app-surface rounded-lg text-xs font-semibold text-app-text flex items-center gap-1.5 transition-all"
              >
                <Copy size={14} />
                Copiar Texto
              </button>
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="px-4 py-2 border border-app-border hover:bg-app-surface rounded-lg text-xs font-semibold text-app-text transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingDoc)}
        onClose={() => setDeletingDoc(null)}
        onConfirm={confirmDelete}
        title="Excluir Documento"
        description={
          <>
            Tem certeza que deseja excluir permanentemente o documento{' '}
            <strong className="text-app-text">{deletingDoc?.titulo}</strong>? Esta ação não poderá
            ser desfeita.
          </>
        }
      />
    </div>
  );
}
