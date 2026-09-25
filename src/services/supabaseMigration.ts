import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState } from '../types';

export interface MigrationProgress {
  currentTable: string;
  tableIndex: number;
  totalTables: number;
  migratedRecords: number;
  totalRecordsForTable: number;
  percentage: number;
  status: 'idle' | 'running' | 'success' | 'error';
  logs: Array<{ timestamp: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>;
}

/**
 * Script DDL completo em PostgreSQL pronto para rodar no SQL Editor do Supabase
 */
export const SUPABASE_SCHEMA_SQL = `-- ==============================================================================
-- SCHEMA SUPABASE PARA O SISTEMA DE GESTÃO JURÍDICA
-- Cole e execute este script no "SQL Editor" do seu projeto no Supabase
-- ==============================================================================

-- 1. ESCRITORIOS
CREATE TABLE IF NOT EXISTS public.escritorios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  logo_url TEXT,
  responsavel TEXT,
  oab TEXT,
  uf TEXT,
  theme TEXT DEFAULT 'light',
  primary_color TEXT DEFAULT '#4f46e5',
  background_color TEXT DEFAULT '#ffffff',
  secondary_color TEXT DEFAULT '#f8fafc',
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  items_per_page INTEGER DEFAULT 10,
  menu_order JSONB DEFAULT '[]'::jsonb,
  email_user TEXT,
  email_pass TEXT,
  use_external_smtp BOOLEAN DEFAULT FALSE,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 465,
  smtp_secure BOOLEAN DEFAULT TRUE,
  enable_email_notifications BOOLEAN DEFAULT FALSE,
  email_weekly_report BOOLEAN DEFAULT FALSE,
  email_daily_report BOOLEAN DEFAULT FALSE,
  email_new_notifications BOOLEAN DEFAULT FALSE,
  template_weekly_report TEXT,
  template_daily_report TEXT,
  template_new_notifications TEXT,
  email_dispatch_time TEXT DEFAULT '08:00',
  show_movimentos BOOLEAN DEFAULT TRUE,
  dias_morosidade INTEGER DEFAULT 30,
  google_forms_spreadsheet_id TEXT,
  google_forms_sheet_name TEXT,
  google_client_id TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USUARIOS
CREATE TABLE IF NOT EXISTS public.usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  cargo TEXT,
  contato TEXT,
  senha TEXT,
  oab TEXT,
  cpf TEXT,
  permissao TEXT DEFAULT 'user',
  escritorios_ids JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Ativo',
  foto_url TEXT,
  theme TEXT,
  items_per_page INTEGER,
  menu_order JSONB,
  enable_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRIBUNAIS
CREATE TABLE IF NOT EXISTS public.tribunais (
  id TEXT PRIMARY KEY,
  sigla TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FORUMS
CREATE TABLE IF NOT EXISTS public.forums (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  endereco TEXT,
  tribunal_id TEXT,
  escritorio_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. UPJ (Unidades de Processamento Judicial)
CREATE TABLE IF NOT EXISTS public.upj (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  email1 TEXT,
  whatsapp TEXT,
  telefone TEXT,
  diretor TEXT,
  balcao TEXT,
  localizacao TEXT,
  escritorio_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. VARAS
CREATE TABLE IF NOT EXISTS public.varas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  forum TEXT,
  localizacao TEXT,
  telefone TEXT,
  email TEXT,
  balcao_virtual TEXT,
  juiz TEXT,
  juiz_2 TEXT,
  secretaria TEXT,
  id_servidores JSONB DEFAULT '[]'::jsonb,
  escritorio_id TEXT,
  id_tj TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. JULGADORES
CREATE TABLE IF NOT EXISTS public.julgadores (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cargo TEXT,
  email TEXT,
  telefone TEXT,
  escritorio_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SERVIDORES
CREATE TABLE IF NOT EXISTS public.servidores (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cargo TEXT,
  email TEXT,
  telefone TEXT,
  escritorio_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CONTATOS
CREATE TABLE IF NOT EXISTS public.contatos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  apelido TEXT,
  status_civil TEXT,
  status TEXT DEFAULT 'Ativo',
  profissao TEXT,
  rg TEXT,
  cpf_cnpj TEXT,
  endereco TEXT,
  cep TEXT,
  municipio TEXT,
  estado TEXT,
  telefone TEXT,
  email TEXT,
  tipo TEXT DEFAULT 'Cliente',
  escritorio_id TEXT,
  data_cadastro TIMESTAMPTZ DEFAULT NOW(),
  observacoes TEXT,
  dados_pagamento TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. PROCESSOS
CREATE TABLE IF NOT EXISTS public.processos (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  cliente_id TEXT,
  parte_contraria TEXT,
  tribunal TEXT,
  status TEXT DEFAULT 'Ativo',
  data_distribuicao TIMESTAMPTZ,
  escritorio_id TEXT,
  id_proc TEXT,
  tipo TEXT,
  titulo TEXT,
  instancia TEXT,
  vara_id TEXT,
  classe TEXT,
  assunto TEXT,
  valor_causa NUMERIC(15,2) DEFAULT 0,
  resultado TEXT,
  ativo TEXT DEFAULT 'Ativo',
  link TEXT,
  tags TEXT,
  pasta TEXT,
  disponibilizacao TIMESTAMPTZ,
  publicacao TIMESTAMPTZ,
  inicio_prazo TIMESTAMPTZ,
  envolvidos_ids JSONB DEFAULT '[]'::jsonb,
  tribunal_id TEXT,
  forum_id TEXT,
  advogado_id TEXT,
  upj_id TEXT,
  servidor_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ENVOLVIDOS
CREATE TABLE IF NOT EXISTS public.envolvidos (
  id TEXT PRIMARY KEY,
  contato_id TEXT,
  processo_id TEXT,
  recurso_id TEXT,
  tipo_envolvimento TEXT,
  escritorio_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. RECURSOS
CREATE TABLE IF NOT EXISTS public.recursos (
  id TEXT PRIMARY KEY,
  processo_originario_id TEXT,
  recurso_originario TEXT,
  classe TEXT,
  assunto TEXT,
  secao TEXT,
  orgao_julgador_id TEXT,
  area TEXT,
  relator_id TEXT,
  link TEXT,
  marcador TEXT,
  resultado TEXT,
  status TEXT DEFAULT 'Ativo',
  escritorio_id TEXT,
  envolvidos_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. EVENTOS / AUDIÊNCIAS / PRAZOS
CREATE TABLE IF NOT EXISTS public.eventos (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  data TIMESTAMPTZ NOT NULL,
  tipo TEXT NOT NULL,
  processo_id TEXT,
  usuario_id TEXT,
  observacoes TEXT,
  concluido BOOLEAN DEFAULT FALSE,
  escritorio_id TEXT,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. MOVIMENTOS PROCESSUAIS
CREATE TABLE IF NOT EXISTS public.movimentos (
  id TEXT PRIMARY KEY,
  processo_id TEXT NOT NULL,
  data TIMESTAMPTZ,
  descricao TEXT NOT NULL,
  pagina TEXT,
  usuario_id TEXT,
  escritorio_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. TAREFAS
CREATE TABLE IF NOT EXISTS public.tarefas (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT DEFAULT 'Pendente',
  prioridade TEXT DEFAULT 'Normal',
  data_limite TIMESTAMPTZ,
  responsavel_id TEXT,
  processo_id TEXT,
  escritorio_id TEXT,
  data_criacao TIMESTAMPTZ DEFAULT NOW(),
  proc_nome TEXT,
  vara_id TEXT,
  vara_nome TEXT,
  upj_nome TEXT,
  atribuido_id TEXT,
  prazo_tipo TEXT DEFAULT 'Corridos',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. FINANCEIRO
CREATE TABLE IF NOT EXISTS public.financeiro (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL DEFAULT 0,
  data TIMESTAMPTZ NOT NULL,
  descricao TEXT NOT NULL,
  processo_id TEXT,
  status TEXT DEFAULT 'Pendente',
  escritorio_id TEXT,
  usuario_id TEXT,
  observacoes TEXT,
  categoria TEXT,
  contato_id TEXT,
  cliente_id TEXT,
  pago BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.documentos (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  tipo TEXT,
  processo_id TEXT,
  data_criacao TIMESTAMPTZ DEFAULT NOW(),
  conteudo TEXT,
  escritorio_id TEXT,
  url TEXT,
  data_upload TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. MODELOS DE DOCUMENTO
CREATE TABLE IF NOT EXISTS public.modelos (
  id TEXT PRIMARY KEY,
  escritorio_id TEXT,
  nome TEXT NOT NULL,
  fase TEXT,
  materia TEXT,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. ETIQUETAS
CREATE TABLE IF NOT EXISTS public.etiquetas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cor TEXT,
  escritorio_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. CALENDARIO JUDICIAL (FERIADOS / SUSPENSÕES)
CREATE TABLE IF NOT EXISTS public.calendario (
  id TEXT PRIMARY KEY,
  tj TEXT NOT NULL,
  data TIMESTAMPTZ NOT NULL,
  descricao TEXT NOT NULL,
  escritorio_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. LEADS STATUS
CREATE TABLE IF NOT EXISTS public.leads_status (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cor TEXT,
  escritorio_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. LEADS
CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT PRIMARY KEY,
  numero TEXT,
  classe TEXT,
  tribunal TEXT,
  orgao TEXT,
  partes TEXT,
  advogados TEXT,
  disponibilizacao TIMESTAMPTZ,
  publicacao TIMESTAMPTZ,
  data_cadastro TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'Novo',
  escritorio_id TEXT,
  resumo TEXT,
  prioridade TEXT DEFAULT 'Média',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. LOGS DO SISTEMA
CREATE TABLE IF NOT EXISTS public.logs (
  id TEXT PRIMARY KEY,
  data TIMESTAMPTZ DEFAULT NOW(),
  usuario TEXT,
  acao TEXT,
  id_escritorio TEXT,
  detalhes TEXT
);

-- 24. CONFIGURAÇÕES GLOBAIS
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY,
  id_escritorio TEXT,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  items_per_page INTEGER DEFAULT 10,
  permissions JSONB DEFAULT '[]'::jsonb,
  email_user TEXT,
  email_pass TEXT,
  use_external_smtp BOOLEAN DEFAULT FALSE,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 465,
  smtp_secure BOOLEAN DEFAULT TRUE,
  enable_email_notifications BOOLEAN DEFAULT FALSE,
  email_weekly_report BOOLEAN DEFAULT FALSE,
  email_daily_report BOOLEAN DEFAULT FALSE,
  email_new_notifications BOOLEAN DEFAULT FALSE,
  template_weekly_report TEXT,
  template_daily_report TEXT,
  template_new_notifications TEXT,
  show_movimentos BOOLEAN DEFAULT TRUE,
  dias_morosidade INTEGER DEFAULT 30,
  menu_order JSONB DEFAULT '[]'::jsonb,
  email_dispatch_time TEXT DEFAULT '08:00',
  google_client_id TEXT,
  app_version TEXT,
  theme TEXT DEFAULT 'light',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HABILITAR RLS (ROW LEVEL SECURITY) - Inicialmente permissivo para facilitar migração
ALTER TABLE public.escritorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para início (podem ser restringidas com Supabase Auth depois):
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Escritorios') THEN
    CREATE POLICY "Public Access Escritorios" ON public.escritorios FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Usuarios') THEN
    CREATE POLICY "Public Access Usuarios" ON public.usuarios FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Processos') THEN
    CREATE POLICY "Public Access Processos" ON public.processos FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Contatos') THEN
    CREATE POLICY "Public Access Contatos" ON public.contatos FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Tarefas') THEN
    CREATE POLICY "Public Access Tarefas" ON public.tarefas FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Eventos') THEN
    CREATE POLICY "Public Access Eventos" ON public.eventos FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Financeiro') THEN
    CREATE POLICY "Public Access Financeiro" ON public.financeiro FOR ALL USING (true);
  END IF;
END $$;
`;

/**
 * Cria ou retorna um cliente Supabase
 */
export const getSupabaseClient = (url: string, key: string): SupabaseClient => {
  return createClient(url.trim(), key.trim(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

/**
 * Testa a conexão com o Supabase verificando se a URL e a Chave respondem
 */
export const testSupabaseConnection = async (url: string, key: string): Promise<{ success: boolean; message: string }> => {
  if (!url || !key) {
    return { success: false, message: 'URL e Chave do Supabase são obrigatórias.' };
  }

  try {
    const supabase = getSupabaseClient(url, key);
    // Tenta uma consulta simples
    const { error } = await supabase.from('escritorios').select('count', { count: 'exact', head: true });
    
    if (error) {
      if (error.code === '42P01') {
        // Tabela não existe ainda, mas a conexão com o banco funcionou!
        return { 
          success: true, 
          message: 'Conectado com sucesso ao Supabase! (As tabelas ainda não foram criadas. Execute o SQL de Schema primeiro).' 
        };
      }
      return { success: false, message: `Erro ao conectar: ${error.message} (${error.code || 'Sem código'})` };
    }

    return { success: true, message: 'Conexão com o Supabase estabelecida com sucesso! Tabelas acessíveis.' };
  } catch (err: any) {
    return { success: false, message: `Falha na requisição: ${err?.message || String(err)}` };
  }
};

/**
 * Normaliza valor para gravação em coluna de data/timestamp no PostgreSQL
 */
const toIsoDate = (val?: string | null): string | null => {
  if (!val || val.trim() === '') return null;
  try {
    const clean = val.trim();
    // Se estiver em formato brasileiro dd/mm/aaaa
    if (/^\d{2}\/\d{2}\/\d{4}/.test(clean)) {
      const parts = clean.split(' ');
      const dateParts = parts[0].split('/');
      const timePart = parts[1] || '12:00:00';
      return `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${timePart}Z`;
    }
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
};

/**
 * Envia lotes de registros para uma tabela no Supabase
 */
async function batchUpsert(
  supabase: SupabaseClient,
  table: string,
  records: any[],
  batchSize = 100
): Promise<{ inserted: number; errors: string[] }> {
  if (!records || records.length === 0) return { inserted: 0, errors: [] };

  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });

    if (error) {
      errors.push(`Lote ${i / batchSize + 1} em "${table}": ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  return { inserted, errors };
}

/**
 * Executa a migração completa de todos os dados do AppState (Google Sheets) para o Supabase
 */
export const migrateAllDataToSupabase = async (
  appState: AppState,
  supabaseUrl: string,
  supabaseKey: string,
  onProgress?: (progress: MigrationProgress) => void
): Promise<{ success: boolean; totalRecords: number; errors: string[] }> => {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  const allErrors: string[] = [];
  let totalRecordsCount = 0;

  const logs: MigrationProgress['logs'] = [];
  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const logItem = { timestamp: new Date().toLocaleTimeString(), message, type };
    logs.push(logItem);
  };

  const tablesToMigrate: Array<{
    name: string;
    label: string;
    getData: () => any[];
  }> = [
    {
      name: 'escritorios',
      label: 'Escritórios',
      getData: () => (appState.escritorios || []).map(e => ({
        id: e.id,
        nome: e.nome,
        cnpj: e.cnpj || null,
        endereco: e.endereco || null,
        telefone: e.telefone || null,
        email: e.email || null,
        logo_url: e.logoUrl || null,
        responsavel: e.responsavel || null,
        oab: e.oab || null,
        uf: e.uf || null,
        theme: e.theme || 'light',
        primary_color: e.primaryColor || '#4f46e5',
        background_color: e.backgroundColor || '#ffffff',
        secondary_color: e.secondaryColor || '#f8fafc',
        timezone: e.timezone || 'America/Sao_Paulo',
        items_per_page: Number(e.itemsPerPage) || 10,
        menu_order: e.menuOrder || [],
        email_user: e.emailUser || null,
        email_pass: e.emailPass || null,
        use_external_smtp: !!e.useExternalSmtp,
        smtp_host: e.smtpHost || null,
        smtp_port: Number(e.smtpPort) || 465,
        smtp_secure: e.smtpSecure !== false,
        enable_email_notifications: !!e.enableEmailNotifications,
        email_weekly_report: !!e.emailWeeklyReport,
        email_daily_report: !!e.emailDailyReport,
        email_new_notifications: !!e.emailNewNotifications,
        template_weekly_report: e.templateWeeklyReport || null,
        template_daily_report: e.templateDailyReport || null,
        template_new_notifications: e.templateNewNotifications || null,
        email_dispatch_time: e.emailDispatchTime || '08:00',
        show_movimentos: e.showMovimentos !== false,
        dias_morosidade: Number(e.diasMorosidade) || 30,
        google_forms_spreadsheet_id: e.googleFormsSpreadsheetId || null,
        google_forms_sheet_name: e.googleFormsSheetName || null,
        google_client_id: e.googleClientId || null,
        app_version: e.appVersion || null,
      }))
    },
    {
      name: 'usuarios',
      label: 'Usuários',
      getData: () => (appState.usuarios || []).map(u => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        cargo: u.cargo || null,
        contato: u.contato || null,
        senha: u.senha || null,
        oab: u.oab || null,
        cpf: u.cpf || null,
        permissao: u.permissao || 'user',
        escritorios_ids: u.escritoriosIds || [],
        status: u.status || 'Ativo',
        foto_url: u.fotoUrl || null,
        theme: u.theme || null,
        items_per_page: u.itemsPerPage ? Number(u.itemsPerPage) : null,
        menu_order: u.menuOrder || null,
        enable_notifications: u.enableNotifications !== false,
      }))
    },
    {
      name: 'tribunais',
      label: 'Tribunais',
      getData: () => (appState.tribunais || []).map(t => ({
        id: t.id,
        sigla: t.sigla,
        nome: t.nome,
      }))
    },
    {
      name: 'forums',
      label: 'Fóruns',
      getData: () => (appState.forums || []).map(f => ({
        id: f.id,
        nome: f.nome,
        endereco: f.endereco || null,
        tribunal_id: f.tribunalId || null,
        escritorio_id: f.escritorioId || null,
      }))
    },
    {
      name: 'upj',
      label: 'UPJs',
      getData: () => (appState.upj || []).map(u => ({
        id: u.id,
        nome: u.nome,
        email: u.email || null,
        email1: u.email1 || null,
        whatsapp: u.whatsapp || null,
        telefone: u.telefone || null,
        diretor: u.diretor || null,
        balcao: u.balcao || null,
        localizacao: u.localizacao || null,
        escritorio_id: u.escritorioId || null,
      }))
    },
    {
      name: 'varas',
      label: 'Varas',
      getData: () => (appState.varas || []).map(v => ({
        id: v.id,
        nome: v.nome,
        forum: v.forum || null,
        localizacao: v.localizacao || null,
        telefone: v.telefone || null,
        email: v.email || null,
        balcao_virtual: v.balcaoVirtual || null,
        juiz: v.juiz || null,
        juiz_2: v.juiz_2 || null,
        secretaria: v.secretaria || null,
        id_servidores: v.id_servidores || [],
        escritorio_id: v.escritorioId || null,
        id_tj: v.idTj || null,
      }))
    },
    {
      name: 'julgadores',
      label: 'Julgadores',
      getData: () => (appState.julgadores || []).map(j => ({
        id: j.id,
        nome: j.nome,
        cargo: j.cargo || null,
        email: j.email || null,
        telefone: j.telefone || null,
        escritorio_id: j.escritorioId || null,
      }))
    },
    {
      name: 'servidores',
      label: 'Servidores',
      getData: () => (appState.servidores || []).map(s => ({
        id: s.id,
        nome: s.nome,
        cargo: s.cargo || null,
        email: s.email || null,
        telefone: s.telefone || null,
        escritorio_id: s.escritorioId || null,
      }))
    },
    {
      name: 'contatos',
      label: 'Contatos e Clientes',
      getData: () => (appState.contatos || []).map(c => ({
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
        data_cadastro: toIsoDate(c.dataCadastro),
        observacoes: c.observacoes || null,
        dados_pagamento: c.dadosPagamento || null,
      }))
    },
    {
      name: 'processos',
      label: 'Processos',
      getData: () => (appState.processos || []).map(p => ({
        id: p.id,
        numero: p.numero || '',
        cliente_id: p.clienteId || null,
        parte_contraria: p.parteContraria || null,
        tribunal: p.tribunal || null,
        status: p.status || p.ativo || 'Ativo',
        data_distribuicao: toIsoDate(p.dataDistribuicao),
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
        disponibilizacao: toIsoDate(p.disponibilizacao),
        publicacao: toIsoDate(p.publicacao),
        inicio_prazo: toIsoDate(p.inicioPrazo),
        envolvidos_ids: p.envolvidosIds || [],
        tribunal_id: p.tribunalId || null,
        forum_id: p.forumId || null,
        advogado_id: p.advogadoId || null,
        upj_id: p.upjId || null,
        servidor_id: p.servidorId || null,
      }))
    },
    {
      name: 'envolvidos',
      label: 'Envolvidos no Processo',
      getData: () => (appState.envolvidos || []).map(e => ({
        id: e.id,
        contato_id: e.contatoId || null,
        processo_id: e.processoId || null,
        recurso_id: e.recursoId || null,
        tipo_envolvimento: e.tipoEnvolvimento || null,
        escritorio_id: e.escritorioId || null,
      }))
    },
    {
      name: 'recursos',
      label: 'Recursos',
      getData: () => (appState.recursos || []).map(r => ({
        id: r.id,
        processo_originario_id: r.processoOriginarioId || null,
        recurso_originario: r.recursoOriginario || null,
        classe: r.classe || null,
        assunto: r.assunto || null,
        secao: r.secao || null,
        orgao_julgador_id: r.orgaoJulgadorId || null,
        area: r.area || null,
        relator_id: r.relatorId || null,
        link: r.link || null,
        marcador: r.marcador || null,
        resultado: r.resultado || null,
        status: r.status || 'Ativo',
        escritorio_id: r.escritorioId || null,
        envolvidos_ids: r.envolvidosIds || [],
      }))
    },
    {
      name: 'eventos',
      label: 'Eventos e Prazos',
      getData: () => (appState.eventos || []).map(e => ({
        id: e.id,
        titulo: e.titulo,
        data: toIsoDate(e.data) || new Date().toISOString(),
        tipo: e.tipo || 'Prazo',
        processo_id: e.processoId || null,
        usuario_id: e.usuarioId || null,
        observacoes: e.observacoes || null,
        concluido: !!e.concluido,
        escritorio_id: e.escritorioId || null,
        link: e.link || null,
      }))
    },
    {
      name: 'movimentos',
      label: 'Movimentações Processuais',
      getData: () => (appState.movimentos || []).map(m => ({
        id: m.id,
        processo_id: m.processoId,
        data: toIsoDate(m.data),
        descricao: m.descricao,
        pagina: m.pagina || null,
        usuario_id: m.usuarioId || null,
        escritorio_id: m.escritorioId || null,
      }))
    },
    {
      name: 'tarefas',
      label: 'Tarefas',
      getData: () => (appState.tarefas || []).map(t => {
        const id = String(t.ID_TAREFA || (t as any).id || `tar_${Math.random().toString(36).substring(2, 9)}`);
        return {
          id,
          titulo: String(t.TITULO || t.TAREFA || 'Sem título'),
          descricao: String(t.DESCRICAO || ''),
          status: String(t.STATUS || 'Pendente'),
          prioridade: String(t.PRIORIDADE || 'Normal'),
          data_limite: toIsoDate(t.DATA_LIMITE || t.PRAZO_FIM),
          responsavel_id: String(t.RESPONSAVEL_ID || t.ID_USER || '') || null,
          processo_id: String(t.PROCESSO_ID || t.ID_PROC || '') || null,
          escritorio_id: String(t.ID_ESCRITORIO || '') || null,
          data_criacao: toIsoDate(t.DATA_CRIACAO || t.PRAZO_IN) || new Date().toISOString(),
          proc_nome: String(t.PROC_NOME || t['PROC.NOME'] || '') || null,
          vara_id: String(t.VARA_ID || t.ID_VARA || '') || null,
          vara_nome: String(t.VARA_NOME || t['VARA.NOME'] || '') || null,
          upj_nome: String(t.UPJ_NOME || '') || null,
          atribuido_id: String(t.ATRIBUIDO_ID || '') || null,
          prazo_tipo: String(t.prazo_tipo || 'Corridos'),
        };
      })
    },
    {
      name: 'financeiro',
      label: 'Lançamentos Financeiros',
      getData: () => (appState.financeiro || []).map(f => ({
        id: f.id,
        tipo: f.tipo,
        valor: Number(f.valor) || 0,
        data: toIsoDate(f.data) || new Date().toISOString(),
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
      }))
    },
    {
      name: 'documentos',
      label: 'Documentos e Peças',
      getData: () => (appState.documentos || []).map(d => ({
        id: d.id,
        titulo: d.titulo,
        tipo: d.tipo || null,
        processo_id: d.processoId || null,
        data_criacao: toIsoDate(d.dataCriacao) || new Date().toISOString(),
        conteudo: d.conteudo || null,
        escritorio_id: d.escritorioId || null,
        url: d.url || null,
        data_upload: toIsoDate(d.dataUpload),
      }))
    },
    {
      name: 'modelos',
      label: 'Modelos de Peças',
      getData: () => (appState.modelos || []).map(m => ({
        id: m.id,
        escritorio_id: m.escritorioId || null,
        nome: m.nome,
        fase: m.fase || null,
        materia: m.materia || null,
        link: m.link || null,
      }))
    },
    {
      name: 'etiquetas',
      label: 'Etiquetas',
      getData: () => (appState.etiquetas || []).map(e => ({
        id: e.id,
        nome: e.nome,
        cor: e.cor || null,
        escritorio_id: e.escritorioId || null,
      }))
    },
    {
      name: 'calendario',
      label: 'Calendário Judicial',
      getData: () => (appState.calendario || []).map(c => ({
        id: c.id,
        tj: c.tj,
        data: toIsoDate(c.data) || new Date().toISOString(),
        descricao: c.descricao,
        escritorio_id: c.escritorioId || null,
      }))
    },
    {
      name: 'leads_status',
      label: 'Status de Leads',
      getData: () => (appState.leadsStatus || []).map(s => ({
        id: s.id,
        nome: s.nome,
        cor: s.cor || null,
        escritorio_id: s.escritorioId || s.idEscritorio || null,
      }))
    },
    {
      name: 'leads',
      label: 'Leads Processuais',
      getData: () => (appState.leads || []).map(l => ({
        id: l.id,
        numero: l.numero || null,
        classe: l.classe || null,
        tribunal: l.tribunal || null,
        orgao: l.orgao || null,
        partes: l.partes || null,
        advogados: l.advogados || null,
        disponibilizacao: toIsoDate(l.disponibilizacao),
        publicacao: toIsoDate(l.publicacao),
        data_cadastro: toIsoDate(l.dataCadastro),
        status: l.status || 'Novo',
        escritorio_id: l.escritorioId || null,
        resumo: l.resumo || null,
        prioridade: l.prioridade || 'Média',
      }))
    },
    {
      name: 'logs',
      label: 'Logs de Auditoria',
      getData: () => (appState.logs || []).map(l => ({
        id: l.id || `log_${Math.random().toString(36).substring(2, 9)}`,
        data: toIsoDate(l.data) || new Date().toISOString(),
        usuario: l.usuario || null,
        acao: l.acao || null,
        id_escritorio: l.idEscritorio || null,
        detalhes: l.detalhes || null,
      }))
    },
    {
      name: 'app_settings',
      label: 'Configurações do Sistema',
      getData: () => {
        const list = appState.allSettings && appState.allSettings.length > 0 
          ? appState.allSettings 
          : [appState.settings];

        return list.map((s, idx) => ({
          id: s.idEscritorio || `cfg_${idx + 1}`,
          id_escritorio: s.idEscritorio || null,
          timezone: s.timezone || 'America/Sao_Paulo',
          items_per_page: Number(s.itemsPerPage) || 10,
          permissions: typeof s.permissions === 'string' ? JSON.parse(s.permissions || '[]') : (s.permissions || []),
          email_user: s.emailUser || null,
          email_pass: s.emailPass || null,
          use_external_smtp: !!s.useExternalSmtp,
          smtp_host: s.smtpHost || null,
          smtp_port: Number(s.smtpPort) || 465,
          smtp_secure: s.smtpSecure !== false,
          enable_email_notifications: !!s.enableEmailNotifications,
          email_weekly_report: !!s.emailWeeklyReport,
          email_daily_report: !!s.emailDailyReport,
          email_new_notifications: !!s.emailNewNotifications,
          template_weekly_report: s.templateWeeklyReport || null,
          template_daily_report: s.templateDailyReport || null,
          template_new_notifications: s.templateNewNotifications || null,
          show_movimentos: s.showMovimentos !== false,
          dias_morosidade: Number(s.diasMorosidade) || 30,
          menu_order: s.menuOrder || [],
          email_dispatch_time: s.emailDispatchTime || '08:00',
          google_client_id: s.googleClientId || null,
          app_version: s.appVersion || null,
          theme: s.theme || 'light',
        }));
      }
    }
  ];

  addLog('Iniciando processo de migração para o Supabase...', 'info');

  for (let i = 0; i < tablesToMigrate.length; i++) {
    const tableDef = tablesToMigrate[i];
    const records = tableDef.getData();
    const count = records.length;

    addLog(`Preparando tabela [${tableDef.label}] (${count} registros encontrados)...`, 'info');

    if (onProgress) {
      onProgress({
        currentTable: tableDef.label,
        tableIndex: i + 1,
        totalTables: tablesToMigrate.length,
        migratedRecords: totalRecordsCount,
        totalRecordsForTable: count,
        percentage: Math.round(((i) / tablesToMigrate.length) * 100),
        status: 'running',
        logs: [...logs],
      });
    }

    if (count > 0) {
      const { inserted, errors } = await batchUpsert(supabase, tableDef.name, records);
      totalRecordsCount += inserted;

      if (errors.length > 0) {
        errors.forEach(err => {
          allErrors.push(err);
          addLog(err, 'error');
        });
      } else {
        addLog(`Sucesso: ${inserted} registros gravados na tabela "${tableDef.name}".`, 'success');
      }
    } else {
      addLog(`Tabela "${tableDef.name}" vazia, pulando inserção.`, 'info');
    }

    if (onProgress) {
      onProgress({
        currentTable: tableDef.label,
        tableIndex: i + 1,
        totalTables: tablesToMigrate.length,
        migratedRecords: totalRecordsCount,
        totalRecordsForTable: count,
        percentage: Math.round(((i + 1) / tablesToMigrate.length) * 100),
        status: 'running',
        logs: [...logs],
      });
    }
  }

  const finalStatus = allErrors.length === 0 ? 'success' : 'error';
  addLog(
    finalStatus === 'success' 
      ? `Migração finalizada com êxito! Total de ${totalRecordsCount} registros migrados para o Supabase.` 
      : `Migração concluída com ${allErrors.length} avisos/erros. Revise os logs.`,
    finalStatus === 'success' ? 'success' : 'warning'
  );

  if (onProgress) {
    onProgress({
      currentTable: 'Concluído',
      tableIndex: tablesToMigrate.length,
      totalTables: tablesToMigrate.length,
      migratedRecords: totalRecordsCount,
      totalRecordsForTable: 0,
      percentage: 100,
      status: finalStatus,
      logs: [...logs],
    });
  }

  return {
    success: allErrors.length === 0,
    totalRecords: totalRecordsCount,
    errors: allErrors,
  };
};

/**
 * Gera um arquivo SQL completo com todas as instruções INSERT prontas para exportação offline
 */
export const generateFullSQLDump = (appState: AppState): string => {
  let sql = `-- DUMP COMPLETO DE DADOS PARA SUPABASE (POSTGRESQL)\n`;
  sql += `-- Gerado em: ${new Date().toISOString()}\n\n`;
  sql += SUPABASE_SCHEMA_SQL + `\n\n`;

  const escapeSql = (val: any): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
    return `'${String(val).replace(/'/g, "''")}'`;
  };

  const createInserts = (tableName: string, rows: Record<string, any>[]): string => {
    if (!rows || rows.length === 0) return `-- Tabela ${tableName}: sem registros\n\n`;
    const cols = Object.keys(rows[0]);
    let block = `-- Inserções para ${tableName} (${rows.length} registros)\n`;
    for (const r of rows) {
      const values = cols.map(c => escapeSql(r[c])).join(', ');
      block += `INSERT INTO public.${tableName} (${cols.join(', ')}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${cols.map(c => `${c} = EXCLUDED.${c}`).join(', ')};\n`;
    }
    return block + '\n';
  };

  // Escritorios
  const escritorios = (appState.escritorios || []).map(e => ({
    id: e.id,
    nome: e.nome,
    cnpj: e.cnpj || null,
    responsavel: e.responsavel || null,
    oab: e.oab || null,
    email: e.email || null,
    telefone: e.telefone || null,
  }));
  sql += createInserts('escritorios', escritorios);

  // Usuarios
  const usuarios = (appState.usuarios || []).map(u => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    permissao: u.permissao || 'user',
    cpf: u.cpf || null,
    cargo: u.cargo || null,
    senha: u.senha || null,
  }));
  sql += createInserts('usuarios', usuarios);

  // Processos
  const processos = (appState.processos || []).map(p => ({
    id: p.id,
    numero: p.numero || '',
    titulo: p.titulo || null,
    status: p.status || 'Ativo',
    valor_causa: Number(p.valorCausa) || 0,
    escritorio_id: p.escritorioId || null,
    cliente_id: p.clienteId || null,
  }));
  sql += createInserts('processos', processos);

  // Contatos
  const contatos = (appState.contatos || []).map(c => ({
    id: c.id,
    nome: c.nome,
    cpf_cnpj: c.cpfCnpj || null,
    email: c.email || null,
    telefone: c.telefone || null,
    tipo: c.tipo || 'Cliente',
    escritorio_id: c.escritorioId || null,
  }));
  sql += createInserts('contatos', contatos);

  // Tarefas
  const tarefas = (appState.tarefas || []).map(t => ({
    id: String(t.ID_TAREFA || (t as any).id || ''),
    titulo: String(t.TITULO || t.TAREFA || ''),
    status: String(t.STATUS || 'Pendente'),
    prioridade: String(t.PRIORIDADE || 'Normal'),
    escritorio_id: String(t.ID_ESCRITORIO || '') || null,
  }));
  sql += createInserts('tarefas', tarefas);

  return sql;
};
