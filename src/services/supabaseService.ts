import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  AppState, 
  Contato, 
  Processo, 
  Evento, 
  Movimento, 
  Transacao, 
  Documento, 
  Vara, 
  Usuario, 
  Tarefa, 
  Julgador, 
  Servidor, 
  Recurso, 
  UPJ, 
  Escritorio, 
  Modelo, 
  Tribunal, 
  Forum, 
  Etiqueta, 
  TipoEnvolvimento, 
  Calendario, 
  Lead, 
  LeadStatus, 
  DEFAULT_LEAD_STATUSES, 
  LogRegistro,
  AppSettings
} from '../types';

// Credenciais configuradas
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || 'https://qhxdujbsipgwthrgvncl.supabase.co';
const SUPABASE_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL';

let supabaseInstance: SupabaseClient | null = null;

export const isSupabaseConfigured = (): boolean => {
  return !!SUPABASE_URL && !!SUPABASE_KEY && SUPABASE_URL.startsWith('https://');
};

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return supabaseInstance;
};

/**
 * Obtém a fonte de dados ativa: 'supabase' ou 'sheets'
 */
export const getActiveDataSource = (): 'supabase' | 'sheets' => {
  const saved = localStorage.getItem('advocacia_data_source');
  if (saved === 'supabase' || saved === 'sheets') return saved;
  const envSource = (import.meta as any).env.VITE_DATA_SOURCE;
  if (envSource === 'supabase' || envSource === 'sheets') return envSource;
  // Padrão para supabase se estiver configurado
  return isSupabaseConfigured() ? 'supabase' : 'sheets';
};

/**
 * Define a fonte de dados ativa
 */
export const setActiveDataSource = (source: 'supabase' | 'sheets') => {
  localStorage.setItem('advocacia_data_source', source);
};

// ==============================================================================
// LEITURA COMPLETA (SELECT) DE DADOS DO SUPABASE
// ==============================================================================

