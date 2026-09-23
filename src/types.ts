export type View = 
  | 'dashboard'
  | 'contatos'
  | 'processosAtivos'
  | 'tarefasPendentes'
  | 'eventos'
  | 'financeiro'
  | 'usuarios'
  | 'tarefas'
  | 'pendencias'
  | 'documentos'
  | 'varas'
  | 'forum'
  | 'modelos'
  | 'julgadores'
  | 'servidores'
  | 'movimentos'
  | 'recursos'
  | 'upj'
  | 'processosGeral'
  | 'tribunais'
  | 'escritorios'
  | 'etiquetas'
  | 'djen'
  | 'api_diario'
  | 'leads'
  | 'calendario'
  | 'ia'
  | 'profile'
  | 'formularioClientes'
  | 'logs'
  | 'settings';

export interface Calendario {
  id: string;
  tj: string;
  data: string;
  descricao: string;
  escritorioId?: string;
}

export interface LeadStatus {
  id: string;
  nome: string;
  cor: string;
  escritorioId?: string;
  idEscritorio?: string;
}

export const DEFAULT_LEAD_STATUSES: LeadStatus[] = [
  { id: 'novo', nome: 'Novo', cor: '#3B82F6', escritorioId: 'x', idEscritorio: 'x' },
  { id: 'em_contato', nome: 'Em Contato', cor: '#F59E0B', escritorioId: 'x', idEscritorio: 'x' },
  { id: 'convertido', nome: 'Convertido', cor: '#10B981', escritorioId: 'x', idEscritorio: 'x' },
  { id: 'descartado', nome: 'Descartado', cor: '#EF4444', escritorioId: 'x', idEscritorio: 'x' },
];

export interface Lead {
  id: string;
  numero: string;
  classe: string;
  tribunal: string;
  orgao: string;
  partes: string;
  advogados: string;
  disponibilizacao: string;
  publicacao: string;
  dataCadastro: string;
  status: string;
  escritorioId?: string;
  resumo?: string;
  prioridade?: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
}

export interface RolePermission {
  role: string;
  menus: View[];
  actions: {
    [key: string]: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
  };
}

export interface Forum {
  id: string; // ID_FORUM
  nome: string; // NOME_FORUM
  endereco: string; // ENDERECO
  tribunalId: string; // ID_TJ
  escritorioId?: string;
}

export interface AppSettings {
  spreadsheetId: string;
  scriptUrl: string;
  // These are effectively the "Active Session Settings"
  // resulting from the merger of Office Global + User Personal
  timezone: string;
  itemsPerPage: number;
  permissions?: any;
  emailUser?: string;
  emailPass?: string;
  useExternalSmtp?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  enableEmailNotifications?: boolean;
  emailWeeklyReport?: boolean;
  emailNewNotifications?: boolean;
  templateWeeklyReport?: string;
  templateNewNotifications?: string;
  showMovimentos?: boolean;
  diasMorosidade?: number;
  menuOrder?: View[];
  emailDailyReport?: boolean;
  templateDailyReport?: string;
  emailDispatchTime?: string;
  googleClientId?: string;
  idEscritorio?: string;
  appVersion?: string;
  // UI Theme state
  theme?: 'light' | 'dark' | 'system';
}

export interface Contato {
  id: string;
  nome: string;
  apelido?: string;
  statusCivil?: string;
  status?: string;
  profissao?: string;
  rg?: string;
  cpfCnpj: string;
  endereco?: string;
  cep?: string;
  municipio?: string;
  estado?: string;
  telefone: string;
  email: string;
  tipo: 'Cliente' | 'Contato' | 'Lead';
  escritorioId?: string;
  dataCadastro?: string;
  observacoes?: string;
  dadosPagamento?: string;
}

