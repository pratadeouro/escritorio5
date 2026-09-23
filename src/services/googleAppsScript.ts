import { AppState, Contato, Processo, Evento, Movimento, Transacao, Documento, Vara, Usuario, Tarefa, Julgador, Servidor, Recurso, UPJ, Tribunal, Calendario } from '../types';

/**
 * Busca todos os dados da planilha usando o Google Apps Script
 */
export const fetchAllDataFromScript = async (scriptUrl: string): Promise<any> => {
  if (!scriptUrl) {
    throw new Error('URL do Google Apps Script não configurada');
  }

  try {
    const url = scriptUrl.trim();
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error || 'Erro desconhecido ao buscar dados');
    }
  } catch (error) {
    console.error('Erro ao buscar dados do Apps Script:', error);
    throw error;
  }
};

/**
 * Salva um log na planilha usando o Google Apps Script
 */
export const saveLogToScript = async (
  scriptUrl: string, 
  logData: { usuario: string; acao: string; idEscritorio: string; detalhes: string }
): Promise<boolean> => {
  if (!scriptUrl) return false;

  try {
    const payload = {
      action: 'log',
      data: logData
    };

    await fetch(scriptUrl.trim(), {
      method: 'POST',
      body: JSON.stringify(payload),
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });
    return true;
  } catch (error) {
    console.error('Erro ao salvar log:', error);
    return false;
  }
};

/**
 * Salva ou atualiza um único item de forma atômica na planilha (Ideal para multiusuários)
 */