export const fetchAllDataFromSupabase = async (coreOnly = false): Promise<Partial<AppState>> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não está configurado.');
  }

  const supabase = getSupabase();
  console.log(`[Supabase] Carregando dados (${coreOnly ? 'ESSENCIAIS' : 'COMPLETOS'})...`);

  // Tabelas essenciais para login e perfil do escritório
  const coreQueries = [
    supabase.from('escritorios').select('*'),
    supabase.from('usuarios').select('*'),
    supabase.from('app_settings').select('*'),
  ];

  if (coreOnly) {
    const [escRes, usuRes, setRes] = await Promise.all(coreQueries);
    return {
      escritorios: (escRes.data || []).map(mapEscritorioFromDb),
      usuarios: (usuRes.data || []).map(mapUsuarioFromDb),
      allSettings: (setRes.data || []).map(mapSettingsFromDb),
    };
  }

  // Consulta de todas as 24 tabelas em paralelo
  const [
    escRes, usuRes, procRes, contRes, tarRes, eveRes, movRes, finRes, docRes,
    varRes, julRes, serRes, recRes, upjRes, forRes, triRes, envRes, modRes,
    etiRes, calRes, leaRes, lesRes, logRes, setRes
  ] = await Promise.all([
    supabase.from('escritorios').select('*'),
    supabase.from('usuarios').select('*'),
    supabase.from('processos').select('*').order('data_distribuicao', { ascending: false }),
    supabase.from('contatos').select('*').order('nome'),
    supabase.from('tarefas').select('*').order('data_limite', { ascending: true }),
    supabase.from('eventos').select('*').order('data', { ascending: true }),
    supabase.from('movimentos').select('*').order('data', { ascending: false }),
    supabase.from('financeiro').select('*').order('data', { ascending: false }),
    supabase.from('documentos').select('*').order('data_criacao', { ascending: false }),
    supabase.from('varas').select('*').order('nome'),
    supabase.from('julgadores').select('*').order('nome'),
    supabase.from('servidores').select('*').order('nome'),
    supabase.from('recursos').select('*'),
    supabase.from('upj').select('*'),
    supabase.from('forums').select('*'),
    supabase.from('tribunais').select('*'),
    supabase.from('envolvidos').select('*'),
    supabase.from('modelos').select('*'),
    supabase.from('etiquetas').select('*'),
    supabase.from('calendario').select('*'),
    supabase.from('leads').select('*').order('data_cadastro', { ascending: false }),
    supabase.from('leads_status').select('*'),
    supabase.from('logs').select('*').order('data', { ascending: false }).limit(200),
    supabase.from('app_settings').select('*')
  ]);

  const allSettings = (setRes.data || []).map(mapSettingsFromDb);
  const activeSettings = allSettings[0] || ({} as AppSettings);

  console.log('[Supabase] Dados carregados com sucesso:', {
    processos: procRes.data?.length || 0,
    contatos: contRes.data?.length || 0,
    tarefas: tarRes.data?.length || 0,
    usuarios: usuRes.data?.length || 0
  });

  return {
    escritorios: (escRes.data || []).map(mapEscritorioFromDb),
    usuarios: (usuRes.data || []).map(mapUsuarioFromDb),
    processos: (procRes.data || []).map(mapProcessoFromDb),
    contatos: (contRes.data || []).map(mapContatoFromDb),
    tarefas: (tarRes.data || []).map(mapTarefaFromDb),
    eventos: (eveRes.data || []).map(mapEventoFromDb),
    movimentos: (movRes.data || []).map(mapMovimentoFromDb),
    financeiro: (finRes.data || []).map(mapFinanceiroFromDb),
    documentos: (docRes.data || []).map(mapDocumentoFromDb),
    varas: (varRes.data || []).map(mapVaraFromDb),
    julgadores: (julRes.data || []).map(mapJulgadorFromDb),
    servidores: (serRes.data || []).map(mapServidorFromDb),
    recursos: (recRes.data || []).map(mapRecursoFromDb),
    upj: (upjRes.data || []).map(mapUpjFromDb),
    forums: (forRes.data || []).map(mapForumFromDb),
    tribunais: (triRes.data || []).map(mapTribunalFromDb),
    envolvidos: (envRes.data || []).map(mapEnvolvidoFromDb),
    modelos: (modRes.data || []).map(mapModeloFromDb),
    etiquetas: (etiRes.data || []).map(mapEtiquetaFromDb),
    calendario: (calRes.data || []).map(mapCalendarioFromDb),
    leads: (leaRes.data || []).map(mapLeadFromDb),
    leadsStatus: lesRes.data && lesRes.data.length > 0 ? lesRes.data.map(mapLeadStatusFromDb) : DEFAULT_LEAD_STATUSES,
    logs: (logRes.data || []).map(mapLogFromDb),
    allSettings,
    settings: activeSettings,
    hasLoaded: true,
    hasFullLoaded: true,
    syncStatus: 'idle',
    lastSyncTime: new Date().toISOString()
  };
};

// ==============================================================================
// MAPEAMENTO (PostgreSQL snake_case -> AppState camelCase)
// ==============================================================================

const mapEscritorioFromDb = (r: any): Escritorio => ({
  id: r.id,
  nome: r.nome,
  cnpj: r.cnpj || undefined,
  endereco: r.endereco || undefined,
  telefone: r.telefone || undefined,
  email: r.email || undefined,
  logoUrl: r.logo_url || undefined,
  responsavel: r.responsavel || undefined,
  oab: r.oab || undefined,
  uf: r.uf || undefined,
  theme: r.theme || 'light',
  primaryColor: r.primary_color || '#4f46e5',
  backgroundColor: r.background_color || '#ffffff',
  secondaryColor: r.secondary_color || '#f8fafc',
  timezone: r.timezone || 'America/Sao_Paulo',
  itemsPerPage: r.items_per_page || 10,
  menuOrder: Array.isArray(r.menu_order) ? r.menu_order : [],
  emailUser: r.email_user || undefined,
  emailPass: r.email_pass || undefined,
  useExternalSmtp: !!r.use_external_smtp,
  smtpHost: r.smtp_host || undefined,
  smtpPort: r.smtp_port || 465,
  smtpSecure: r.smtp_secure !== false,
  enableEmailNotifications: !!r.enable_email_notifications,
  emailWeeklyReport: !!r.email_weekly_report,
  emailDailyReport: !!r.email_daily_report,
  emailNewNotifications: !!r.email_new_notifications,
  templateWeeklyReport: r.template_weekly_report || undefined,
  templateDailyReport: r.template_daily_report || undefined,
  templateNewNotifications: r.template_new_notifications || undefined,
  emailDispatchTime: r.email_dispatch_time || '08:00',
  showMovimentos: r.show_movimentos !== false,
  diasMorosidade: r.dias_morosidade || 30,
  googleFormsSpreadsheetId: r.google_forms_spreadsheet_id || undefined,
  googleFormsSheetName: r.google_forms_sheet_name || undefined,
  googleClientId: r.google_client_id || undefined,
  appVersion: r.app_version || undefined,
});