export interface Processo {
  id: string;
  numero: string;
  clienteId: string;
  parteContraria: string;
  tribunal: string;
  status: 'Ativo' | 'Inativo';
  dataDistribuicao: string;
  escritorioId?: string;
  idProc?: string;
  tipo?: string;
  titulo?: string;
  instancia?: string;
  varaId?: string;
  classe?: string;
  assunto?: string;
  valorCausa?: number;
  resultado?: string;
  ativo?: string;
  link?: string;
  tags?: string;
  pasta?: string;
  disponibilizacao?: string;
  publicacao?: string;
  inicioPrazo?: string;
  envolvidosIds?: string[];
  tribunalId?: string;
  forumId?: string;
  advogadoId?: string;
  upjId?: string;
  servidorId?: string;
}

export interface Evento {
  id: string;
  titulo: string;
  data: string;
  tipo: 'Prazo' | 'Audiência' | 'Reunião' | 'Outro';
  processoId?: string;
  usuarioId?: string;
  observacoes?: string;
  concluido: boolean;
  escritorioId?: string;
  link?: string;
}

export interface Movimento {
  id: string;
  processoId: string;
  data: string;
  descricao: string;
  pagina?: string;
  usuarioId?: string;
  escritorioId?: string;
}

export interface Transacao {
  id: string;
  tipo: 'Receita' | 'Despesa';
  valor: number;
  data: string;
  descricao: string;
  processoId?: string;
  status: 'Pago' | 'Pendente';
  escritorioId?: string;
  usuarioId?: string;
  observacoes?: string;
  categoria?: string;
  contatoId?: string;
  clienteId?: string;
  pago?: boolean;
}

export interface Documento {
  id: string;
  titulo: string;
  tipo: 'Petição' | 'Contrato' | 'Procuração' | 'Outro';
  processoId?: string;
  dataCriacao: string;
  conteudo: string;
  escritorioId?: string;
  url?: string;
  dataUpload?: string;
}

export interface Vara {
  id: string; // ID_VARA
  nome: string; // VARA_NOME
  forum: string; // ID_FORUM
  localizacao: string; // LOCALIZACAO
  telefone: string; // TEL01
  email: string; // EMAIL01
  balcaoVirtual: string; // BALCAO01
  juiz: string; // JUIZ
  juiz_2?: string; // JUIZ_2
  secretaria?: string; // ID_UPJ / SECRETARIA
  id_servidores?: string[]; // ID_SERVIDORES (comma separated or JSON array)
  escritorioId?: string;
  idTj?: string;
}

export interface Usuario {
  id: string;
  nome: string;
  cargo: string;
  email: string;
  contato: string;
  senha?: string;
  oab?: string;
  cpf: string;
  permissao: string;
  escritoriosIds: string[];
  status?: string;
  fotoUrl?: string;
  // User-specific settings overrides
  theme?: 'light' | 'dark' | 'system';
  itemsPerPage?: number;
  menuOrder?: View[];
  enableNotifications?: boolean;
}

export interface Tarefa {
  ID_TAREFA: string;
  TITULO: string;
  DESCRICAO: string;
  STATUS: string;
  PRIORIDADE: string;
  DATA_LIMITE: string;
  RESPONSAVEL_ID: string;
  PROCESSO_ID: string;
  ID_ESCRITORIO: string;
  DATA_CRIACAO: string;
  PROC_NOME: string;
  VARA_ID: string;
  VARA_NOME: string;
  UPJ_NOME: string;
  ID_RESPONSAVEL?: string;
  ATRIBUIDO_ID?: string;
  // Support fields for temporary compatibility
  id?: string;
  TAREFA?: string;
  PRAZO_IN?: string;
  PRAZO_FIM?: string;
  ID_USER?: string;
  ID_PROC?: string;
  ID_VARA?: string;
  'PROC.NOME'?: string;
  'VARA.NOME'?: string;
  CONCLUSAO?: string;
  PAGINA?: string;
  LINK?: string;
  prazo_tipo?: string;
}

export interface Julgador {
  id: string;
  nome: string;
  escritorioId?: string;
  cargo?: string;
  email?: string;
  telefone?: string;
}

export interface Servidor {
  id: string;
  nome: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  escritorioId?: string;
}

