import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context';
import { 
  FileText, Plus, Search, FileDown, Eye, Trash2, Edit2, Copy, 
  Check, FilePlus, ChevronRight, User, FolderOpen, RefreshCw, 
  Printer, ArrowLeftRight, FileCode, Bold, Italic, List, Heading,
  CheckCircle2, AlertCircle, Sparkles, Download, ArrowRight, Share2,
  Underline, Quote, Link, Table, Minus
} from 'lucide-react';
import { formatDate } from '../utils/date';
import Markdown from 'react-markdown';
import { Documento, Processo, Contato } from '../types';

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
      { name: '%VARA_NOME%', desc: 'Nome da Vara vinculada' },
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
      { name: '%CLIENTE_EMAIL%', desc: 'E-mail principal' },
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
      { name: '%ESCRITORIO_OAB%', desc: 'Inscrição OAB do responsável' },
    ]
  },
  {
    category: 'Gerais',
    items: [
      { name: '%DATA_ATUAL%', desc: 'Data de hoje por extenso ou formatada' },
      { name: '%HORA_ATUAL%', desc: 'Hora atual formatada' },
    ]
  }
];

export function replaceVariables(
  templateText: string,
  options: { processo?: Processo; cliente?: Contato; office?: any; varas?: any[] }
) {
  if (!templateText) return '';
  let text = templateText;

  // Processo variables
  if (options.processo) {
    const p = options.processo;
    text = text.replace(/%NUMERO_PROCESSO%/g, p.numero || '');
    text = text.replace(/%TITULO_PROCESSO%/g, p.titulo || '');
    text = text.replace(/%STATUS_PROCESSO%/g, p.status || '');
    text = text.replace(/%DATA_DISTRIBUICAO%/g, p.dataDistribuicao || '');
    text = text.replace(/%TIPO_PROCESSO%/g, p.tipo || '');
    text = text.replace(/%CLASSE_PROCESSO%/g, p.classe || '');
    text = text.replace(/%ASSUNTO_PROCESSO%/g, p.assunto || '');
    text = text.replace(/%VALOR_CAUSA%/g, p.valorCausa ? `R$ ${Number(p.valorCausa).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00');
    text = text.replace(/%PASTA_PROCESSO%/g, p.pasta || '');
    text = text.replace(/%PARTE_CONTRARIA%/g, p.parteContraria || '');
    text = text.replace(/%LINK_PROCESSO%/g, p.link || '');
    if (options.varas && p.varaId) {
      const v = options.varas.find(vara => vara.id === p.varaId);
      text = text.replace(/%VARA_NOME%/g, v ? v.nome : '');
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
    text = text.replace(/%CLIENTE_NOME%/g, c.nome || '');
    text = text.replace(/%CLIENTE_APELIDO%/g, c.apelido || '');
    text = text.replace(/%CLIENTE_STATUS_CIVIL%/g, c.statusCivil || '');
    text = text.replace(/%CLIENTE_PROFISSAO%/g, c.profissao || '');
    text = text.replace(/%CLIENTE_RG%/g, c.rg || '');
    text = text.replace(/%CLIENTE_CPF_CNPJ%/g, c.cpfCnpj || '');
    text = text.replace(/%CLIENTE_ENDERECO%/g, c.endereco || '');
    text = text.replace(/%CLIENTE_CEP%/g, c.cep || '');
    text = text.replace(/%CLIENTE_TELEFONE%/g, c.telefone || '');
    text = text.replace(/%CLIENTE_EMAIL%/g, c.email || '');
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
    text = text.replace(/%ESCRITORIO_NOME%/g, o.nome || '');
    text = text.replace(/%ESCRITORIO_CNPJ%/g, o.cnpj || '');
    text = text.replace(/%ESCRITORIO_ENDERECO%/g, o.endereco || '');
    text = text.replace(/%ESCRITORIO_EMAIL%/g, o.email || '');
    text = text.replace(/%ESCRITORIO_TELEFONE%/g, o.telefone || '');
    text = text.replace(/%ESCRITORIO_RESPONSAVEL%/g, o.responsavel || '');
    text = text.replace(/%ESCRITORIO_OAB%/g, o.oab || '');
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
  text = text.replace(/%HORA_ATUAL%/g, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

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

  const [activeTab, setActiveTab] = useState<'salvos' | 'editor' | 'gerar-processo' | 'gerar-contrato'>('salvos');
  
  // Search state for list tab
  const [searchTerm, setSearchTerm] = useState('');

  // Editor states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorType, setEditorType] = useState<Documento['tipo']>('Outro');
  const [editorContent, setEditorContent] = useState('');
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [showEditorPreview, setShowEditorPreview] = useState(false);

  // Generation States (Processo)
  const [genProcTemplateId, setGenProcTemplateId] = useState('');
  const [genProcProcessoId, setGenProcProcessoId] = useState('');
  const [procSearchTerm, setProcSearchTerm] = useState('');
  const [showProcDropdown, setShowProcDropdown] = useState(false);

  // Generation States (Contrato/Cliente)
  const [genCliTemplateId, setGenCliTemplateId] = useState('');
  const [genCliClienteId, setGenCliClienteId] = useState('');
  const [cliSearchTerm, setCliSearchTerm] = useState('');
  const [showCliDropdown, setShowCliDropdown] = useState(false);

  // Modal view state
  const [viewingDoc, setViewingDoc] = useState<Documento | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active office details
  const activeOffice = state.escritorios?.find(e => e.id === escritorioAtivoId) || state.escritorios?.[0] || (state.settings as any);

  // Filtered lists
  const filteredDocumentos = state.documentos.filter(d => {
    if (escritorioAtivoId && d.escritorioId !== escritorioAtivoId) return false;
    if (!isAdmin() && !(currentUser?.escritoriosIds || []).includes(d.escritorioId)) return false;
    
    return d.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
           d.tipo.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredProcessos = state.processos.filter(p => {
    if (escritorioAtivoId && p.escritorioId !== escritorioAtivoId) return false;
    const client = state.contatos.find(c => c.id === p.clienteId);
    return p.numero.toLowerCase().includes(procSearchTerm.toLowerCase()) ||
           (p.titulo || '').toLowerCase().includes(procSearchTerm.toLowerCase()) ||
           (client?.nome || '').toLowerCase().includes(procSearchTerm.toLowerCase());
  });

  const filteredClientes = state.contatos.filter(c => {
    if (escritorioAtivoId && c.escritorioId !== escritorioAtivoId) return false;
    // We can filter by "Cliente" or any contact
    return c.nome.toLowerCase().includes(cliSearchTerm.toLowerCase()) ||
           c.cpfCnpj.toLowerCase().includes(cliSearchTerm.toLowerCase());
  });

  const selectedProcessObj = state.processos.find(p => p.id === genProcProcessoId);
  const selectedClientForProc = selectedProcessObj ? state.contatos.find(c => c.id === selectedProcessObj.clienteId) : undefined;
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

  const insertVariable = (variableName: string) => {
    if (!textareaRef.current) {
      setEditorContent(prev => prev + ' ' + variableName + ' ');
      return;
    }
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = editorContent;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    setEditorContent(before + variableName + after);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + variableName.length, start + variableName.length);
      }
    }, 0);
  };

  const copyVariableToClipboard = async (variableName: string) => {
    try {
      await navigator.clipboard.writeText(variableName);
      setCopiedVariable(variableName);
      setTimeout(() => setCopiedVariable(null), 1500);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const insertFormat = (formatType: 'bold' | 'italic' | 'underline' | 'list' | 'heading' | 'quote' | 'link' | 'table' | 'divider') => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = editorContent;
    const selectedText = text.substring(start, end);
    let replacement = '';

    switch (formatType) {
      case 'bold':
        replacement = `**${selectedText || 'texto em negrito'}**`;
        break;
      case 'italic':
        replacement = `*${selectedText || 'texto em itálico'}*`;
        break;
      case 'underline':
        replacement = `<u>${selectedText || 'texto sublinhado'}</u>`;
        break;
      case 'list':
        replacement = `\n- ${selectedText || 'item da lista'}`;
        break;
      case 'heading':
        replacement = `\n# ${selectedText || 'Título Principal'}\n`;
        break;
      case 'quote':
        replacement = `\n> ${selectedText || 'Citação / Parágrafo Recuado'}\n`;
        break;
      case 'link':
        replacement = `[${selectedText || 'texto do link'}](https://exemplo.com)`;
        break;
      case 'table':
        replacement = `\n| Cabeçalho 1 | Cabeçalho 2 |\n| ----------- | ----------- |\n| Dado 1      | Dado 2      |\n`;
        break;
      case 'divider':
        replacement = `\n---\n`;
        break;
    }

    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    setEditorContent(before + replacement + after);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + replacement.length, start + replacement.length);
      }
    }, 0);
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorTitle.trim()) {
      setErrorMessage('O título do documento é obrigatório.');
      return;
    }

    setIsSaving(true);
    try {
      const existingDoc = editingId ? state.documentos.find(d => d.id === editingId) : null;
      const docData: Documento = {
        id: editingId || `DOC_${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
        titulo: editorTitle,
        tipo: editorType,
        conteudo: editorContent,
        dataCriacao: existingDoc?.dataCriacao || new Date().toISOString().split('T')[0],
        escritorioId: existingDoc?.escritorioId || escritorioAtivoId || 'x',
        processoId: existingDoc?.processoId || ''
      };

      if (editingId) {
        updateDocumento(docData);
        setSuccessMessage('Documento atualizado com sucesso!');
      } else {
        addDocumento(docData);
        setSuccessMessage('Documento criado e salvo com sucesso!');
      }
      
      // Reset editor or switch to salvos tab after delay
      setEditingId(null);
      setEditorTitle('');
      setEditorContent('');
      setEditorType('Outro');
      setActiveTab('salvos');
    } catch (err: any) {
      setErrorMessage('Erro ao salvar documento: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (doc: Documento) => {
    setEditingId(doc.id);
    setEditorTitle(doc.titulo);
    setEditorType(doc.tipo);
    setEditorContent(doc.conteudo);
    setActiveTab('editor');
  };

  const handleDelete = (docId: string) => {
    if (window.confirm('Tem certeza de que deseja excluir este documento?')) {
      try {
        deleteDocumento(docId);
        setSuccessMessage('Documento excluído com sucesso!');
      } catch (err: any) {
        setErrorMessage('Erro ao excluir documento: ' + err.message);
      }
    }
  };

  const handleGenerateForProcess = async () => {
    if (!genProcTemplateId || !genProcProcessoId) {
      setErrorMessage('Por favor, selecione um modelo e um processo.');
      return;
    }

    const template = state.documentos.find(d => d.id === genProcTemplateId);
    const process = state.processos.find(p => p.id === genProcProcessoId);
    if (!template || !process) return;

    setIsSaving(true);
    try {
      const resolvedContent = replaceVariables(template.conteudo, {
        processo: process,
        cliente: selectedClientForProc,
        office: activeOffice,
        varas: state.varas
      });

      const newDoc: Documento = {
        id: `DOC_${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
        titulo: `${template.titulo} - Processo ${process.numero}`,
        tipo: template.tipo === 'Outro' ? 'Outro' : template.tipo,
        conteudo: resolvedContent,
        processoId: process.id,
        dataCriacao: new Date().toISOString().split('T')[0],
        escritorioId: escritorioAtivoId || ''
      };

      addDocumento(newDoc);
      setSuccessMessage('Novo documento gerado e salvo com sucesso!');
      setActiveTab('salvos');
    } catch (err: any) {
      setErrorMessage('Erro ao gerar documento: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateContract = async () => {
    if (!genCliTemplateId || !genCliClienteId) {
      setErrorMessage('Por favor, selecione um modelo e um cliente.');
      return;
    }

    const template = state.documentos.find(d => d.id === genCliTemplateId);
    const client = state.contatos.find(c => c.id === genCliClienteId);
    if (!template || !client) return;

    setIsSaving(true);
    try {
      const resolvedContent = replaceVariables(template.conteudo, {
        cliente: client,
        office: activeOffice,
        varas: state.varas
      });

      const newDoc: Documento = {
        id: `DOC_${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
        titulo: `Contrato - ${client.nome}`,
        tipo: 'Contrato',
        conteudo: resolvedContent,
        dataCriacao: new Date().toISOString().split('T')[0],
        escritorioId: escritorioAtivoId || ''
      };

      addDocumento(newDoc);
      setSuccessMessage('Contrato gerado e salvo com sucesso!');
      setActiveTab('salvos');
    } catch (err: any) {
      setErrorMessage('Erro ao gerar contrato: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const printDocument = (doc: Documento) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita popups para imprimir o documento.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${doc.titulo}</title>
          <style>
            body {
              font-family: 'Inter', system-ui, sans-serif;
              padding: 2.5cm;
              line-height: 1.6;
              color: #1a1a1a;
              background-color: #ffffff;
            }
            h1, h2, h3, h4 {
              color: #000000;
              margin-top: 1.5em;
              margin-bottom: 0.5em;
            }
            p {
              margin-bottom: 1em;
              text-align: justify;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <h1>${doc.titulo}</h1>
          <div style="white-space: pre-wrap; font-size: 11pt;">${doc.conteudo}</div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header and alerts */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text flex items-center">
            <FileText className="mr-3 text-primary" />
            Gerador de Documentos
          </h1>
          <p className="text-xs text-app-text-muted mt-1">
            Editor profissional com suporte a variáveis automáticas e preenchimento inteligente de dados.
          </p>
        </div>
        {canWrite && activeTab === 'salvos' && (
          <button 
            onClick={() => {
              setEditingId(null);
              setEditorTitle('');
              setEditorContent('');
              setEditorType('Outro');
              setActiveTab('editor');
            }}
            className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm text-sm"
          >
            <Plus size={18} className="mr-2" />
            Novo Modelo / Texto
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl flex items-start gap-3 animate-fade-in">
          <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-4 rounded-xl flex items-start gap-3 animate-fade-in">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Modern responsive tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-app-border pb-px no-scrollbar">
        <button
          onClick={() => setActiveTab('salvos')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'salvos'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text'
          }`}
        >
          <FolderOpen size={16} />
          Documentos Salvos
        </button>
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'editor'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text'
          }`}
        >
          <FileCode size={16} />
          {editingId ? 'Editar Documento' : 'Criar Modelo / Editor'}
        </button>
        <button
          onClick={() => setActiveTab('gerar-processo')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'gerar-processo'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text'
          }`}
        >
          <ArrowLeftRight size={16} />
          Gerar p/ Processo
        </button>
        <button
          onClick={() => setActiveTab('gerar-contrato')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'gerar-contrato'
              ? 'border-primary text-primary'
              : 'border-transparent text-app-text-muted hover:text-app-text'
          }`}
        >
          <Sparkles size={16} />
          Gerar Contrato (Cliente)
        </button>
      </div>

      {/* Tab contents */}
      <div className="space-y-6">
        
        {/* TAB 1: SAVED DOCUMENTS */}
        {activeTab === 'salvos' && (
          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
            <div className="p-4 border-b border-app-border flex items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar documentos salvos..." 
                  className="w-full pl-10 pr-4 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-app-border bg-app-bg/50 text-app-text-muted text-[11px] uppercase tracking-wider font-bold">
                    <th className="py-3.5 px-4 font-bold">Documento</th>
                    <th className="py-3.5 px-4 font-bold">Tipo</th>
                    <th className="py-3.5 px-4 font-bold">Processo Vinculado</th>
                    <th className="py-3.5 px-4 font-bold">Criado em</th>
                    <th className="py-3.5 px-4 text-right font-bold">Ações</th>
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
                            <span className="truncate max-w-xs sm:max-w-md font-semibold text-sm" title={doc.titulo}>
                              {doc.titulo}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            doc.tipo === 'Petição' ? 'bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20' :
                            doc.tipo === 'Contrato' ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' :
                            doc.tipo === 'Procuração' ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
                            'bg-app-bg text-app-text-muted'
                          }`}>
                            {doc.tipo}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {process ? (
                            <span className="text-xs font-mono text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 truncate inline-block max-w-[200px]" title={process.numero}>
                              {process.numero}
                            </span>
                          ) : (
                            <span className="text-xs text-app-text-muted italic">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-app-text-muted">
                          {formatDate(doc.dataCriacao)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => setViewingDoc(doc)}
                              className="px-2.5 py-1.5 text-xs text-app-text hover:text-primary hover:bg-app-bg rounded-lg border border-app-border transition-colors flex items-center gap-1"
                              title="Visualizar documento completo"
                            >
                              <Eye size={13} />
                              Ver
                            </button>
                            {canWrite && (
                              <button 
                                onClick={() => handleEdit(doc)}
                                className="p-1.5 text-app-text hover:text-primary hover:bg-app-bg rounded-lg border border-app-border transition-colors"
                                title="Editar documento"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            <button 
                              onClick={() => printDocument(doc)}
                              className="p-1.5 text-app-text hover:text-primary hover:bg-app-bg rounded-lg border border-app-border transition-colors"
                              title="Imprimir / Exportar"
                            >
                              <Printer size={13} />
                            </button>
                            {canDelete && (
                              <button 
                                onClick={() => handleDelete(doc.id)}
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
                          <p className="text-xs">Crie um novo modelo para começar a gerar documentos automáticos.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: RICH WORKSPACE EDITOR */}
        {activeTab === 'editor' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left side column: Document settings & Variable picker */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-app-surface border border-app-border rounded-xl p-5 shadow-sm space-y-5">
                <h2 className="text-sm font-semibold text-app-text flex items-center gap-2 pb-2 border-b border-app-border">
                  <FilePlus size={16} className="text-primary" />
                  Configurações do Modelo
                </h2>
                
                <form onSubmit={handleSaveModel} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-app-text">Título do Modelo</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: Contrato de Honorários Advocatícios"
                      className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      value={editorTitle}
                      onChange={(e) => setEditorTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-app-text">Tipo do Documento</label>
                    <select
                      className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      value={editorType}
                      onChange={(e) => setEditorType(e.target.value as any)}
                    >
                      <option value="Outro">Outro / Geral</option>
                      <option value="Contrato">Contrato</option>
                      <option value="Petição">Petição</option>
                      <option value="Procuração">Procuração</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 bg-primary hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
                    >
                      {isSaving ? 'Salvando...' : (editingId ? 'Salvar Edições' : 'Salvar Modelo')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditorTitle('');
                        setEditorContent('');
                        setEditorType('Outro');
                      }}
                      className="px-3 py-2 border border-app-border hover:bg-app-bg text-app-text rounded-lg text-sm transition-all"
                    >
                      Limpar
                    </button>
                  </div>
                </form>
              </div>

              {/* Variable library card */}
              <div className="bg-app-surface border border-app-border rounded-xl p-5 shadow-sm space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                <div>
                  <h3 className="text-sm font-semibold text-app-text flex items-center gap-1.5">
                    <Sparkles size={16} className="text-amber-500" />
                    Biblioteca de Variáveis
                  </h3>
                  <p className="text-[11px] text-app-text-muted mt-1">
                    Insira estas variáveis no seu modelo. Elas serão substituídas automaticamente ao gerar um documento.
                  </p>
                </div>

                <div className="space-y-4">
                  {AVAILABLE_VARIABLES.map(group => (
                    <div key={group.category} className="space-y-2">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider block border-b border-app-border pb-1">
                        {group.category}
                      </span>
                      <div className="space-y-1.5">
                        {group.items.map(item => (
                          <div 
                            key={item.name} 
                            className="p-1.5 bg-app-bg hover:bg-app-border border border-app-border rounded-lg flex items-center justify-between text-xs transition-colors group/item"
                          >
                            <div className="min-w-0">
                              <span className="font-mono text-primary font-semibold select-all block truncate text-[11px]">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-app-text-muted block truncate mt-0.5" title={item.desc}>
                                {item.desc}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => insertVariable(item.name)}
                                className="px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded text-[10px] font-medium transition-colors"
                                title="Inserir no cursor do editor"
                              >
                                Inserir
                              </button>
                              <button
                                onClick={() => copyVariableToClipboard(item.name)}
                                className="p-1 text-app-text-muted hover:text-primary transition-colors"
                                title="Copiar variável"
                              >
                                {copiedVariable === item.name ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right side column: Main Text Editor (Full width) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[650px]">
                
                {/* Editor formatting toolbar */}
                <div className="bg-app-bg px-4 py-2 border-b border-app-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-x-auto no-scrollbar">
                  <div className="flex items-center flex-wrap gap-1 shrink-0">
                    <button 
                      type="button"
                      onClick={() => insertFormat('bold')} 
                      className="p-1.5 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                      title="Negrito (**)"
                    >
                      <Bold size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => insertFormat('italic')} 
                      className="p-1.5 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                      title="Itálico (*)"
                    >
                      <Italic size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => insertFormat('underline')} 
                      className="p-1.5 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                      title="Sublinhado (<u>)"
                    >
                      <Underline size={15} />
                    </button>
                    <div className="h-4 w-[1px] bg-app-border mx-1" />
                    <button 
                      type="button"
                      onClick={() => insertFormat('heading')} 
                      className="p-1.5 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                      title="Título (#)"
                    >
                      <Heading size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => insertFormat('list')} 
                      className="p-1.5 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                      title="Lista (-)"
                    >
                      <List size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => insertFormat('quote')} 
                      className="p-1.5 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                      title="Citação (>)"
                    >
                      <Quote size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => insertFormat('link')} 
                      className="p-1.5 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                      title="Link"
                    >
                      <Link size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => insertFormat('table')} 
                      className="p-1.5 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                      title="Tabela"
                    >
                      <Table size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => insertFormat('divider')} 
                      className="p-1.5 hover:bg-app-border rounded-md text-app-text-muted hover:text-app-text transition-colors"
                      title="Linha Divisória (---)"
                    >
                      <Minus size={15} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-[10px] text-app-text-muted font-mono bg-app-surface px-2 py-0.5 rounded border border-app-border shrink-0">
                      Markdown / HTML
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEditorPreview(true)}
                      className="bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-primary/20 shrink-0"
                      title="Visualizar documento formatado"
                    >
                      <Eye size={13} />
                      Visualizar Rascunho
                    </button>
                  </div>
                </div>

                {/* Editor Content Area (Full width text editor) */}
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="px-3 py-1 bg-app-bg text-[10px] text-app-text-muted font-semibold uppercase tracking-wider border-b border-app-border flex justify-between items-center">
                    <span>Área de Escrita</span>
                    <span className="text-[10px] text-app-text-muted font-mono">{editorContent.length} caracteres</span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="w-full flex-1 p-5 bg-app-surface text-app-text text-sm font-sans focus:outline-none resize-none overflow-y-auto leading-relaxed custom-scrollbar border-0"
                    placeholder="Comece a digitar seu modelo aqui...&#10;&#10;Exemplo:&#10;AO JUÍZO DA %VARA_NOME%&#10;&#10;%CLIENTE_NOME%, nacionalidade..., portador do CPF %CLIENTE_CPF_CNPJ%, vem por meio deste...&#10;&#10;Contrato em anexo relativo ao processo de número %NUMERO_PROCESSO%."
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
          </div>
        )}

        {/* TAB 3: GENERATOR BY PROCESSO */}
        {activeTab === 'gerar-processo' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Template Selection Column */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-app-surface border border-app-border rounded-xl p-5 shadow-sm space-y-5">
                <h2 className="text-sm font-semibold text-app-text flex items-center gap-2 pb-2 border-b border-app-border">
                  <ArrowLeftRight size={16} className="text-primary" />
                  Preencher dados do Processo
                </h2>

                {/* 1. Pick Template */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-app-text">1. Selecione o Modelo Base</label>
                  <select
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    value={genProcTemplateId}
                    onChange={(e) => setGenProcTemplateId(e.target.value)}
                  >
                    <option value="">-- Escolha um modelo --</option>
                    {state.documentos.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.titulo} ({doc.tipo})</option>
                    ))}
                  </select>
                </div>

                {/* 2. Search and Pick Process */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-semibold text-app-text">2. Escolha o Processo</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={16} />
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
                            onClick={() => {
                              setGenProcProcessoId(p.id);
                              setProcSearchTerm(p.numero);
                              setShowProcDropdown(false);
                            }}
                            className="p-2 hover:bg-primary/10 cursor-pointer border-b border-app-border last:border-0 transition-colors flex flex-col gap-0.5"
                          >
                            <span className="font-mono text-primary font-bold">{p.numero}</span>
                            <span className="text-app-text truncate">{p.titulo || 'Sem título'}</span>
                            {client && <span className="text-app-text-muted text-[10px]">Cliente: {client.nome}</span>}
                          </div>
                        );
                      })}
                      {filteredProcessos.length === 0 && (
                        <div className="p-3 text-center text-app-text-muted">Nenhum processo encontrado.</div>
                      )}
                    </div>
                  )}

                  {selectedProcessObj && (
                    <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg text-xs space-y-1 mt-2">
                      <p className="font-bold text-primary">Processo Selecionado:</p>
                      <p><span className="font-semibold">Nº:</span> {selectedProcessObj.numero}</p>
                      <p><span className="font-semibold">Ação:</span> {selectedProcessObj.titulo || 'Não informada'}</p>
                      {selectedClientForProc && (
                        <p><span className="font-semibold">Cliente:</span> {selectedClientForProc.nome}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Confirm generation */}
                <button
                  type="button"
                  disabled={isSaving || !genProcTemplateId || !genProcProcessoId}
                  onClick={handleGenerateForProcess}
                  className="w-full bg-primary hover:opacity-90 disabled:opacity-50 text-white py-2 px-4 rounded-lg font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <FilePlus size={16} />
                  {isSaving ? 'Gerando...' : 'Gerar e Salvar Documento'}
                </button>
              </div>

              {/* Status Variables preview */}
              {selectedTemplateObjForProc && (
                <div className="bg-app-surface border border-app-border rounded-xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-app-text uppercase tracking-wider block border-b border-app-border pb-1.5">
                    Variáveis Mapeadas para o Documento
                  </h3>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto text-xs custom-scrollbar">
                    <div className="flex justify-between border-b border-app-border py-1">
                      <span className="font-mono text-primary">%NUMERO_PROCESSO%</span>
                      <span className="text-app-text truncate max-w-[150px]" title={selectedProcessObj?.numero}>{selectedProcessObj?.numero || 'Vazio'}</span>
                    </div>
                    <div className="flex justify-between border-b border-app-border py-1">
                      <span className="font-mono text-primary">%CLIENTE_NOME%</span>
                      <span className="text-app-text truncate max-w-[150px]" title={selectedClientForProc?.nome}>{selectedClientForProc?.nome || 'Vazio'}</span>
                    </div>
                    <div className="flex justify-between border-b border-app-border py-1">
                      <span className="font-mono text-primary">%CLIENTE_CPF_CNPJ%</span>
                      <span className="text-app-text truncate max-w-[150px]" title={selectedClientForProc?.cpfCnpj}>{selectedClientForProc?.cpfCnpj || 'Vazio'}</span>
                    </div>
                    <div className="flex justify-between border-b border-app-border py-1">
                      <span className="font-mono text-primary">%ESCRITORIO_NOME%</span>
                      <span className="text-app-text truncate max-w-[150px]">{activeOffice?.nome || 'Vazio'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generated Document Live Preview Sheet */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="bg-app-surface border border-app-border rounded-xl shadow-sm flex flex-col h-[650px] overflow-hidden">
                <div className="bg-app-bg px-4 py-3 border-b border-app-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="text-primary" size={18} />
                    <span className="font-semibold text-app-text text-sm">Visualização em Tempo Real (Com Variáveis Substituídas)</span>
                  </div>
                  {genProcTemplateId && genProcProcessoId && (
                    <button 
                      onClick={() => {
                        const resolved = replaceVariables(selectedTemplateObjForProc?.conteudo || '', {
                          processo: selectedProcessObj,
                          cliente: selectedClientForProc,
                          office: activeOffice,
                          varas: state.varas
                        });
                        printDocument({
                          id: '',
                          titulo: selectedTemplateObjForProc?.titulo || 'Documento',
                          tipo: 'Outro',
                          conteudo: resolved,
                          dataCriacao: ''
                        });
                      }}
                      className="px-2.5 py-1 text-xs border border-app-border hover:bg-app-bg rounded-lg text-app-text transition-colors flex items-center gap-1.5"
                    >
                      <Printer size={13} />
                      Imprimir
                    </button>
                  )}
                </div>

                <div className="flex-1 p-8 bg-zinc-100 dark:bg-zinc-950 overflow-y-auto custom-scrollbar flex justify-center">
                  <div className="w-full max-w-[21cm] min-h-[29.7cm] bg-white dark:bg-zinc-900 shadow-lg border border-zinc-200 dark:border-zinc-800 p-[2.5cm] select-text">
                    <div className="prose dark:prose-invert prose-sm max-w-none text-black dark:text-zinc-100 leading-relaxed markdown-body">
                      {selectedTemplateObjForProc && selectedProcessObj ? (
                        <Markdown>
                          {replaceVariables(selectedTemplateObjForProc.conteudo, {
                            processo: selectedProcessObj,
                            cliente: selectedClientForProc,
                            office: activeOffice,
                            varas: state.varas
                          })}
                        </Markdown>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-app-text-muted gap-3">
                          <ArrowLeftRight size={36} className="text-primary/40" />
                          <p className="text-sm font-medium">Selecione o modelo e o processo ao lado.</p>
                          <p className="text-xs text-center max-w-xs">O documento será preenchido automaticamente substituindo os marcadores %variavel% em tempo real.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: GENERATOR FOR CLIENT CONTRATO */}
        {activeTab === 'gerar-contrato' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Client and Template selection */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-app-surface border border-app-border rounded-xl p-5 shadow-sm space-y-5">
                <h2 className="text-sm font-semibold text-app-text flex items-center gap-2 pb-2 border-b border-app-border">
                  <Sparkles size={16} className="text-amber-500" />
                  Gerar Contrato (Dados do Cliente)
                </h2>

                {/* 1. Pick Template */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-app-text">1. Selecione o Modelo Base</label>
                  <select
                    className="w-full px-3 py-2 border border-app-border bg-app-bg text-app-text rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    value={genCliTemplateId}
                    onChange={(e) => setGenCliTemplateId(e.target.value)}
                  >
                    <option value="">-- Escolha um modelo --</option>
                    {state.documentos.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.titulo} ({doc.tipo})</option>
                    ))}
                  </select>
                </div>

                {/* 2. Search and Pick Contact/Client */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-semibold text-app-text">2. Escolha o Cliente</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={16} />
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
                          onClick={() => {
                            setGenCliClienteId(c.id);
                            setCliSearchTerm(c.nome);
                            setShowCliDropdown(false);
                          }}
                          className="p-2 hover:bg-primary/10 cursor-pointer border-b border-app-border last:border-0 transition-colors flex flex-col gap-0.5"
                        >
                          <span className="font-bold text-app-text">{c.nome}</span>
                          <span className="text-app-text-muted text-[10px]">CPF: {c.cpfCnpj} | Cel: {c.telefone}</span>
                        </div>
                      ))}
                      {filteredClientes.length === 0 && (
                        <div className="p-3 text-center text-app-text-muted">Nenhum cliente encontrado.</div>
                      )}
                    </div>
                  )}

                  {selectedClientObj && (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg text-xs space-y-1 mt-2">
                      <p className="font-bold text-amber-500">Cliente Selecionado:</p>
                      <p><span className="font-semibold">Nome:</span> {selectedClientObj.nome}</p>
                      <p><span className="font-semibold">CPF/CNPJ:</span> {selectedClientObj.cpfCnpj}</p>
                      <p><span className="font-semibold">Telefone:</span> {selectedClientObj.telefone}</p>
                      <p><span className="font-semibold">Endereço:</span> {selectedClientObj.endereco || 'Não cadastrado'}</p>
                    </div>
                  )}
                </div>

                {/* Confirm contract generation */}
                <button
                  type="button"
                  disabled={isSaving || !genCliTemplateId || !genCliClienteId}
                  onClick={handleGenerateContract}
                  className="w-full bg-primary hover:opacity-90 disabled:opacity-50 text-white py-2 px-4 rounded-lg font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <FilePlus size={16} />
                  {isSaving ? 'Gerando...' : 'Gerar e Salvar Contrato'}
                </button>
              </div>

              {/* Variable mapped fields */}
              {selectedTemplateObjForCli && (
                <div className="bg-app-surface border border-app-border rounded-xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-app-text uppercase tracking-wider block border-b border-app-border pb-1.5">
                    Substituição de Variáveis Ativas
                  </h3>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto text-xs custom-scrollbar">
                    <div className="flex justify-between border-b border-app-border py-1">
                      <span className="font-mono text-primary">%CLIENTE_NOME%</span>
                      <span className="text-app-text truncate max-w-[150px]" title={selectedClientObj?.nome}>{selectedClientObj?.nome || 'Vazio'}</span>
                    </div>
                    <div className="flex justify-between border-b border-app-border py-1">
                      <span className="font-mono text-primary">%CLIENTE_CPF_CNPJ%</span>
                      <span className="text-app-text truncate max-w-[150px]">{selectedClientObj?.cpfCnpj || 'Vazio'}</span>
                    </div>
                    <div className="flex justify-between border-b border-app-border py-1">
                      <span className="font-mono text-primary">%CLIENTE_RG%</span>
                      <span className="text-app-text truncate max-w-[150px]">{selectedClientObj?.rg || 'Vazio'}</span>
                    </div>
                    <div className="flex justify-between border-b border-app-border py-1">
                      <span className="font-mono text-primary">%CLIENTE_ENDERECO%</span>
                      <span className="text-app-text truncate max-w-[150px]" title={selectedClientObj?.endereco}>{selectedClientObj?.endereco || 'Vazio'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Contract live preview sheet */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="bg-app-surface border border-app-border rounded-xl shadow-sm flex flex-col h-[650px] overflow-hidden">
                <div className="bg-app-bg px-4 py-3 border-b border-app-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-amber-500" size={18} />
                    <span className="font-semibold text-app-text text-sm">Contrato Gerado - Visualização de Impressão</span>
                  </div>
                  {genCliTemplateId && genCliClienteId && (
                    <button 
                      onClick={() => {
                        const resolved = replaceVariables(selectedTemplateObjForCli?.conteudo || '', {
                          cliente: selectedClientObj,
                          office: activeOffice,
                          varas: state.varas
                        });
                        printDocument({
                          id: '',
                          titulo: selectedTemplateObjForCli?.titulo || 'Contrato',
                          tipo: 'Contrato',
                          conteudo: resolved,
                          dataCriacao: ''
                        });
                      }}
                      className="px-2.5 py-1 text-xs border border-app-border hover:bg-app-bg rounded-lg text-app-text transition-colors flex items-center gap-1.5"
                    >
                      <Printer size={13} />
                      Imprimir
                    </button>
                  )}
                </div>

                <div className="flex-1 p-8 bg-zinc-100 dark:bg-zinc-950 overflow-y-auto custom-scrollbar flex justify-center">
                  <div className="w-full max-w-[21cm] min-h-[29.7cm] bg-white dark:bg-zinc-900 shadow-lg border border-zinc-200 dark:border-zinc-800 p-[2.5cm] select-text">
                    <div className="prose dark:prose-invert prose-sm max-w-none text-black dark:text-zinc-100 leading-relaxed markdown-body">
                      {selectedTemplateObjForCli && selectedClientObj ? (
                        <Markdown>
                          {replaceVariables(selectedTemplateObjForCli.conteudo, {
                            cliente: selectedClientObj,
                            office: activeOffice,
                            varas: state.varas
                          })}
                        </Markdown>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-app-text-muted gap-3">
                          <Sparkles size={36} className="text-amber-500/40 animate-pulse" />
                          <p className="text-sm font-medium">Selecione o modelo e o cliente ao lado.</p>
                          <p className="text-xs text-center max-w-xs">O contrato será preenchido substituindo os marcadores de dados do cliente em tempo real.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* EDITOR PREVIEW MODAL */}
      {showEditorPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Modal Title bar */}
            <div className="px-5 py-4 border-b border-app-border flex items-center justify-between bg-app-bg">
              <div className="flex items-center gap-2">
                <FileText className="text-primary" size={20} />
                <h3 className="font-semibold text-app-text text-sm sm:text-base truncate max-w-lg">
                  Visualização do Rascunho - {editorTitle || 'Sem Título'}
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500">
                Rascunho
              </span>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 p-6 sm:p-8 bg-zinc-100 dark:bg-zinc-950 overflow-y-auto custom-scrollbar flex justify-center">
              <div className="w-full max-w-[21cm] min-h-[29.7cm] bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-800 p-[2cm] select-text">
                <div className="prose dark:prose-invert prose-sm max-w-none text-black dark:text-zinc-100 leading-relaxed markdown-body">
                  {editorContent ? (
                    <Markdown>{editorContent}</Markdown>
                  ) : (
                    <p className="text-app-text-muted italic text-center py-12">Nenhum conteúdo no modelo para visualizar.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer actions */}
            <div className="p-4 border-t border-app-border bg-app-bg flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  const demoDoc: Documento = {
                    id: '',
                    titulo: editorTitle || 'Rascunho',
                    tipo: editorType,
                    conteudo: editorContent,
                    dataCriacao: ''
                  };
                  printDocument(demoDoc);
                }}
                className="px-4 py-2 bg-primary text-white hover:opacity-90 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Printer size={14} />
                Imprimir / PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(editorContent);
                  alert('Conteúdo copiado para a área de transferência!');
                }}
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
            
            {/* Modal Title bar */}
            <div className="px-5 py-4 border-b border-app-border flex items-center justify-between bg-app-bg">
              <div className="flex items-center gap-2">
                <FileText className="text-primary" size={20} />
                <h3 className="font-semibold text-app-text text-sm sm:text-base truncate max-w-lg" title={viewingDoc.titulo}>
                  {viewingDoc.titulo}
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {viewingDoc.tipo}
              </span>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 p-6 sm:p-8 bg-zinc-100 dark:bg-zinc-950 overflow-y-auto custom-scrollbar flex justify-center">
              <div className="w-full max-w-[21cm] min-h-[29.7cm] bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-800 p-[2cm] select-text">
                <div className="prose dark:prose-invert prose-sm max-w-none text-black dark:text-zinc-100 leading-relaxed markdown-body">
                  <Markdown>{viewingDoc.conteudo}</Markdown>
                </div>
              </div>
            </div>

            {/* Modal Footer actions */}
            <div className="p-4 border-t border-app-border bg-app-bg flex flex-wrap gap-2 justify-end">
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
                onClick={() => {
                  navigator.clipboard.writeText(viewingDoc.conteudo);
                  alert('Conteúdo copiado para a área de transferência!');
                }}
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

    </div>
  );
}