const mapUsuarioFromDb = (r: any): Usuario => ({
  id: r.id,
  nome: r.nome,
  email: r.email,
  cargo: r.cargo || '',
  contato: r.contato || '',
  senha: r.senha || undefined,
  oab: r.oab || undefined,
  cpf: r.cpf || '',
  permissao: r.permissao || 'user',
  escritoriosIds: Array.isArray(r.escritorios_ids) ? r.escritorios_ids : [],
  status: r.status || 'Ativo',
  fotoUrl: r.foto_url || undefined,
  theme: r.theme || undefined,
  itemsPerPage: r.items_per_page || undefined,
  menuOrder: Array.isArray(r.menu_order) ? r.menu_order : undefined,
  enableNotifications: r.enable_notifications !== false,
});

const mapProcessoFromDb = (r: any): Processo => ({
  id: r.id,
  numero: r.numero || '',
  clienteId: r.cliente_id || '',
  parteContraria: r.parte_contraria || '',
  tribunal: r.tribunal || '',
  status: r.status || 'Ativo',
  dataDistribuicao: r.data_distribuicao ? new Date(r.data_distribuicao).toISOString() : '',
  escritorioId: r.escritorio_id || undefined,
  idProc: r.id_proc || undefined,
  tipo: r.tipo || undefined,
  titulo: r.titulo || undefined,
  instancia: r.instancia || undefined,
  varaId: r.vara_id || undefined,
  classe: r.classe || undefined,
  assunto: r.assunto || undefined,
  valorCausa: Number(r.valor_causa) || 0,
  resultado: r.resultado || undefined,
  ativo: r.ativo || 'Ativo',
  link: r.link || undefined,
  tags: r.tags || undefined,
  pasta: r.pasta || undefined,
  disponibilizacao: r.disponibilizacao ? new Date(r.disponibilizacao).toISOString() : undefined,
  publicacao: r.publicacao ? new Date(r.publicacao).toISOString() : undefined,
  inicioPrazo: r.inicio_prazo ? new Date(r.inicio_prazo).toISOString() : undefined,
  envolvidosIds: Array.isArray(r.envolvidos_ids) ? r.envolvidos_ids : [],
  tribunalId: r.tribunal_id || undefined,
  forumId: r.forum_id || undefined,
  advogadoId: r.advogado_id || undefined,
  upjId: r.upj_id || undefined,
  servidorId: r.servidor_id || undefined,
});

const mapContatoFromDb = (r: any): Contato => ({
  id: r.id,
  nome: r.nome,
  apelido: r.apelido || undefined,
  statusCivil: r.status_civil || undefined,
  status: r.status || 'Ativo',
  profissao: r.profissao || undefined,
  rg: r.rg || undefined,
  cpfCnpj: r.cpf_cnpj || '',
  endereco: r.endereco || undefined,
  cep: r.cep || undefined,
  municipio: r.municipio || undefined,
  estado: r.estado || undefined,
  telefone: r.telefone || '',
  email: r.email || '',
  tipo: r.tipo || 'Cliente',
  escritorioId: r.escritorio_id || undefined,
  dataCadastro: r.data_cadastro ? new Date(r.data_cadastro).toISOString() : undefined,
  observacoes: r.observacoes || undefined,
  dadosPagamento: r.dados_pagamento || undefined,
});

const mapTarefaFromDb = (r: any): Tarefa => ({
  ID_TAREFA: r.id,
  TITULO: r.titulo,
  DESCRICAO: r.descricao || '',
  STATUS: r.status || 'Pendente',
  PRIORIDADE: r.prioridade || 'Normal',
  DATA_LIMITE: r.data_limite ? new Date(r.data_limite).toISOString() : '',
  RESPONSAVEL_ID: r.responsavel_id || '',
  PROCESSO_ID: r.processo_id || '',
  ID_ESCRITORIO: r.escritorio_id || '',
  DATA_CRIACAO: r.data_criacao ? new Date(r.data_criacao).toISOString() : '',
  PROC_NOME: r.proc_nome || '',
  VARA_ID: r.vara_id || '',
  VARA_NOME: r.vara_nome || '',
  UPJ_NOME: r.upj_nome || '',
  ATRIBUIDO_ID: r.atribuido_id || undefined,
  prazo_tipo: r.prazo_tipo || 'Corridos',
  id: r.id,
  TAREFA: r.titulo,
});