export const upsertItemToScript = async (
  scriptUrl: string,
  table: string,
  item: any,
  idField: string = 'ID'
): Promise<boolean> => {
  if (!scriptUrl || !table || !item) return false;

  try {
    const response = await fetch(scriptUrl.trim(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'upsertItem',
        table,
        idField,
        data: item
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    
    if (!response.ok && response.status !== 0) {
      return false;
    }
    
    const text = await response.text();
    try {
      const result = JSON.parse(text);
      return result.success !== false;
    } catch {
      return true;
    }
  } catch (error) {
    console.error(`Erro ao salvar atomicamente item na tabela ${table}:`, error);
    return false;
  }
};

/**
 * Exclui um único item de forma atômica da planilha (Ideal para multiusuários)
 */
export const deleteItemFromScript = async (
  scriptUrl: string,
  table: string,
  id: string,
  idField: string = 'ID'
): Promise<boolean> => {
  if (!scriptUrl || !table || !id) return false;

  try {
    const response = await fetch(scriptUrl.trim(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'deleteItem',
        table,
        id,
        idField
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });

    if (!response.ok && response.status !== 0) {
      return false;
    }

    const text = await response.text();
    try {
      const result = JSON.parse(text);
      return result.success !== false;
    } catch {
      return true;
    }
  } catch (error) {
    console.error(`Erro ao excluir atomicamente item da tabela ${table}:`, error);
    return false;
  }
};

/**
 * Salva apenas os dados de uma única tabela específica na planilha
 */
export const saveTableToScript = async (
  scriptUrl: string,
  table: string,
  data: any[],
  allowEmpty: boolean = false
): Promise<boolean> => {
  if (!scriptUrl || !table) return false;

  try {
    const response = await fetch(scriptUrl.trim(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'saveTable',
        table,
        data,
        allowEmpty
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });

    if (!response.ok && response.status !== 0) {
      return false;
    }

    const text = await response.text();
    try {
      const result = JSON.parse(text);
      return result.success !== false;
    } catch {
      return true;
    }
  } catch (error) {
    console.error(`Erro ao salvar tabela ${table}:`, error);
    return false;
  }
};

/**
 * Verifica a estrutura da planilha (cabeçalhos)
 */
export const checkSheetHeaders = async (scriptUrl: string): Promise<any[]> => {
  if (!scriptUrl) throw new Error('URL do Script não configurada');

  try {
    const response = await fetch(scriptUrl.trim(), {
      method: 'POST',
      body: JSON.stringify({ action: 'checkHeaders' }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const result = await response.json();
    if (result.success) return result.report;
    throw new Error(result.error || 'Erro ao verificar cabeçalhos');
  } catch (error) {
    console.error('Erro ao verificar cabeçalhos:', error);
    throw error;
  }
};

/**
 * Corrige a estrutura da planilha (cria abas e colunas faltantes)
 */
export const fixSheetHeaders = async (scriptUrl: string): Promise<boolean> => {
  if (!scriptUrl) throw new Error('URL do Script não configurada');

  try {
    const response = await fetch(scriptUrl.trim(), {
      method: 'POST',
      body: JSON.stringify({ action: 'fixHeaders' }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Erro ao corrigir cabeçalhos:', error);
    throw error;
  }
};

/**
 * Envia um e-mail de teste
 */
export const sendTestEmail = async (scriptUrl: string, email: string, user: string, pass: string, subject?: string, body?: string): Promise<boolean> => {
  if (!scriptUrl) throw new Error('URL do Script não configurada');

  try {
    const response = await fetch(scriptUrl.trim(), {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'sendTestEmail',
        email,
        user,
        pass,
        subject,
        body
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const result = await response.json();
    if (result.success) return true;
    throw new Error(result.error || 'Erro ao enviar e-mail de teste');
  } catch (error) {
    console.error('Erro ao enviar e-mail de teste:', error);
    throw error;
  }
};

/**
 * Envia um e-mail de teste usando SMTP externo (servidor Node.js)
 */
export const sendTestEmailExternal = async (config: { 
  host: string; 
  port: number; 
  secure: boolean; 
  user: string; 
  pass: string; 
  to: string;
  subject?: string;
  html?: string;
}): Promise<boolean> => {
  try {
    const response = await fetch('/api/email/test', {
      method: 'POST',
      body: JSON.stringify(config),
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (result.success) return true;
    throw new Error(result.error || 'Erro ao enviar e-mail de teste via SMTP');
  } catch (error) {
    console.error('Erro ao enviar e-mail de teste via SMTP:', error);
    throw error;
  }
};

/**
 * Converte data de YYYY-MM-DD para DD/MM/YYYY para a planilha
 */
const formatDateForSheet = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (str.includes('-')) {
    const parts = str.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return str;
};

/**
 * Converte data e hora de YYYY-MM-DDTHH:MM para DD/MM/YYYY HH:MM para a planilha
 */
const formatDateTimeForSheet = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (str.includes('-')) {
    const mainParts = str.includes('T') ? str.split('T') : str.split(' ');
    const dateParts = mainParts[0].split('-');
    if (dateParts.length === 3) {
      const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      const timePart = mainParts[1] ? mainParts[1].substring(0, 5) : '';
      return timePart ? `${formattedDate} ${timePart}` : formattedDate;
    }
  }
  return str;
};

export const saveAllDataToScript = async (appState: AppState, scriptUrl: string): Promise<boolean> => {
  if (!scriptUrl) {
    throw new Error('URL do Google Apps Script não configurada nas configurações.');
  }

  const url = scriptUrl.trim();
  if (!url.startsWith('https://script.google.com/')) {
    throw new Error('A URL do script é inválida. Ela deve começar com https://script.google.com/');
  }

  if (!url.includes('/exec')) {
    console.warn('A URL do script pode estar incorreta. Certifique-se de usar a URL de "Execução" (Web App) que termina em /exec');
  }

  console.log('Iniciando salvamento de dados no Google Script...');

  try {
    // Protection - but more relaxed to allow starting fresh or intentional empty states
    if (appState.hasLoaded && appState.processos.length === 0 && appState.usuarios.length > 5 && appState.lastSyncTime !== null) {
      console.error('CRITICAL: Attempting to save with 0 processes but many active users. Aborting save to protect data.');
      return false;
    }

    // Mapeia o estado da aplicação para o formato esperado pela planilha
    const payload = {
      action: 'saveAll',
      allowEmptyTables: false,
      safeMode: true,
      data: {
        Contatos: appState.contatos.map(c => ({
          ID: c.id,
          NOME: c.nome,
          EMAIL: c.email,
          TELEFONE: c.telefone,
          TIPO: c.tipo,
          OBSERVACOES: c.observacoes || '',
          ID_ESCRITORIO: c.escritorioId,
          DATA_CADASTRO: formatDateForSheet(c.dataCadastro),
          APELIDO: c.apelido || '',
          RG: c.rg || '',
          CPF_CNPJ: c.cpfCnpj || '',
          ENDERECO: c.endereco || '',
          CEP: c.cep || '',
          MUNICIPIO: c.municipio || '',
          ESTADO: c.estado || '',
          STATUS_CIVIL: c.statusCivil || '',
          STATUS: c.status || 'Ativo',
          DADOS_PAGAMENTO: c.dadosPagamento || ''
        })),
        Processos: appState.processos.map(p => ({
          ID: p.id,
          NUMERO: p.numero || '',
          TITULO: p.titulo || '',
          CLIENTE_ID: p.clienteId || '',
          VARA_ID: p.varaId || '',
          STATUS: p.status || p.ativo || 'Ativo',
          ULTIMA_MOVIMENTACAO: formatDateForSheet(p.dataDistribuicao),
          VALOR_CAUSA: p.valorCausa || 0,
          ID_ESCRITORIO: p.escritorioId || '',
          DATA_ABERTURA: formatDateForSheet(p.dataDistribuicao),
          TIPO_PROCESSO: p.tipo || '',
          URL_PROCESSO: p.link || '',
          LINK: p.link || '',
          ID_TRIBUNAL: p.tribunalId || '',
          ID_FORUM: p.forumId || '',
          ID_VAR: p.varaId || '',
          ADVOGADO_ID: p.advogadoId || '',
          ID_UPJ: p.upjId || '',
          ID_SERVIDOR: p.servidorId || '',
          ASSUNTO: p.assunto || '',
          ETIQUETAS: p.tags || '',
          INSTANCIA: p.instancia || '',
          CLASSE: p.classe || '',
          DATA_DISTRIBUICAO: formatDateForSheet(p.dataDistribuicao),
          RESULTADO: p.resultado || '',
          PASTA: p.pasta || ''
        })),
        Eventos: appState.eventos.map(e => ({
          ID: e.id,
          PROCESSO_ID: e.processoId,
          TITULO: e.titulo,
          DESCRICAO: e.observacoes || '',
          DATA: formatDateTimeForSheet(e.data),
          TIPO: e.tipo,
          ID_ESCRITORIO: e.escritorioId,
          USUARIO_ID: e.usuarioId || '',
          CONCLUIDO: e.concluido ? 'TRUE' : 'FALSE',
          LINK: e.link || ''
        })),
        Movimentos: appState.movimentos.map(m => ({
          ID_MOVIMENTO: m.id,
          ID: m.id,
          PROCESSO_ID: m.processoId,
          DESCRICAO: m.descricao,
          DATA: formatDateForSheet(m.data),
          ID_USUARIO: m.usuarioId || '',
          RESPONSAVEL: m.usuarioId || '',
          ID_ESCRITORIO: m.escritorioId || '',
          PAGINA: m.pagina || ''
        })),
        Financeiro: appState.financeiro.map(f => ({
          ID: f.id,
          DESCRICAO: f.descricao,
          VALOR: f.tipo === 'Despesa' ? -f.valor : f.valor,
          DATA: formatDateForSheet(f.data),
          TIPO: f.tipo,
          CATEGORIA: f.categoria || '',
          STATUS: f.status || (f.pago ? 'Pago' : 'Pendente'),
          ID_ESCRITORIO: f.escritorioId,
          PROCESSO_ID: f.processoId || '',
          CONTATO_ID: f.contatoId || f.clienteId || '',
          USUARIO_ID: f.usuarioId || '',
          OBSERVACOES: f.observacoes || ''
        })),
        Documentos: appState.documentos.map(d => ({
          ID: d.id,
          ID_DOC: d.id,
          ID_DOCUMENTO: d.id,
          TITULO: d.titulo,
          MODELO: d.titulo,
          NOME: d.titulo,
          TIPO: d.tipo || '',
          CONTEUDO: d.conteudo || '',
          ARQUIVO: d.conteudo || '',
          TEXTO: d.conteudo || '',
          ID_ESCRITORIO: d.escritorioId || '',
          PROCESSO_ID: d.processoId || '',
          ID_PROC: d.processoId || '',
          DATA_CRIACAO: d.dataCriacao || '',
          DATA_UPLOAD: d.dataUpload || d.dataCriacao || '',
          URL: d.url || ''
        })),
        Varas: appState.varas.map(v => ({
          ID_VARA: v.id,
          VARA_NOME: v.nome,
          ID_FORUM: v.forum,
          LOCALIZACAO: v.localizacao || '',
          TEL01: v.telefone || '',
          EMAIL01: v.email || '',
          BALCAO01: v.balcaoVirtual || '',
          JUIZ: v.juiz || '',
          JUIZ_2: v.juiz_2 || '',
          ID_SERVIDORES: v.id_servidores ? v.id_servidores.join(',') : '',
          ID_ESCRITORIO: v.escritorioId,
          ID_TJ: v.idTj || ''
        })),
        Tarefas: appState.tarefas.map(t => ({
          ID_TAREFA: String(t.ID_TAREFA || (t as any).id || ''),
          TITULO: String(t.TAREFA || ''),
          DESCRICAO: String(t.DESCRICAO || ''),
          STATUS: String(t.STATUS || ''),
          PRIORIDADE: String(t.PRIORIDADE || ''),
          DATA_LIMITE: formatDateForSheet(t.PRAZO_FIM),
          RESPONSAVEL_ID: String(t.ID_USER || ''),
          PROCESSO_ID: String(t.ID_PROC || ''),
          ID_ESCRITORIO: String(t.ID_ESCRITORIO || ''),
          DATA_CRIACAO: formatDateForSheet(t.DATA_CRIACAO || t.PRAZO_IN),
          PROC_NOME: String(t['PROC.NOME'] || ''),
          VARA_ID: String(t.ID_VARA || ''),
          VARA_NOME: String(t['VARA.NOME'] || ''),
          UPJ_NOME: String(t.UPJ_NOME || ''),
          PRAZO_TIPO: String(t.prazo_tipo || 'Corridos'),
          ATRIBUIDO_ID: String(t.ATRIBUIDO_ID || '')
        })),
        Julgadores: appState.julgadores.map(j => ({
          ID_JULGADOR: j.id,
          NOME: j.nome,
          CARGO: j.cargo || '',
          EMAIL: j.email || '',
          TELEFONE: j.telefone || '',
          ID_ESCRITORIO: j.escritorioId
        })),
        Servidores: appState.servidores.map(s => ({
          ID_SERVIDOR: s.id,
          NOME: s.nome,
          CARGO: s.cargo || '',
          EMAIL: s.email || '',
          TELEFONE: s.telefone || '',
          ID_ESCRITORIO: s.escritorioId || ''
        })),
        Recursos: appState.recursos.map(r => ({
          ID: r.id,
          PROCESSO_ORIGIN: r.processoOriginarioId,
          'REC.ORIGINARIO': r.recursoOriginario,
          CLASSE: r.classe,
          ASSUNTO: r.assunto,
          SECAO: r.secao,
          'ORGAO JULGADOR': r.orgaoJulgadorId,
          AREA: r.area,
          RELATOR: r.relatorId,
          LINK: r.link,
          MARCADOR: r.marcador,
          RESULTADO: r.resultado,
          ATIVO: r.status,
          ID_ESCRITORIO: r.escritorioId,
          ENVOLVIDOS: (r.envolvidosIds || []).join(',')
        })),
        UPJ: appState.upj.map(u => ({
          ID: u.id,
          NOME: u.nome,
          EMAIL: u.email,
          EMAIL1: u.email1,
          WHATSAPP: u.whatsapp,
          TELEFONE: u.telefone,
          DIRETOR: u.diretor,
          BALCAO: u.balcao,
          LOCALIZACAO: u.localizacao,
          ID_ESCRITORIO: u.escritorioId
        })),
        Forum: appState.forums.map(f => {
          return {
            ID_FORUM: f.id,
            NOME_FORUM: f.nome,
            ENDERECO: f.endereco,
            ID_TJ: f.tribunalId,
            ID_ESCRITORIO: f.escritorioId
          };
        }),
        tribunal: appState.tribunais.map(t => ({
          ID_TJ: t.id,
          SIGLA: t.sigla,
          NOME: t.nome
        })),
        Envolvidos: appState.envolvidos.map(e => ({
          ID_CADASTRO: e.id,
          ID_CONTATO: e.contatoId,
          ID_PROC: e.processoId,
          ID_RECURSO: e.recursoId || '',
          TIPO_ENVOLVIMENTO: e.tipoEnvolvimento,
          ID_ESCRITORIO: e.escritorioId
        })),
        Modelos: appState.modelos.map(m => ({
          ID: m.id,
          ID_MODELO: m.id,
          ID_ESCRITORIO: m.escritorioId || '',
          NOME_MODELO: m.nome,
          NOME: m.nome,
          TITULO: m.nome,
          FASE_MODELO: m.fase || '',
          FASE: m.fase || '',
          MATERIA: m.materia || '',
          LINK: m.link || '',
          URL: m.link || ''
        })),
        Escritorios: appState.escritorios.map(e => ({
          ID: e.id,
          NOME: e.nome,
          CNPJ: e.cnpj || '',
          ENDERECO: e.endereco || '',
          TELEFONE: e.telefone || '',
          EMAIL: e.email || '',
          LOGO_URL: e.logoUrl || '',
          RESPONSAVEL: e.responsavel || '',
          OAB: e.oab || '',
          UF: e.uf || '',
          THEME: e.theme || 'light',
          PRIMARY_COLOR: e.primaryColor || '#4f46e5',
          BACKGROUND_COLOR: e.backgroundColor || '',
          SECONDARY_COLOR: e.secondaryColor || '#6366f1',
          TIMEZONE: e.timezone || 'America/Sao_Paulo',
          ITEMS_PER_PAGE: e.itemsPerPage || 10,
          MENU_ORDER: JSON.stringify(e.menuOrder || []),
          EMAIL_USER: e.emailUser || '',
          EMAIL_PASS: e.emailPass || '',
          USE_EXTERNAL_SMTP: e.useExternalSmtp ? 'TRUE' : 'FALSE',
          SMTP_HOST: e.smtpHost || '',
          SMTP_PORT: e.smtpPort || 465,
          SMTP_SECURE: e.smtpSecure ? 'TRUE' : 'FALSE',
          ENABLE_EMAIL_NOTIFICATIONS: e.enableEmailNotifications ? 'TRUE' : 'FALSE',
          EMAIL_WEEKLY_REPORT: e.emailWeeklyReport ? 'TRUE' : 'FALSE',
          EMAIL_DAILY_REPORT: e.emailDailyReport ? 'TRUE' : 'FALSE',
          EMAIL_NEW_NOTIFICATIONS: e.emailNewNotifications ? 'TRUE' : 'FALSE',
          TEMPLATE_WEEKLY_REPORT: e.templateWeeklyReport || '',
          TEMPLATE_DAILY_REPORT: e.templateDailyReport || '',
          TEMPLATE_NEW_NOTIFICATIONS: e.templateNewNotifications || '',
          EMAIL_DISPATCH_TIME: e.emailDispatchTime || '08:00',
          SHOW_MOVIMENTOS: e.showMovimentos !== false ? 'TRUE' : 'FALSE',
          DIAS_MOROSIDADE: e.diasMorosidade || 30,
          GOOGLE_FORMS_SPREADSHEET_ID: e.googleFormsSpreadsheetId || '',
          GOOGLE_FORMS_SHEET_NAME: e.googleFormsSheetName || '',
          GOOGLE_CLIENT_ID: e.googleClientId || '',
          APP_VERSION: e.appVersion || ''
        })),
        Usuarios: appState.usuarios.map(u => ({
          ID: u.id,
          NOME: u.nome,
          EMAIL: u.email,
          ROLE: u.permissao,
          PERMISSAO: u.permissao,
          STATUS: u.status || 'Ativo',
          ID_ESCRITORIO: u.escritoriosIds && u.escritoriosIds.length > 0 ? u.escritoriosIds[0] : '',
          FOTO_URL: u.fotoUrl || '',
          ESCRITORIOS_IDS: u.escritoriosIds ? u.escritoriosIds.join(',') : '',
          CARGO: u.cargo || '',
          CONTATO: u.contato || '',
          SENHA: u.senha || '',
          OAB: u.oab || '',
          CPF: u.cpf || '',
          // User-specific settings
          THEME: u.theme || '',
          ITEMS_PER_PAGE: u.itemsPerPage || '',
          MENU_ORDER: u.menuOrder ? JSON.stringify(u.menuOrder) : '',
          ENABLE_NOTIFICATIONS: u.enableNotifications ? 'TRUE' : 'FALSE'
        })),
        Etiquetas: appState.etiquetas.map(e => ({
          ID: e.id,
          NOME: e.nome,
          COR: e.cor || '',
          ID_ESCRITORIO: e.escritorioId
        })),
        Calendario: appState.calendario.map(c => ({
          ID: c.id,
          TJ: c.tj,
          DATA: formatDateForSheet(c.data),
          DESCRICAO: c.descricao,
          ID_ESCRITORIO: c.escritorioId
        })),
        Leads: (appState.leads || []).map(l => ({
          ID: l.id,
          NUMERO: l.numero || '',
          CLASSE: l.classe || '',
          TRIBUNAL: l.tribunal || '',
          ORGAO: l.orgao || '',
          PARTES: l.partes || '',
          ADVOGADOS: l.advogados || '',
          DISPONIBILIZACAO: formatDateForSheet(l.disponibilizacao),
          PUBLICACAO: formatDateForSheet(l.publicacao),
          DATA_CADASTRO: formatDateForSheet(l.dataCadastro),
          STATUS: l.status || 'Novo',
          ID_ESCRITORIO: l.escritorioId || '',
          RESUMO: l.resumo || '',
          PRIORIDADE: l.prioridade || 'Média'
        })),
        leads_status: (appState.leadsStatus || []).map(s => ({
          ID: s.id,
          NOME: s.nome,
          COR: s.cor || '#3B82F6',
          ID_ESCRITORIO: s.escritorioId || s.idEscritorio || 'x'
        })),
        // Observação de Integridade: Tabela Logs não é enviada em saveAll para garantir que o histórico
        // de auditoria seja estritamente acumulativo (append-only) via saveLogToScript, evitando qualquer exclusão acidental.
        Permissoes: (() => {
          try {
            // Try current settings first
            let rawPermissions = appState.settings.permissions;
            let perms: any[] = [];

            const parsePerms = (input: any): any[] => {
              if (!input) return [];
              try {
                if (typeof input === 'string') {
                  if (input.trim() === '' || input === '[]' || input === '{}') return [];
                  const parsed = JSON.parse(input);
                  return Array.isArray(parsed) ? parsed : [];
                }
                return Array.isArray(input) ? input : [];
              } catch (e) {
                // If it's a legacy comma-separated string, we can't easily convert to the new complex structure here
                // but we should at least not return [] if we know it has value.
                // However, the new structure requires role, menus, actions.
                return [];
              }
            };

            perms = parsePerms(rawPermissions);
            
            // If current is empty, try to find ANY valid permissions from allSettings to avoid wiping global sheet
            if (perms.length === 0 && appState.allSettings) {
              console.log('Current permissions empty, searching in allSettings fallback...');
              for (const s of appState.allSettings) {
                const found = parsePerms(s.permissions);
                if (found.length > 0) {
                  perms = found;
                  console.log('Found fallback permissions in office:', s.idEscritorio);
                  break;
                }
              }
            }

            // Final fallback: if we still have nothing but the state HAD loaded previously, 
            // maybe we should be even more careful. But for now, let it be.

            if (!Array.isArray(perms) || perms.length === 0) return [];

            return perms.map((p: any) => {
              const roleName = p.role || p.ROLE || p.Categoria || p.CATEGORIA || p.categoria || '';
              const menus = p.menus || p.MENUS || p.Menus || [];
              const actions = p.actions || p.ACTIONS || p.Acoes || p.ACOES || {};
              
              return {
                CATEGORIA: roleName,
                ROLE: roleName,
                CATEGORIA_NOME: roleName,
                MENUS: typeof menus === 'string' ? menus : JSON.stringify(menus),
                ACOES: typeof actions === 'string' ? actions : JSON.stringify(actions)
              };
            }).filter(p => !!p.CATEGORIA);
          } catch (e) {
            console.error('Error parsing permissions for save:', e);
            return [];
          }
        })(),
        Configuracoes: (appState.allSettings && appState.allSettings.length > 0 ? appState.allSettings : [appState.settings]).map(s => ({
          ID_ESCRITORIO: s.idEscritorio || '',
          ITEMS_PER_PAGE: s.itemsPerPage || 10,
          TIMEZONE: s.timezone || 'America/Sao_Paulo',
          PERMISSIONS: typeof s.permissions === 'string' ? s.permissions : JSON.stringify(s.permissions || []),
          PERMISSOES: typeof s.permissions === 'string' ? s.permissions : JSON.stringify(s.permissions || []),
          MENU_ORDER: JSON.stringify(s.menuOrder || []),
          EMAIL_USER: s.emailUser || '',
          EMAIL_PASS: s.emailPass || '',
          USE_EXTERNAL_SMTP: s.useExternalSmtp ? 'TRUE' : 'FALSE',
          SMTP_HOST: s.smtpHost || '',
          SMTP_PORT: s.smtpPort || 465,
          SMTP_SECURE: s.smtpSecure ? 'TRUE' : 'FALSE',
          ENABLE_EMAIL_NOTIFICATIONS: s.enableEmailNotifications ? 'TRUE' : 'FALSE',
          EMAIL_WEEKLY_REPORT: s.emailWeeklyReport ? 'TRUE' : 'FALSE',
          EMAIL_DAILY_REPORT: s.emailDailyReport ? 'TRUE' : 'FALSE',
          EMAIL_NEW_NOTIFICATIONS: s.emailNewNotifications ? 'TRUE' : 'FALSE',
          TEMPLATE_WEEKLY_REPORT: s.templateWeeklyReport || '',
          TEMPLATE_DAILY_REPORT: s.templateDailyReport || '',
          TEMPLATE_NEW_NOTIFICATIONS: s.templateNewNotifications || '',
          EMAIL_DISPATCH_TIME: s.emailDispatchTime || '08:00',
          SHOW_MOVIMENTOS: s.showMovimentos !== false ? 'TRUE' : 'FALSE',
          DIAS_MOROSIDADE: s.diasMorosidade || 30,
          GOOGLE_CLIENT_ID: s.googleClientId || '',
          APP_VERSION: s.appVersion || ''
        }))
      }
    };

    // Duplicate data into payload key for script compatibility
    (payload as any).payload = payload.data;

    const url = scriptUrl.trim();
    
    if (!url.startsWith('https://script.google.com/')) {
      throw new Error('A URL do script deve começar com https://script.google.com/');
    }

    if (!url.includes('/exec')) {
      console.warn('A URL do script parece estar incorreta. Certifique-se de usar a URL de "Implantação" que termina em /exec');
    }

    // Usamos um timeout para a requisição
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 120000); // Aumentado para 120 segundos (2 minutos) para lidar com grandes volumes de dados

    try {
      const response = await fetch(url, {
        method: 'POST',
        // Important: Using 'text/plain' or just omitting 'Content-Type' often avoids simple CORS preflights
        // which can fail with GAS redirects.
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok && response.status !== 0) { // status 0 can happen with no-cors or opaque redirects
        throw new Error(`HTTP status: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      try {
        const result = JSON.parse(text);
        return result.status === 'success' || result.success || true;
      } catch (e) {
        // Fallback: if we got a response but it wasn't JSON, it might be a redirect page or success message
        console.warn('Response was not JSON:', text);
        return true;
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error('Fetch detailed error:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        throw new Error('Tempo limite de 120s atingido ao salvar. A planilha pode ser muito grande.');
      }
      
      if (fetchError.message === 'Failed to fetch') {
        throw new Error('Erro de Conexão (Failed to fetch). Verifique se a URL do script está correta, se o script foi implantado como "App da Web" e se o acesso foi configurado para "Qualquer pessoa".');
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('Erro ao salvar dados no Apps Script:', error);
    throw error;
  }
};