export interface Recurso {
  id: string;
  processoOriginarioId: string;
  recursoOriginario?: string;
  classe: string;
  assunto: string;
  secao: string;
  orgaoJulgadorId: string;
  area: string;
  relatorId: string;
  link?: string;
  marcador?: string;
  resultado?: string;
  status: 'Ativo' | 'Inativo';
  escritorioId: string;
  envolvidosIds?: string[];
}

export interface UPJ {
  id: string;
  nome: string;
  email: string;
  email1?: string;
  whatsapp?: string;
  telefone?: string;
  diretor: string;
  balcao?: string;
  localizacao: string;
  escritorioId?: string;
}

export interface Envolvido {
  id: string;
  contatoId: string;
  processoId?: string;
  recursoId?: string;
  tipoEnvolvimento: string;
  escritorioId: string;
}

export interface Escritorio {
  id: string;
  nome: string;
  endereco?: string;
  usuariosId?: string;
  responsavel?: string;
  oab?: string;
  uf?: string;
  cnpj?: string;
  theme?: 'light' | 'dark';
  primaryColor?: string;
  backgroundColor?: string;
  secondaryColor?: string;
  telefone?: string;
  email?: string;
  logoUrl?: string;
  // Office-specific settings
  timezone?: string;
  itemsPerPage?: number;
  emailUser?: string;
  emailPass?: string;
  useExternalSmtp?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  enableEmailNotifications?: boolean;
  emailWeeklyReport?: boolean;
  emailNewNotifications?: boolean;
  templateWeeklyReport?: string;
  templateNewNotifications?: string;
  showMovimentos?: boolean;
  diasMorosidade?: number;
  emailDailyReport?: boolean;
  templateDailyReport?: string;
  emailDispatchTime?: string;
  menuOrder?: View[];
  googleFormsSpreadsheetId?: string;
  googleFormsSheetName?: string;
  googleClientId?: string;
  appVersion?: string;
}

export interface Modelo {
  id: string;
  escritorioId: string;
  nome: string;
  fase: string;
  materia: string;
  link: string;
}

export interface Tribunal {
  id: string; // ID_TJ
  sigla: string; // SIGLA
  nome: string; // NOME
}


export interface Etiqueta {
  id: string;
  nome: string;
  cor?: string;
  escritorioId: string;
}

export interface TipoEnvolvimento {
  id: string;
  nome: string;
}

export interface VaraStats {
  totalProcessos: number;
  julgados: number;
  pendentes: number;
  mediaDiasJulgamento: number;
  assuntosMaisComuns: { nome: string; count: number }[];
  classesMaisComuns: { nome: string; count: number }[];
}

export interface LogRegistro {
  id: string;
  data: string;
  usuario: string;
  acao: string;
  idEscritorio: string;
  detalhes: string;
}

export interface AppState {
  contatos: Contato[];
  processos: Processo[];
  eventos: Evento[];
  movimentos: Movimento[];
  financeiro: Transacao[];
  documentos: Documento[];
  varas: Vara[];
  tarefas: Tarefa[];
  escritorios: Escritorio[];
  usuarios: Usuario[];
  pendencias: any[];
  modelos: Modelo[];
  julgadores: Julgador[];
  servidores: Servidor[];
  recursos: Recurso[];
  upj: UPJ[];
  envolvidos: Envolvido[];
  tribunais: Tribunal[];
  forums: Forum[];
  etiquetas: Etiqueta[];
  calendario: Calendario[];
  tipoEnvolvimentos: TipoEnvolvimento[];
  leads: Lead[];
  leadsStatus: LeadStatus[];
  logs: LogRegistro[];
  settings: AppSettings;
  allSettings: AppSettings[];
  syncStatus: 'idle' | 'saving' | 'loading' | 'error';
  lastSyncTime: string | null;
  syncLogs: Array<{timestamp: string, action: string, status: 'success' | 'error', details?: string}>;
  hasLoaded: boolean;
  hasFullLoaded?: boolean;
  selectedProcessId?: string;
  viewParams?: any;
}