const mapEventoFromDb = (r: any): Evento => ({
  id: r.id,
  titulo: r.titulo,
  data: r.data ? new Date(r.data).toISOString() : '',
  tipo: r.tipo || 'Prazo',
  processoId: r.processo_id || undefined,
  usuarioId: r.usuario_id || undefined,
  observacoes: r.observacoes || undefined,
  concluido: !!r.concluido,
  escritorioId: r.escritorio_id || undefined,
  link: r.link || undefined,
});

const mapMovimentoFromDb = (r: any): Movimento => ({
  id: r.id,
  processoId: r.processo_id,
  data: r.data ? new Date(r.data).toISOString() : '',
  descricao: r.descricao,
  pagina: r.pagina || undefined,
  usuarioId: r.usuario_id || undefined,
  escritorioId: r.escritorio_id || undefined,
});

const mapFinanceiroFromDb = (r: any): Transacao => ({
  id: r.id,
  tipo: r.tipo,
  valor: Number(r.valor) || 0,
  data: r.data ? new Date(r.data).toISOString() : '',
  descricao: r.descricao,
  processoId: r.processo_id || undefined,
  status: r.status || (r.pago ? 'Pago' : 'Pendente'),
  escritorioId: r.escritorio_id || undefined,
  usuarioId: r.usuario_id || undefined,
  observacoes: r.observacoes || undefined,
  categoria: r.categoria || undefined,
  contatoId: r.contato_id || undefined,
  clienteId: r.cliente_id || undefined,
  pago: !!r.pago,
});

const mapDocumentoFromDb = (r: any): Documento => ({
  id: r.id,
  titulo: r.titulo,
  tipo: r.tipo || 'Outro',
  processoId: r.processo_id || undefined,
  dataCriacao: r.data_criacao ? new Date(r.data_criacao).toISOString() : '',
  conteudo: r.conteudo || '',
  escritorioId: r.escritorio_id || undefined,
  url: r.url || undefined,
  dataUpload: r.data_upload ? new Date(r.data_upload).toISOString() : undefined,
});

const mapVaraFromDb = (r: any): Vara => ({
  id: r.id,
  nome: r.nome,
  forum: r.forum || '',
  localizacao: r.localizacao || '',
  telefone: r.telefone || '',
  email: r.email || '',
  balcaoVirtual: r.balcao_virtual || '',
  juiz: r.juiz || '',
  juiz_2: r.juiz_2 || undefined,
  secretaria: r.secretaria || undefined,
  id_servidores: Array.isArray(r.id_servidores) ? r.id_servidores : [],
  escritorioId: r.escritorio_id || undefined,
  idTj: r.id_tj || undefined,
});

const mapJulgadorFromDb = (r: any): Julgador => ({
  id: r.id,
  nome: r.nome,
  cargo: r.cargo || undefined,
  email: r.email || undefined,
  telefone: r.telefone || undefined,
  escritorioId: r.escritorio_id || undefined,
});

const mapServidorFromDb = (r: any): Servidor => ({
  id: r.id,
  nome: r.nome,
  cargo: r.cargo || undefined,
  email: r.email || undefined,
  telefone: r.telefone || undefined,
  escritorioId: r.escritorio_id || undefined,
});

const mapRecursoFromDb = (r: any): Recurso => ({
  id: r.id,
  processoOriginarioId: r.processo_originario_id || '',
  recursoOriginario: r.recurso_originario || undefined,
  classe: r.classe || '',
  assunto: r.assunto || '',
  secao: r.secao || '',
  orgaoJulgadorId: r.orgao_julgador_id || '',
  area: r.area || '',
  relatorId: r.relator_id || '',
  link: r.link || undefined,
  marcador: r.marcador || undefined,
  resultado: r.resultado || undefined,
  status: r.status || 'Ativo',
  escritorioId: r.escritorio_id || '',
  envolvidosIds: Array.isArray(r.envolvidos_ids) ? r.envolvidos_ids : [],
});

const mapUpjFromDb = (r: any): UPJ => ({
  id: r.id,
  nome: r.nome,
  email: r.email || '',
  email1: r.email1 || undefined,
  whatsapp: r.whatsapp || undefined,
  telefone: r.telefone || undefined,
  diretor: r.diretor || '',
  balcao: r.balcao || undefined,
  localizacao: r.localizacao || '',
  escritorioId: r.escritorio_id || undefined,
});

const mapForumFromDb = (r: any): Forum => ({
  id: r.id,
  nome: r.nome,
  endereco: r.endereco || '',
  tribunalId: r.tribunal_id || '',
  escritorioId: r.escritorio_id || undefined,
});

const mapTribunalFromDb = (r: any): Tribunal => ({
  id: r.id,
  sigla: r.sigla,
  nome: r.nome,
});

const mapEnvolvidoFromDb = (r: any): Envolvido => ({
  id: r.id,
  contatoId: r.contato_id || '',
  processoId: r.processo_id || undefined,
  recursoId: r.recurso_id || undefined,
  tipoEnvolvimento: r.tipo_envolvimento || '',
  escritorioId: r.escritorio_id || '',
});

const mapModeloFromDb = (r: any): Modelo => ({
  id: r.id,
  escritorioId: r.escritorio_id || '',
  nome: r.nome,
  fase: r.fase || '',
  materia: r.materia || '',
  link: r.link || '',
});

const mapEtiquetaFromDb = (r: any): Etiqueta => ({
  id: r.id,
  nome: r.nome,
  cor: r.cor || undefined,
  escritorioId: r.escritorio_id || '',
});

const mapCalendarioFromDb = (r: any): Calendario => ({
  id: r.id,
  tj: r.tj,
  data: r.data ? new Date(r.data).toISOString() : '',
  descricao: r.descricao,
  escritorioId: r.escritorio_id || undefined,
});

const mapLeadFromDb = (r: any): Lead => ({
  id: r.id,
  numero: r.numero || '',
  classe: r.classe || '',
  tribunal: r.tribunal || '',
  orgao: r.orgao || '',
  partes: r.partes || '',
  advogados: r.advogados || '',
  disponibilizacao: r.disponibilizacao ? new Date(r.disponibilizacao).toISOString() : '',
  publicacao: r.publicacao ? new Date(r.publicacao).toISOString() : '',
  dataCadastro: r.data_cadastro ? new Date(r.data_cadastro).toISOString() : '',
  status: r.status || 'Novo',
  escritorioId: r.escritorio_id || undefined,
  resumo: r.resumo || undefined,
  prioridade: r.prioridade || 'Média',
});

const mapLeadStatusFromDb = (r: any): LeadStatus => ({
  id: r.id,
  nome: r.nome,
  cor: r.cor || '#3B82F6',
  escritorioId: r.escritorio_id || undefined,
});

const mapLogFromDb = (r: any): LogRegistro => ({
  id: r.id,
  data: r.data ? new Date(r.data).toLocaleString('pt-BR') : '',
  usuario: r.usuario || '',
  acao: r.acao || '',
  idEscritorio: r.id_escritorio || '',
  detalhes: r.detalhes || '',
});

const mapSettingsFromDb = (r: any): AppSettings => ({
  spreadsheetId: (import.meta as any).env.VITE_SPREADSHEET_ID || '',
  scriptUrl: (import.meta as any).env.VITE_SCRIPT_URL || '',
  timezone: r.timezone || 'America/Sao_Paulo',
  itemsPerPage: r.items_per_page || 10,
  permissions: r.permissions || '[]',
  emailUser: r.email_user || undefined,
  emailPass: r.email_pass || undefined,
  useExternalSmtp: !!r.use_external_smtp,
  smtpHost: r.smtp_host || undefined,
  smtpPort: r.smtp_port || 465,
  smtpSecure: r.smtp_secure !== false,
  enableEmailNotifications: !!r.enable_email_notifications,
  emailWeeklyReport: !!r.email_weekly_report,
  emailDailyReport: !!r.email_daily_report,
  emailNewNotifications: !!r.email_new_notifications,
  templateWeeklyReport: r.template_weekly_report || undefined,
  templateDailyReport: r.template_daily_report || undefined,
  templateNewNotifications: r.template_new_notifications || undefined,
  showMovimentos: r.show_movimentos !== false,
  diasMorosidade: r.dias_morosidade || 30,
  menuOrder: Array.isArray(r.menu_order) ? r.menu_order : [],
  emailDispatchTime: r.email_dispatch_time || '08:00',
  googleClientId: r.google_client_id || undefined,
  idEscritorio: r.id_escritorio || undefined,
  appVersion: r.app_version || undefined,
  theme: r.theme || 'light',
});

// ==============================================================================
// OPERAÇÕES ATÔMICAS DE ESCRITA NO SUPABASE (UPSERT / DELETE)
// ==============================================================================

export const upsertProcessoSupabase = async (p: Processo): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('processos').upsert({
    id: p.id,
    numero: p.numero,
    cliente_id: p.clienteId || null,
    parte_contraria: p.parteContraria || null,
    tribunal: p.tribunal || null,
    status: p.status || p.ativo || 'Ativo',
    data_distribuicao: p.dataDistribuicao ? new Date(p.dataDistribuicao).toISOString() : null,
    escritorio_id: p.escritorioId || null,
    id_proc: p.idProc || null,
    tipo: p.tipo || null,
    titulo: p.titulo || null,
    instancia: p.instancia || null,
    vara_id: p.varaId || null,
    classe: p.classe || null,
    assunto: p.assunto || null,
    valor_causa: Number(p.valorCausa) || 0,
    resultado: p.resultado || null,
    ativo: p.ativo || 'Ativo',
    link: p.link || null,
    tags: p.tags || null,
    pasta: p.pasta || null,
    disponibilizacao: p.disponibilizacao ? new Date(p.disponibilizacao).toISOString() : null,
    publicacao: p.publicacao ? new Date(p.publicacao).toISOString() : null,
    inicio_prazo: p.inicioPrazo ? new Date(p.inicioPrazo).toISOString() : null,
    envolvidos_ids: p.envolvidosIds || [],
    tribunal_id: p.tribunalId || null,
    forum_id: p.forumId || null,
    advogado_id: p.advogadoId || null,
    upj_id: p.upjId || null,
    servidor_id: p.servidorId || null,
  }, { onConflict: 'id' });

  if (error) console.error('[Supabase] Erro ao salvar processo:', error);
  return !error;
};

export const deleteProcessoSupabase = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('processos').delete().eq('id', id);
  if (error) console.error('[Supabase] Erro ao excluir processo:', error);
  return !error;
};

export const upsertContatoSupabase = async (c: Contato): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('contatos').upsert({
    id: c.id,
    nome: c.nome,
    apelido: c.apelido || null,
    status_civil: c.statusCivil || null,
    status: c.status || 'Ativo',
    profissao: c.profissao || null,
    rg: c.rg || null,
    cpf_cnpj: c.cpfCnpj || null,
    endereco: c.endereco || null,
    cep: c.cep || null,
    municipio: c.municipio || null,
    estado: c.estado || null,
    telefone: c.telefone || null,
    email: c.email || null,
    tipo: c.tipo || 'Cliente',
    escritorio_id: c.escritorioId || null,
    data_cadastro: c.dataCadastro ? new Date(c.dataCadastro).toISOString() : new Date().toISOString(),
    observacoes: c.observacoes || null,
    dados_pagamento: c.dadosPagamento || null,
  }, { onConflict: 'id' });

  if (error) console.error('[Supabase] Erro ao salvar contato:', error);
  return !error;
};

export const deleteContatoSupabase = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('contatos').delete().eq('id', id);
  if (error) console.error('[Supabase] Erro ao excluir contato:', error);
  return !error;
};

export const upsertTarefaSupabase = async (t: Tarefa): Promise<boolean> => {
  const supabase = getSupabase();
  const id = String(t.ID_TAREFA || (t as any).id || '');
  const { error } = await supabase.from('tarefas').upsert({
    id,
    titulo: String(t.TITULO || t.TAREFA || ''),
    descricao: String(t.DESCRICAO || ''),
    status: String(t.STATUS || 'Pendente'),
    prioridade: String(t.PRIORIDADE || 'Normal'),
    data_limite: t.DATA_LIMITE || t.PRAZO_FIM ? new Date(t.DATA_LIMITE || t.PRAZO_FIM!).toISOString() : null,
    responsavel_id: String(t.RESPONSAVEL_ID || t.ID_USER || '') || null,
    processo_id: String(t.PROCESSO_ID || t.ID_PROC || '') || null,
    escritorio_id: String(t.ID_ESCRITORIO || '') || null,
    data_criacao: t.DATA_CRIACAO ? new Date(t.DATA_CRIACAO).toISOString() : new Date().toISOString(),
    proc_nome: String(t.PROC_NOME || t['PROC.NOME'] || '') || null,
    vara_id: String(t.VARA_ID || t.ID_VARA || '') || null,
    vara_nome: String(t.VARA_NOME || t['VARA.NOME'] || '') || null,
    upj_nome: String(t.UPJ_NOME || '') || null,
    atribuido_id: String(t.ATRIBUIDO_ID || '') || null,
    prazo_tipo: String(t.prazo_tipo || 'Corridos'),
  }, { onConflict: 'id' });

  if (error) console.error('[Supabase] Erro ao salvar tarefa:', error);
  return !error;
};

export const deleteTarefaSupabase = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('tarefas').delete().eq('id', id);
  if (error) console.error('[Supabase] Erro ao excluir tarefa:', error);
  return !error;
};

export const upsertEventoSupabase = async (e: Evento): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('eventos').upsert({
    id: e.id,
    titulo: e.titulo,
    data: e.data ? new Date(e.data).toISOString() : new Date().toISOString(),
    tipo: e.tipo || 'Prazo',
    processo_id: e.processoId || null,
    usuario_id: e.usuarioId || null,
    observacoes: e.observacoes || null,
    concluido: !!e.concluido,
    escritorio_id: e.escritorioId || null,
    link: e.link || null,
  }, { onConflict: 'id' });

  if (error) console.error('[Supabase] Erro ao salvar evento:', error);
  return !error;
};

export const deleteEventoSupabase = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('eventos').delete().eq('id', id);
  if (error) console.error('[Supabase] Erro ao excluir evento:', error);
  return !error;
};

export const upsertFinanceiroSupabase = async (f: Transacao): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('financeiro').upsert({
    id: f.id,
    tipo: f.tipo,
    valor: Number(f.valor) || 0,
    data: f.data ? new Date(f.data).toISOString() : new Date().toISOString(),
    descricao: f.descricao,
    processo_id: f.processoId || null,
    status: f.status || (f.pago ? 'Pago' : 'Pendente'),
    escritorio_id: f.escritorioId || null,
    usuario_id: f.usuarioId || null,
    observacoes: f.observacoes || null,
    categoria: f.categoria || null,
    contato_id: f.contatoId || f.clienteId || null,
    cliente_id: f.clienteId || null,
    pago: !!f.pago,
  }, { onConflict: 'id' });

  if (error) console.error('[Supabase] Erro ao salvar transação financeira:', error);
  return !error;
};

export const deleteFinanceiroSupabase = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('financeiro').delete().eq('id', id);
  if (error) console.error('[Supabase] Erro ao excluir transação financeira:', error);
  return !error;
};

export const upsertMovimentoSupabase = async (m: Movimento): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('movimentos').upsert({
    id: m.id,
    processo_id: m.processoId,
    data: m.data ? new Date(m.data).toISOString() : new Date().toISOString(),
    descricao: m.descricao,
    pagina: m.pagina || null,
    usuario_id: m.usuarioId || null,
    escritorio_id: m.escritorioId || null,
  }, { onConflict: 'id' });

  if (error) console.error('[Supabase] Erro ao salvar movimento:', error);
  return !error;
};

export const deleteMovimentoSupabase = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from('movimentos').delete().eq('id', id);
  if (error) console.error('[Supabase] Erro ao excluir movimento:', error);
  return !error;
};

export const upsertItemGenericSupabase = async (table: string, data: any): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from(table).upsert(data, { onConflict: 'id' });
  if (error) console.error(`[Supabase] Erro ao salvar em ${table}:`, error);
  return !error;
};

export const deleteItemGenericSupabase = async (table: string, id: string): Promise<boolean> => {
  const supabase = getSupabase();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) console.error(`[Supabase] Erro ao excluir de ${table}:`, error);
  return !error;
};

export const saveLogSupabase = async (log: LogRegistro): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getSupabase();
    await supabase.from('logs').insert({
      id: log.id,
      data: new Date().toISOString(),
      usuario: log.usuario,
      acao: log.acao,
      id_escritorio: log.idEscritorio,
      detalhes: log.detalhes,
    });
  } catch (err) {
    console.error('[Supabase] Erro ao registrar log:', err);
  }
};
