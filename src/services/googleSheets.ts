import Papa from 'papaparse';
import { AppState, Contato, Processo, Evento, Movimento, Transacao, Documento, Vara, Usuario, Tarefa, Julgador, Servidor, Recurso, UPJ, Escritorio, Modelo, Tribunal, Forum, Etiqueta, TipoEnvolvimento, Calendario, Lead, LeadStatus, DEFAULT_LEAD_STATUSES, LogRegistro } from '../types';

/**
 * Extrai o ID da planilha do Google Sheets a partir de uma URL completa ou retorna o próprio ID se já for um ID.
 */
export const extractSpreadsheetId = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
};

const getSheetUrl = (spreadsheetId: string, sheetName: string) => 
  `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&headers=1&t=${Date.now()}`;

/**
 * Gera um ID único e consistente para novos registros
 */
export const generateId = (type: 'processo' | 'usuario' | 'tarefa' | 'financeiro' | 'default' = 'default') => {
  const alphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const numeric = '0123456789';
  
  let prefix = '';
  let chars = alphanumeric;
  let length = 6;

  switch (type) {
    case 'processo':
      prefix = 'PROC_';
      length = 8;
      break;
    case 'usuario':
      prefix = 'USER_';
      chars = numeric;
      length = 6;
      break;
    case 'tarefa':
      prefix = 'TAR_';
      length = 8;
      chars = alphanumeric;
      break;
    case 'financeiro':
      prefix = 'FIN_';
      length = 8;
      break;
    default:
      return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result.toUpperCase();
};

const isCorrectSheetHeaders = (sheetName: string, headers: string[]): boolean => {
  if (!headers || headers.length === 0) return true;

  const hSet = new Set(headers.map(h => h.trim().toUpperCase()));
  
  // Generic Fallback Checks
  const isFallbackEscritorio = hSet.has('CNPJ') && (hSet.has('PRIMARY_COLOR') || hSet.has('LOGO_URL') || hSet.has('BACKGROUND_COLOR'));
  const isFallbackUsuarios = hSet.has('SENHA') && (hSet.has('PERMISSAO') || hSet.has('ROLE') || hSet.has('CARGO'));

  if (sheetName !== 'escritorio' && isFallbackEscritorio) {
    return false;
  }
  if (sheetName !== 'Usuarios' && isFallbackUsuarios) {
    return false;
  }

  // Specific sheet validation
  if (sheetName === 'Processos') {
    return hSet.has('NUMERO') || hSet.has('NÚMERO') || hSet.has('CLIENTE_ID') || hSet.has('VARA_ID') || hSet.has('ASSUNTO') || hSet.has('DATA_DISTRIBUICAO') || hSet.has('ID_TRIBUNAL') || hSet.has('CLASSE') || hSet.has('PASTA') || hSet.has('TIPO_PROCESSO') || hSet.has('VALOR_CAUSA');
  }

  if (sheetName === 'Contatos') {
    return hSet.has('TELEFONE') || hSet.has('TIPO') || hSet.has('RG') || hSet.has('CPF_CNPJ') || hSet.has('APELIDO');
  }

  return true;
};

const isHtmlResponse = (data: any[]): boolean => {
  if (!data || data.length === 0) return false;
  const firstRow = data[0];
  const keys = Object.keys(firstRow || {});
  return keys.some(key => {
    const k = String(key).toLowerCase();
    return (
      k.includes('<!doctype') ||
      k.includes('<html') ||
      k.includes('<xml') ||
      k.includes('<div') ||
      k.includes('<script') ||
      k.includes('<head') ||
      k.includes('<body') ||
      k.includes('google-site-verification')
    );
  });
};

const fetchCsv = async (spreadsheetId: string, sheetName: string): Promise<any[] | null> => {
  // Tentar o nome original e variações comuns (com/sem acento)
  const variations = [sheetName];
  if (sheetName === 'Usuarios') variations.push('Usuários', 'USUARIOS', 'USUÁRIOS', 'Users', 'USUARIO', 'USUÁRIO', 'Login', 'LOGINS', 'CAD_USUARIOS', 'CAD_USUARIO');
  if (sheetName === 'Configuracoes') variations.push('Configurações', 'CONFIGURACOES', 'CONFIGURAÇÕES', 'Settings', 'Config', 'Ajustes', 'CAD_CONFIG', 'PARAMETROS');
  if (sheetName === 'Julgadores') variations.push('Julgador', 'JULGADORES', 'JULGADOR', 'Magistrados', 'Juízes', 'JUIZES', 'MAGISTRADOS');
  if (sheetName === 'Varas') variations.push('Vara', 'VARAS', 'VARA', 'Juízo', 'Unidade', 'VARA_NOME');
  if (sheetName === 'Escritorios' || sheetName === 'escritorio') variations.push('Escritório', 'Escritorio', 'ESCRITORIO', 'ESCRITÓRIO', 'Escritórios', 'ESCRITÓRIOS', 'Empresa', 'Dados do Escritório', 'CONFIG', 'CAD_ESCRITORIO');
  if (sheetName === 'Eventos') variations.push('EVENTOS', 'EVENTO', 'Agenda', 'AGENDA', 'Compromissos', 'CALENDARIO_EVENTOS');
  if (sheetName === 'Permissoes') variations.push('Permissões', 'PERMISSOES', 'PERMISSÕES', 'Acessos', 'ACESSOS', 'Niveis', 'NIVEIS', 'CARGOS', 'FUNÇÕES', 'FUNCOES', 'ROLES');
  if (sheetName === 'Tarefas') variations.push('TAREFA', 'TAREFAS', 'Tasks', 'TASK', 'Agenda de Tarefas', 'Prazos', 'PRAZOS', 'Diligências', 'DILIGENCIAS', 'PRAZO');
  if (sheetName === 'Contatos') variations.push('CONTATO', 'CONTATOS', 'Clientes', 'CLIENTES', 'Pessoas', 'PESSOAS', 'PARCEIROS');
  if (sheetName === 'Processos') variations.push('PROCESSO', 'PROCESSOS', 'Processo', 'Ações', 'ACOES', 'Ação', 'Pasta', 'PASTAS', 'Processos Ativos', 'LISTA_PROCESSOS', 'Lista de Processos', 'Juridico', 'Cases', 'CAD_PROCESSOS');
  if (sheetName === 'Financeiro') variations.push('FINANCEIRO', 'Caixa', 'CAIXA', 'Contas', 'Fluxo', 'Lançamentos', 'CAD_FINANCEIRO');
  if (sheetName === 'Forum') variations.push('FORUM', 'FÓRUM', 'Fórum', 'Forums', 'Fóruns', 'Foro', 'Fóros', 'Comarca', 'Comarcas');
  if (sheetName === 'tribunal') variations.push('tribunais', 'Tribunal', 'TRIBUNAL', 'Tribunais', 'TRIBUNAIS', 'Lista de Tribunais', 'TRIBUNAIS_CNJ', 'Siglas', 'ID_TRIBUNAL', 'TRIB', 'CAD_TRIB');
  if (sheetName === 'calendario') variations.push('Calendário', 'CALENDÁRIO', 'CALENDARIO', 'AgendaJudicial', 'CalendarioJudicial');
  if (sheetName === 'Modelos') variations.push('MODELOS', 'modelos', 'Modelo', 'MODELO', 'Modelos de Documentos', 'Modelos_Documentos');
  if (sheetName === 'Documentos') variations.push('DOCUMENTOS', 'documentos', 'Documento', 'DOCUMENTO', 'Docs', 'DOCS', 'Gerador de Documentos', 'Gerador_Documentos');
  if (sheetName === 'Logs') variations.push('LOGS', 'logs', 'Log', 'Historico', 'Histórico', 'AUDITORIA', 'Auditoria');
  // Only accept 'Etiquetas' with absolutely no variations as requested

  let sheetExists = false;

  for (const name of variations) {
    try {
      const data = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(getSheetUrl(spreadsheetId, name), {
          download: true,
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim().toUpperCase(),
          complete: (results) => {
            if (results.data && results.data.length > 0) {
              if (isHtmlResponse(results.data)) {
                console.warn(`HTML content detected instead of CSV for sheet ${sheetName} with variation ${name}. Ignoring.`);
                resolve([]);
                return;
              }
              const firstRow = results.data[0];
              const headers = Object.keys(firstRow || {});
              if (isCorrectSheetHeaders(sheetName, headers)) {
                sheetExists = true;
                resolve(results.data);
              } else {
                console.warn(`Header validation failed for sheet ${sheetName} with variation ${name}. Skipping.`);
                resolve([]);
              }
            } else {
              // Checar se existem headers em meta para validar se é uma planilha vazia com colunas certas
              const headers = results.meta?.fields || [];
              if (headers.length > 0) {
                if (isCorrectSheetHeaders(sheetName, headers.map(h => h.toUpperCase()))) {
                  sheetExists = true;
                  resolve([]);
                } else {
                  console.warn(`Header validation failed for empty sheet ${sheetName} with variation ${name}. Skipping.`);
                  resolve([]);
                }
              } else {
                // Totalmente vazia, sem colunas
                sheetExists = true;
                resolve([]);
              }
            }
          },
          error: (error: any) => {
            reject(error);
          }
        });
      });
      
      // Se encontramos dados, retornamos imediatamente
      if (data && data.length > 0) return data;
      
      // Se a planilha existe mas está vazia, continuamos tentando outras variações
      // mas guardamos que ela existe
    } catch (e) {
      // Erro de rede ou planilha não existe
    }
  }
  
  if (sheetExists) {
    return []; // Planilha existe mas está vazia em todas as variações
  }
  
  console.warn(`Aba ${sheetName} não encontrada após tentar variações.`);
  return null; // Planilha não encontrada
};

const parseDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (!str) return '';
  
  // Se for um número (timestamp ou serial do Excel)
  if (/^\d{5,}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    // Se for um número grande, assume timestamp em ms
    if (num > 1000000000000) {
      const d = new Date(num);
      return d.toISOString().split('T')[0];
    }
    // Se for entre 30000 e 60000, provavelmente é Serial Date do Excel
    if (num > 30000 && num < 60000) {
      const d = new Date((num - 25569) * 86400 * 1000);
      return d.toISOString().split('T')[0];
    }
  }

  // Handle DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
  const normalizedStr = str.replace(/[.\/]/g, '-');
  const parts = normalizedStr.split(' ')[0].split('-');
  
  if (parts.length === 3) {
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];
    
    // YYYY-MM-DD format already
    if (day.length === 4) {
      year = day;
      month = month;
      day = parts[2];
    } else {
      if (year.length === 2) year = '20' + year;
      // Flip if it's MM-DD-YYYY or if month > 12 it's DD-MM-YYYY (most likely in Brazil)
      if (parseInt(month) > 12) {
        const temp = day;
        day = month;
        month = temp;
      }
    }
    
    // Ensure 2 digits
    const m = month.padStart(2, '0');
    const d = day.padStart(2, '0');
    const y = year;
    
    // Basic validation
    if (parseInt(m) > 0 && parseInt(m) <= 12 && parseInt(d) > 0 && parseInt(d) <= 31 && y.length === 4) {
      return `${y}-${m}-${d}`;
    }
  }
  
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {
    // ignore
  }
  return '';
};

const parseDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (!str) return '';
  
  if (str.includes('/') && str.includes(':')) {
    return str;
  }

  if (str.includes('-')) {
    const mainParts = str.split('T');
    const dateParts = mainParts[0].split('-');
    if (dateParts.length === 3) {
      const year = dateParts[0];
      const month = dateParts[1];
      const day = dateParts[2];
      const timePart = mainParts[1] ? mainParts[1].split('.')[0] : (str.includes(' ') ? str.split(' ')[1] : '');
      const formattedDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      return timePart ? `${formattedDate} ${timePart}` : formattedDate;
    }
  }

  const parsedD = parseDate(str);
  if (parsedD && parsedD.includes('-')) {
    const [y, m, d] = parsedD.split('-');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  
  return str;
};

const parseDateTimeToISO = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (!str) return '';

  // If already in YYYY-MM-DDTHH:MM format
  if (str.includes('T')) {
    const parts = str.split('T');
    if (parts[0].split('-').length === 3 && parts[0].split('-')[0].length === 4) {
      return str.substring(0, 16);
    }
  }

  // Handle DD/MM/YYYY HH:MM (Brazilian format)
  if (str.includes('/')) {
    const mainParts = str.split(' ');
    const dateParts = mainParts[0].split('/');
    if (dateParts.length === 3) {
      const day = dateParts[0].padStart(2, '0');
      const month = dateParts[1].padStart(2, '0');
      const year = dateParts[2];
      const formattedDate = `${year}-${month}-${day}`;
      
      const timePart = mainParts[1] ? mainParts[1].substring(0, 5) : '';
      return timePart ? `${formattedDate}T${timePart}` : formattedDate;
    }
  }

  // Fallback to parseDate
  const parsedD = parseDate(str); // Returns YYYY-MM-DD or ''
  if (parsedD) {
    if (str.includes(' ')) {
      const parts = str.split(' ');
      const timePart = parts[1] && parts[1].includes(':') ? parts[1].substring(0, 5) : '';
      if (timePart) {
        return `${parsedD}T${timePart}`;
      }
    }
    return parsedD;
  }

  return str;
};

const parseCurrency = (valStr: any) => {
  if (valStr === undefined || valStr === null) return 0;
  const str = String(valStr).trim();
  if (!str) return 0;
  // Remove $ and spaces
  let cleanStr = str.replace(/\$|\s/g, '');
  // If it has both . and , (like 1.000,00)
  if (cleanStr.includes('.') && cleanStr.includes(',')) {
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
  } else if (cleanStr.includes(',')) {
    // Just comma (like 450,00)
    cleanStr = cleanStr.replace(',', '.');
  }
  const val = parseFloat(cleanStr);
  return isNaN(val) ? 0 : val;
};

// Helper function to check if a row is essentially empty
const isEmptyRow = (row: any): boolean => {
  if (!row || typeof row !== 'object') return true;
  return Object.values(row).every(val => val === null || val === undefined || String(val).trim() === '');
};

export const importFromGoogleSheets = async (spreadsheetId: string, coreOnly: boolean = false): Promise<Partial<AppState>> => {
  const sId = extractSpreadsheetId(spreadsheetId);
  if (!sId) return {};

  console.log(`Iniciando importação ${coreOnly ? 'ESSENCIAL' : 'TOTAL'} da planilha:`, sId);

  try {
    const allSheets = [
      { name: 'Contatos', key: 'contatos', core: false },
      { name: 'Processos', key: 'processos', core: false },
      { name: 'Eventos', key: 'eventos', core: false },
      { name: 'Movimentos', key: 'movimentos', core: false },
      { name: 'Financeiro', key: 'financeiro', core: false },
      { name: 'Documentos', key: 'documentos', core: false },
      { name: 'Varas', key: 'varas', core: false },
      { name: 'Tarefas', key: 'tarefas', core: false },
      { name: 'escritorio', key: 'escritorios', core: true },
      { name: 'Usuarios', key: 'usuarios', core: true },
      { name: 'Modelos', key: 'modelos', core: false },
      { name: 'Julgadores', key: 'julgadores', core: false },
      { name: 'Recursos', key: 'recursos', core: false },
      { name: 'UPJ', key: 'upj', core: false },
      { name: 'Forum', key: 'forums', core: false },
      { name: 'tribunal', key: 'tribunais', core: false },
      { name: 'Servidores', key: 'servidores', core: false },
      { name: 'Envolvidos', key: 'envolvidos', core: false },
      { name: 'Etiquetas', key: 'etiquetas', core: false },
      { name: 'envolvidos_tipo', key: 'tipoEnvolvimentos', core: false },
      { name: 'calendario', key: 'calendario', core: false },
      { name: 'Leads', key: 'leads', core: false },
      { name: 'leads_status', key: 'leadsStatus', core: false },
      { name: 'Logs', key: 'logs', core: false },
      { name: 'Permissoes', key: 'permissoes', core: true },
      { name: 'Configuracoes', key: 'settings', core: true }
    ];

    const sheetsToFetch = coreOnly ? allSheets.filter(s => s.core) : allSheets;

    const results = await Promise.all(
      sheetsToFetch.map(sheet => fetchCsv(sId, sheet.name))
    );

    let contatosData, processosData, eventosData, movimentosData, financeiroData, documentosData, varasData, tarefasData, escritoriosData, usuariosData, modelosData, julgadoresData, recursosData, upjData, forumData, tribunaisData, servidoresData, envolvidosData, etiquetasData, tipoEnvolvimentosData, calendarioData, leadsData, leadsStatusData, logsData, permissoesData, settingsData;

    if (coreOnly) {
      [escritoriosData, usuariosData, permissoesData, settingsData] = results;
    } else {
      [
        contatosData,
        processosData,
        eventosData,
        movimentosData,
        financeiroData,
        documentosData,
        varasData,
        tarefasData,
        escritoriosData,
        usuariosData,
        modelosData,
        julgadoresData,
        recursosData,
        upjData,
        forumData,
        tribunaisData,
        servidoresData,
        envolvidosData,
        etiquetasData,
        tipoEnvolvimentosData,
        calendarioData,
        leadsData,
        leadsStatusData,
        logsData,
        permissoesData,
        settingsData
      ] = results;
    }

    console.log('Dados brutos carregados:', {
      contatos: contatosData?.length || 0,
      processos: processosData?.length || 0,
      eventos: eventosData?.length || 0,
      movimentos: movimentosData?.length || 0,
      financeiro: financeiroData?.length || 0,
      documentos: documentosData?.length || 0,
      varas: varasData?.length || 0,
      tarefas: tarefasData?.length || 0,
      escritorios: escritoriosData?.length || 0,
      usuarios: usuariosData?.length || 0,
      modelos: modelosData?.length || 0,
      julgadores: julgadoresData?.length || 0,
      recursos: recursosData?.length || 0,
      upj: upjData?.length || 0,
      forum: forumData?.length || 0,
      tribunais: tribunaisData?.length || 0,
      envolvidos: envolvidosData?.length || 0,
      calendario: calendarioData?.length || 0,
      leads: leadsData?.length || 0
    });
    
    const getRobustId = (row: any, keys: string[], type: 'processo' | 'usuario' | 'tarefa' | 'financeiro' | 'default' = 'default') => {
      for (const key of keys) {
        const val = row[key];
        if (val !== undefined && val !== null && val.toString().trim() !== '') {
          const id = val.toString().trim().toUpperCase();
          // Log if ID looks like it might have been truncated if it's purely numeric but user expected alpha
          // (Just a hint for debugging)
          return id;
        }
      }
      const newId = generateId(type);
      console.log(`ID não encontrado para ${type}, gerado novo: ${newId}`);
      return newId;
    };

    const getOfficeId = (row: any) => {
      const val = (
        row.ESCRITORIOS_IDS ||
        row['ESCRITORIOS IDS'] ||
        row.ESCRITÓRIOS_IDS ||
        row['ESCRITÓRIOS IDS'] ||
        row.ESCRITORIO_IDS ||
        row['ESCRITORIO IDS'] ||
        row.ESCRITÓRIO_IDS ||
        row['ESCRITÓRIO IDS'] ||
        row.ID_ESCRITORIO || 
        row['ID ESCRITORIO'] || 
        row.ID_ESCRITÓRIO || 
        row['ID ESCRITÓRIO'] || 
        row.ID_ESCRITORIOS ||
        row['ID ESCRITORIOS'] ||
        row.ID_ESCRITÓRIOS ||
        row['ID ESCRITÓRIOS'] ||
        row.ID_ESC ||
        row.ID_ESC_NOME ||
        row.IDESCRITORIO || 
        row.IDESCRITÓRIO ||
        row.ESCRITORIO ||
        row.ESCRITÓRIO ||
        row.ID_OFFICE ||
        row.OFFICE_ID ||
        row.escritorioId ||
        ''
      );
      if (!val) return '';
      return val.toString().trim().toUpperCase();
    };

    const contatos: Contato[] = (contatosData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      let tipo: Contato['tipo'] = 'Cliente';
      const rowTipo = (row.TIPO || row.tipo || '').toString().toLowerCase();
      if (rowTipo.includes('cliente')) tipo = 'Cliente';
      else tipo = 'Contato';

      let statusCivil = (row.STATUS_CIVIL || row['STATUS_CIVIL'] || row['STATUS CIVIL'] || '').toString().trim();
      let status = (row.STATUS || row.status || '').toString().trim();
      
      if (!statusCivil && status) {
        const lower = status.toLowerCase();
        if (lower === 'solteiro' || lower === 'casado' || lower === 'divorciado' || lower === 'viúvo' || lower === 'viuvo' || lower === 'união estável' || lower === 'uniao estavel') {
          statusCivil = status;
          status = 'Ativo';
        }
      }

      return {
        id: getRobustId(row, ['ID', 'ID_CONTATO', 'CONTATO_ID', 'IDCONTATO', 'ID_CLIENTE']),
        nome: (row.NOME || row.NOME_CONTATO || '').toString().trim() || 'Sem Nome',
        apelido: (row.APELIDO || '').toString().trim(),
        statusCivil,
        status: status || 'Ativo',
        profissao: (row.PROFISSAO || row.PROFISSÃO || row.PROFISSÃO_NOME || row.PROFISSAO_NOME || '').toString().trim(),
        rg: (row.RG || '').toString().trim(),
        cpfCnpj: (row.CPF || row.CNPJ || row['CPF/CNPJ'] || row['CPF_CNPJ'] || row.CPF_CNPJ || '').toString().trim(),
        endereco: (row['ENDEREÇO'] || row.ENDERECO || row.ENDEREÇO_NOME || row.ENDERECO_NOME || '').toString().trim(),
        cep: (row.CEP || row.cep || '').toString().trim(),
        municipio: (row.MUNICIPIO || row.MUNICÍPIO || row.municipio || row.município || row.CIDADE || row.cidade || '').toString().trim(),
        estado: (row.ESTADO || row.estado || row.UF || row.uf || '').toString().trim(),
        telefone: (row.CONTATO || row.telefone || row.TELEFONE || row.FONE || '').toString().trim(),
        email: (row.EMAIL || row.email || '').toString().trim(),
        tipo,
        escritorioId: getOfficeId(row),
        dataCadastro: parseDateTime(row.DATA_CADASTRO || row.CADASTRO || row.DATA || ''),
        observacoes: (row.OBSERVACOES || row.OBSERVAÇÕES || row.observacoes || row.observacao || '').toString().trim(),
        dadosPagamento: (row.DADOS_PAGAMENTO || row['DADOS_PAGAMENTO'] || row['DADOS PAGAMENTO'] || row.DADOS_PAGAMENTO_NOME || row.dados_pagamento || '').toString().trim()
      };
    });

    const processos: Processo[] = (processosData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      let status: Processo['status'] = 'Ativo';
      const rowStatus = (row.ATIVO || row.STATUS || row['SITUAÇÃO'] || row.SITUACAO || '').toString().toLowerCase();
      
      if (
        rowStatus.includes('inativo') || 
        rowStatus.includes('arquivado') || 
        rowStatus.includes('encerrado') ||
        rowStatus.includes('suspenso') ||
        rowStatus === 'n' ||
        rowStatus === 'não' ||
        rowStatus === 'nao' ||
        rowStatus === '0' ||
        rowStatus === 'false'
      ) {
        status = 'Inativo';
      }

      // Aggressive ID search
      let foundId = '';
      const idKeys = ['ID_PROC', 'ID PROC', 'IDPROC', 'ID_PROCESSO', 'ID PROCESSO', 'PROCESSO_ID', 'PROCESSO ID', 'ID_SISTEMA', 'ID SISTEMA', 'ID'];
      for (const key of idKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          foundId = row[key].toString().trim().toUpperCase();
          break;
        }
      }
      
      if (!foundId) {
        // Look for any key that contains ID and PROC or SISTEMA
        for (const key of Object.keys(row)) {
          const upperKey = key.toUpperCase();
          if ((upperKey.includes('ID') && (upperKey.includes('PROC') || upperKey.includes('SISTEMA'))) || upperKey === 'ID') {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
              foundId = row[key].toString().trim().toUpperCase();
              break;
            }
          }
        }
      }
      const idProc = foundId;

      const numero = (
        row.NUMERO || 
        row.NÚMERO || 
        row['NÚMERO DO PROCESSO'] || 
        row['NUMERO DO PROCESSO'] ||
        row.NUMERO_PROCESSO || 
        row.NÚMERO_PROCESSO ||
        row.CNJ ||
        ''
      ).toString().trim() || idProc || 'Sem Número';

      // Extract parte contraria from column if exists, otherwise from Titulo
      let titulo = row.TITULO || row.TÍTULO || row.NOME || row.PROCESSO || row.OBJETO || '';
      let parteContraria = row.PARTE_CONTRARIA || row['PARTE CONTRÁRIA'] || row['PARTE CONTRARIA'] || '';
      
      if (!parteContraria) {
        parteContraria = titulo;
        if (parteContraria.includes(' X ')) {
          parteContraria = parteContraria.split(' X ')[1];
        } else if (parteContraria.includes(' x ')) {
          parteContraria = parteContraria.split(' x ')[1];
        }
      }

      const envIdsRaw = row.ENVOLVIDOS || row.ENVOLVIDOS_IDS || row.ENVOLVIDOSIDS || '';

      return {
        id: idProc || generateId('processo'),
        numero: numero,
        clienteId: (
          row.ID_CLIENTE || 
          row['ID CLIENTE'] || 
          row.IDCLIENTE || 
          row.CLIENTE_ID || 
          row['CLIENTE ID'] ||
          ''
        ).toString().trim().toUpperCase(),
        parteContraria: (parteContraria || 'Não informada').toString().trim(),
        tribunal: (
          row.VARA || 
          row.TRIBUNAL || 
          row.FORUM || 
          row.FÓRUM || 
          row.JUÍZO || 
          row.JUIZO || 
          ''
        ).toString().trim(),
        status,
        dataDistribuicao: parseDate(row.DATA_DISTRIBUICAO || row.DATA_ABERTURA || row.DISTRIBUICAO || row.DISTRIBUIÇÃO || row.DATA || row['DATA DISTRIBUIÇÃO'] || row['DATA DISTRIBUICAO']),
        escritorioId: getOfficeId(row),
        idProc: idProc,
        tipo: row.TIPO_PROCESSO || row.TIPO || row.CLASSE || '',
        titulo: titulo,
        instancia: row.INSTANCIA || row.INSTÂNCIA || '',
        varaId: (row.VARA_ID || row.ID_VARA || row.VARA || row.TRIBUNAL || '').toString().trim().toUpperCase(),
        classe: row.CLASSE || '',
        assunto: row.ASSUNTO || '',
        valorCausa: parseCurrency(row.VALOR_CAUSA || row['VALOR DA CAUSA'] || row.VALOR || row.VALOR_ACAO),
        resultado: row.RESULTADO || '',
        ativo: row.ATIVO || '',
        link: row.LINK || row.URL_PROCESSO || row.URL || '',
        tags: row.ETIQUETAS || row.TAGS || '',
        pasta: row.PASTA || '',
        tribunalId: (row.ID_TRIBUNAL || row.TRIBUNAL_ID || row.ID_TJ || row.id_tj || '').toString().trim().toUpperCase(),
        forumId: (row.ID_FORUM || '').toString().trim().toUpperCase(),
        advogadoId: (row.ADVOGADO_ID || '').toString().trim().toUpperCase(),
        upjId: (row.ID_UPJ || '').toString().trim().toUpperCase(),
        servidorId: (row.ID_SERVIDOR || '').toString().trim().toUpperCase(),
        envolvidosIds: (envIdsRaw && typeof envIdsRaw === 'string') ? envIdsRaw.split(',').map((id: string) => id.trim()).filter(Boolean) : []
      };
    });

    const eventos: Evento[] = (eventosData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      let tipo: Evento['tipo'] = 'Outro';
      const rowTipo = (row.TIPO || '').toLowerCase();
      if (rowTipo.includes('audiência') || rowTipo.includes('audiencia')) tipo = 'Audiência';
      else if (rowTipo.includes('prazo')) tipo = 'Prazo';
      else if (rowTipo.includes('reunião') || rowTipo.includes('consulta')) tipo = 'Reunião';
      else if (rowTipo.includes('perícia') || rowTipo.includes('pericia')) tipo = 'Outro';

      return {
        id: getRobustId(row, ['ID_EVENTO', 'ID']),
        titulo: row.EVENTO || row.TITULO || row.TÍTULO || row.TIPO || 'Evento',
        data: parseDateTimeToISO(row['DATA.HORA'] || row['DATA/HORA'] || row.DATA_HORA || row.DATA || row['DATA HORA']),
        tipo,
        processoId: (row.ID_PROC || row.ID_PROCESSO || row.PROCESSO_ID || '').toString().trim().toUpperCase(),
        usuarioId: (row.ID_USER || row.ID_USUARIO || row.USUARIO_ID || '').toString().trim().toUpperCase(),
        observacoes: row.OBSERVACOES || row.OBSERVAÇÕES || row.OBS || '',
        concluido: (row.STATUS || row.CONCLUIDO || row.CONCLUÍDO || '').toString().toLowerCase().includes('concluido') || 
                   (row.STATUS || row.CONCLUIDO || row.CONCLUÍDO || '').toString().toLowerCase().includes('concluído') ||
                   (row.STATUS || row.CONCLUIDO || row.CONCLUÍDO || '').toString().toLowerCase() === 'sim' ||
                   (row.STATUS || row.CONCLUIDO || row.CONCLUÍDO || '').toString().toLowerCase() === '1' ||
                   (row.STATUS || row.CONCLUIDO || row.CONCLUÍDO || '').toString().toLowerCase() === 'true',
        escritorioId: getOfficeId(row),
        link: row.LINK || row.link || ''
      };
    });

    const movimentos: Movimento[] = [];
    const processedMovIds = new Set<string>();

    const mapMovimentacao = (row: any, index: number, source: string) => {
      // Robust search for Process ID
      const procId = (
        row.ID_PROC || 
        row['ID PROC'] ||
        row.ID_PROCESSO || 
        row['ID PROCESSO'] ||
        row.IDPROC || 
        row.IDPROCESSO ||
        row.PROCESSO_ID || 
        row['PROCESSO ID'] ||
        row['ID DO PROCESSO'] || 
        row['ID_PROCESSO'] ||
        row.NUMERO ||
        row.NÚMERO ||
        row.CNJ ||
        ''
      ).toString().trim().toUpperCase();

      // Robust search for Data
      const data = parseDate(
        row.DATA || 
        row.DATA_MOVIMENTACAO || 
        row.MOVIMENTAÇÃO_DATA || 
        row.DATA_HORA || 
        row['DATA/HORA'] || 
        row.DATA_HORA_MOV ||
        row.DH_MOV ||
        row.MOVIMENTACAO_DATA ||
        row['DATA MOVIMENTACAO'] ||
        row['DATA DA MOVIMENTAÇÃO'] ||
        row.DATA_MOV ||
        row['DATA MOV'] ||
        ''
      );

      // Robust search for Descrição
      const descricao = (
        row.MOVIMENTACAO || 
        row.MOVIMENTAÇÃO || 
        row.DESCRICAO || 
        row.DESCRIÇÃO || 
        row.MOVIMENTO || 
        row.TEXTO || 
        row.EVENTO ||
        row.HISTORICO ||
        row.HISTÓRICO ||
        ''
      ).toString().trim();

      const id = (row.ID_MOVIMENTO || row.ID || row.ID_MOV || row.ID_MOVIMENTACAO || `mov_${source}_${procId}_${index}`).toString().trim();
      
      if (!processedMovIds.has(id)) {
        processedMovIds.add(id);
        return {
          id,
          processoId: procId,
          data: data,
          descricao: descricao,
          pagina: (row.PAGINA || row.PÁGINA || row.PAG || '').toString().trim(),
          usuarioId: (row.ID_USUARIO || row.ID_USER || row.USUARIO_ID || row.USUARIO || row.RESPONSAVEL || row['RESPONSÁVEL'] || '').toString().trim(),
          escritorioId: getOfficeId(row)
        };
      }
      return null;
    };

    (movimentosData || []).filter(row => !isEmptyRow(row)).forEach((row, i) => {
      const mapped = mapMovimentacao(row, i, 'movimentos');
      if (mapped) movimentos.push(mapped);
    });

    const financeiro: Transacao[] = (financeiroData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      const valor = parseCurrency(row.VALOR);
      const contactId = (row.CONTATO_ID || row.ID_CONTATO || row.CLIENTE_ID || row.ID_CLIENTE || '').toString().trim().toUpperCase();
      return {
        id: getRobustId(row, ['ID_FINANCEIRO', 'ID'], 'financeiro'),
        tipo: (row.TIPO || '').toLowerCase().includes('despesa') || valor < 0 ? 'Despesa' : 'Receita',
        valor: Math.abs(valor),
        data: parseDate(row.DATA),
        descricao: row.DESCRICAO || row.DESCRIÇÃO || row.TIPO || 'Transação',
        processoId: (row.ID_PROC || row.ID_PROCESSO || '').toString().trim().toUpperCase(),
        contatoId: contactId,
        clienteId: contactId,
        status: (row.STATUS || '').toString().toLowerCase().includes('penden') ? 'Pendente' : 'Pago',
        escritorioId: getOfficeId(row),
        usuarioId: (row.ID_USER || row.ID_USUARIO || '').toString().trim().toUpperCase(),
        observacoes: row.OBSERVACOES || row.OBSERVAÇÕES || ''
      };
    });

    const documentos: Documento[] = (documentosData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      let tipo = row.TIPO || row.CATEGORIA || row.MODELO || 'Outro';
      return {
        id: getRobustId(row, ['ID_DOC', 'ID_DOCUMENTO', 'ID']),
        titulo: row.TITULO || row.TITULO_DOCUMENTO || row.NOME || row.MODELO || 'Documento',
        tipo: tipo as any,
        processoId: (row.PROCESSO_ID || row.ID_PROC || row.ID_PROCESSO || '').toString().trim().toUpperCase(),
        dataCriacao: row.DATA_CRIACAO || row.DATA_UPLOAD || row.DATA || new Date().toISOString().split('T')[0],
        conteudo: row.CONTEUDO || row.CONTEÚDO || row.ARQUIVO || row.TEXTO || '',
        escritorioId: getOfficeId(row) || 'x',
        url: (row.URL || row.LINK || '').toString().trim(),
        dataUpload: (row.DATA_UPLOAD || row.DATA_CRIACAO || '').toString().trim()
      };
    });

    const varas: Vara[] = (varasData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      return {
        id: (row.ID_VARA || row.ID || '').toString().trim().toUpperCase() || generateId(),
        nome: (row.VARA_NOME || row.NOME || '').toString().trim() || 'Sem Nome',
        forum: (row.ID_FORUM || row.FORUM || '').toString().trim().toUpperCase(),
        localizacao: (row.LOCALIZACAO || row.LOCALIZAÇÃO || '').toString().trim(),
        telefone: (row.TEL01 || row.TELEFONE || '').toString().trim(),
        email: (row.EMAIL01 || row.EMAIL || '').toString().trim(),
        balcaoVirtual: (row.BALCAO01 || row.BALCAO || '').toString().trim(),
        juiz: (row.JUIZ || '').toString().trim(),
        juiz_2: (row.JUIZ_2 || '').toString().trim(),
        id_servidores: row.ID_SERVIDORES ? row.ID_SERVIDORES.toString().split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean) : [],
        escritorioId: getOfficeId(row),
        idTj: (row.ID_TJ || row.id_tj || '').toString().trim().toUpperCase()
      };
    });

    const servidores: Servidor[] = (servidoresData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      return {
        id: getRobustId(row, ['ID_SERVIDOR', 'ID']),
        nome: row.NOME || row.SERVIDOR || 'Sem Nome',
        cargo: row.CARGO || '',
        email: row.EMAIL || '',
        telefone: row.TELEFONE || row.TEL || '',
        escritorioId: getOfficeId(row)
      };
    });

    const usuarios: Usuario[] = (usuariosData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      const email = (
        row.USUARIO_EMAIL || 
        row['USUARIO EMAIL'] || 
        row.EMAIL || 
        row['E-MAIL'] || 
        row.USUARIO || 
        row['USUÁRIO'] || 
        row.LOGIN ||
        ''
      ).toString().trim();

      const senha = (
        row.SENHA || 
        row.PASSWORD || 
        row.PASS || 
        row.SENHAS ||
        ''
      ).toString().trim();

      const nome = (
        row.NOME || 
        row.USUARIO_NOME || 
        row['NOME USUARIO'] || 
        row['NOME DO USUÁRIO'] ||
        ''
      ).toString().trim();

      const logoUrl = (row.LOGO_URL || row.LOGO || row.logo_url || '').toString().trim();

      return {
        id: getRobustId(row, [
          'ID_USER', 
          'ID USER', 
          'IDUSER', 
          'ID'
        ], 'usuario'),
        nome: nome || email.split('@')[0] || 'Sem Nome',
        cargo: row.CARGO || row.FUNCAO || row['FUNÇÃO'] || '',
        email,
        contato: row.CONTATO || row.TELEFONE || row.CELULAR || '',
        senha,
        oab: row.OAB || '',
        cpf: row.CPF || '',
        fotoUrl: row.FOTO_URL || row.FOTO || '',
        permissao: row.PERMISSAO || row.PERMISSÃO || row.NIVEL || row['NÍVEL'] || row.ROLE || row.ACESSO || row.CATEGORIA || '',
        escritoriosIds: (() => {
          const rawVal = (
            row.ESCRITORIOS_IDS ||
            row['ESCRITORIOS IDS'] ||
            row.ESCRITORIO_IDS ||
            row['ESCRITORIO IDS'] ||
            row.ESCRITÓRIOS_IDS ||
            row['ESCRITÓRIOS IDS'] ||
            row.ESCRITÓRIO_IDS ||
            row['ESCRITÓRIO IDS'] ||
            row.ID_ESCRITORIO ||
            row['ID ESCRITORIO'] ||
            row.ID_ESCRITÓRIO ||
            row['ID ESCRITÓRIO'] ||
            row.ID_ESC ||
            row.escritorioId ||
            ''
          ).toString().trim().toUpperCase();
          return rawVal ? rawVal.split(',').map((id: string) => id.trim()).filter(Boolean) : [];
        })(),
        // User-specific settings
        theme: (row.THEME || '').toString().toLowerCase() === 'dark' ? 'dark' : (row.THEME || '').toString().toLowerCase() === 'system' ? 'system' : (row.THEME ? 'light' : undefined) as any,
        itemsPerPage: parseInt(row.ITEMS_PER_PAGE || '0') || undefined,
        menuOrder: (() => {
          try {
            const val = row.MENU_ORDER;
            if (val && typeof val === 'string' && val.startsWith('[')) return JSON.parse(val);
            return undefined;
          } catch (e) { return undefined; }
        })(),
        enableNotifications: row.ENABLE_NOTIFICATIONS === 'TRUE' || row.ENABLE_NOTIFICATIONS === 'true' || undefined
      };
    });

    const tarefas: Tarefa[] = (tarefasData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      const titulo = (row.TITULO || row.TÍTULO || row.TAREFA || row.DESCRICAO || row.DESCRIÇÃO || '').toString().trim();
      const responsavelId = (row.RESPONSAVEL_ID || row.ID_USER || row['ID USER'] || row.USUARIO_ID || '').toString().trim().toUpperCase();
      const processoId = (row.PROCESSO_ID || row.ID_PROC || row['ID PROC'] || row.ID_PROCESSO || row.IDPROC || '').toString().trim().toUpperCase();
      const varaId = (row.VARA_ID || row.ID_VARA || row['ID VARA'] || '').toString().trim().toUpperCase();
      const dataCriacao = parseDate(row.DATA_CRIACAO || row.PRAZO_IN || row['PRAZO INICIO'] || row.INICIO || row.INÍCIO);
      const dataLimite = parseDate(row.DATA_LIMITE || row.PRAZO_FIM || row['PRAZO FIM'] || row.FIM || row.PRAZO || row.VENCIMENTO);

      return {
        // Primary new fields
        ID_TAREFA: getRobustId(row, ['ID_TAREFA', 'ID TAREFA', 'ID'], 'tarefa'),
        TITULO: titulo,
        DESCRICAO: (row.DESCRICAO || row.DESCRIÇÃO || '').toString().trim(),
        STATUS: (row.STATUS || '').toString().trim(),
        PRIORIDADE: (row.PRIORIDADE || '').toString().trim(),
        DATA_LIMITE: dataLimite,
        RESPONSAVEL_ID: responsavelId,
        PROCESSO_ID: processoId,
        ID_ESCRITORIO: getOfficeId(row),
        DATA_CRIACAO: dataCriacao,
        PROC_NOME: (row.PROC_NOME || row['PROC.NOME'] || row['NOME PROCESSO'] || row.PROCESSO || row.NUMERO || row.NÚMERO || '').toString().trim(),
        VARA_ID: varaId,
        VARA_NOME: (row.VARA_NOME || row['VARA.NOME'] || row['VANA.NOME'] || row['NOME VARA'] || row.VARA || '').toString().trim(),
        UPJ_NOME: (row.UPJ_NOME || row['UPJ NOME'] || row.UPJ || '').toString().trim(),
        ATRIBUIDO_ID: (row.ATRIBUIDO_ID || row.atribuido_id || row.ATRIBUIDO || '').toString().trim().toUpperCase(),
        
        // Compatibility fields
        id: (row.ID_TAREFA || row.ID).toString(),
        TAREFA: titulo,
        PRAZO_IN: dataCriacao,
        PRAZO_FIM: dataLimite,
        ID_PROC: processoId,
        'PROC.NOME': (row['PROC.NOME'] || row.PROC_NOME || row['NOME PROCESSO'] || row.PROCESSO || row.NUMERO || row.NÚMERO || '').toString().trim(),
        ID_VARA: varaId,
        'VARA.NOME': (row['VARA.NOME'] || row.VARA_NOME || row['VANA.NOME'] || row['NOME VARA'] || row.VARA || '').toString().trim(),
        ID_USER: responsavelId,
        CONCLUSAO: (row.CONCLUSAO || row.CONCLUSÃO || '').toString().trim(),
        PAGINA: (row.PAGINA || row.PÁGINA || row.PAG || '').toString().trim(),
        LINK: (row.LINK || '').toString().trim(),
        prazo_tipo: (row.prazo_tipo || row['tipo_prazo'] || row['TIPO_PRAZO'] || row['PRAZO_TIPO'] || 'Corridos').toString().trim()
      };
    });

    const julgadores: Julgador[] = (julgadoresData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      return {
        ...row,
        id: getRobustId(row, ['ID', 'ID_JULGADOR']),
        nome: row.NOME || row.JULGADOR || 'Sem Nome',
        escritorioId: getOfficeId(row)
      };
    });

    const recursos: Recurso[] = (recursosData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      const envIdsRaw = row.ENVOLVIDOS || row.ENVOLVIDOS_IDS || row.ENVOLVIDOSIDS || '';
      return {
        id: getRobustId(row, ['ID', 'ID_RECURSO', 'RECURSO_ID']),
        processoOriginarioId: row.PROCESSO_ORIGIN || '',
        recursoOriginario: row['REC.ORIGINARIO'] || '',
        classe: row.CLASSE || '',
        assunto: row.ASSUNTO || '',
        secao: row.SECAO || '',
        orgaoJulgadorId: row['ORGAO JULGADOR'] || '',
        area: row.AREA || '',
        relatorId: row.RELATOR || '',
        link: row.LINK || '',
        marcador: row.MARCADOR || '',
        resultado: row.RESULTADO || '',
        status: (row.ATIVO || '').toLowerCase() === 'inativo' ? 'Inativo' : 'Ativo',
        escritorioId: getOfficeId(row),
        envolvidosIds: (envIdsRaw && typeof envIdsRaw === 'string') ? envIdsRaw.split(',').map((id: string) => id.trim()).filter(Boolean) : []
      };
    });

    const upj: UPJ[] = (upjData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      return {
        id: getRobustId(row, ['ID', 'ID_UPJ', 'UPJ_ID']),
        nome: row.NOME || 'Sem Nome',
        email: row.EMAIL || '',
        email1: row.EMAIL1 || '',
        whatsapp: row.WHATSAPP || '',
        telefone: row.TELEFONE || '',
        diretor: row.DIRETOR || '',
        balcao: row.BALCAO || '',
        localizacao: row.LOCALIZACAO || '',
        escritorioId: getOfficeId(row)
      };
    });

    const escritorios: Escritorio[] = (escritoriosData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      const theme = (row.THEME || 'light').toString().toLowerCase() === 'dark' ? 'dark' : 'light';
      return {
        id: getRobustId(row, [
          'ID_ESCRITORIO', 
          'ID ESCRITORIO', 
          'ID_ESCRITÓRIO', 
          'ID ESCRITÓRIO', 
          'IDESCRITORIO', 
          'IDESCRITÓRIO', 
          'ID'
        ]),
        nome: row.Escritorio_nome || row.ESCRITORIO_NOME || row['ESCRITORIO NOME'] || row.NOME || 'Sem Nome',
        endereco: row.escritorio_end || row.ESCRITORIO_END || row['ESCRITORIO END'] || row.ENDERECO || row.ENDEREÇO || '',
        usuariosId: row.Escritorio_usuarios_id || row.ESCRITORIO_USUARIOS_ID || row['ESCRITORIO USUARIOS ID'] || '',
        responsavel: row.RESPONSAVEL || row.RESPONSÁVEL || row.responsavel || row.resposavel || row.ADVOGADO || '',
        oab: row.OAB || row.oab || row.OAB_NUMBER || row['Nº OAB'] || '',
        uf: row.UF || row.uf || '',
        cnpj: row.CNPJ || row.cnpj || '',
        theme,
        primaryColor: row.primary_color || row.PRIMARY_COLOR || '#4f46e5',
        backgroundColor: row.background_color || row.BACKGROUND_COLOR || row.backgroud_color || (theme === 'dark' ? '#020617' : '#ffffff'),
        secondaryColor: row.secondary_color || row.SECONDARY_COLOR || (theme === 'dark' ? '#0f172a' : '#f3f4f6'),
        logoUrl: row.LOGO_URL || row.LOGO || row.logo_url || '',
        timezone: row.TIMEZONE || '',
        itemsPerPage: parseInt(row.ITEMS_PER_PAGE || '0') || 0,
        menuOrder: (() => {
          try {
            const val = row.MENU_ORDER || row.ORDEM_MENU;
            if (val && typeof val === 'string' && val.startsWith('[')) return JSON.parse(val);
            return [];
          } catch (e) { return []; }
        })(),
        emailUser: row.EMAIL_USER || '',
        emailPass: row.EMAIL_PASS || '',
        useExternalSmtp: row.USE_EXTERNAL_SMTP === 'TRUE',
        smtpHost: row.SMTP_HOST || '',
        smtpPort: parseInt(row.SMTP_PORT || '0') || 0,
        smtpSecure: row.SMTP_SECURE === 'TRUE',
        enableEmailNotifications: row.ENABLE_EMAIL_NOTIFICATIONS === 'TRUE',
        emailWeeklyReport: row.EMAIL_WEEKLY_REPORT === 'TRUE',
        emailDailyReport: row.EMAIL_DAILY_REPORT === 'TRUE',
        emailNewNotifications: row.EMAIL_NEW_NOTIFICATIONS === 'TRUE',
        templateWeeklyReport: row.TEMPLATE_WEEKLY_REPORT || '',
        templateDailyReport: row.TEMPLATE_DAILY_REPORT || '',
        templateNewNotifications: row.TEMPLATE_NEW_NOTIFICATIONS || '',
        emailDispatchTime: row.EMAIL_DISPATCH_TIME || '08:00',
        showMovimentos: row.SHOW_MOVIMENTOS === 'TRUE' || row.SHOW_MOVIMENTOS === undefined,
        diasMorosidade: parseInt(row.DIAS_MOROSIDADE || '0') || 0,
        googleFormsSpreadsheetId: row.GOOGLE_FORMS_SPREADSHEET_ID || '',
        googleFormsSheetName: row.GOOGLE_FORMS_SHEET_NAME || '',
        googleClientId: row.GOOGLE_CLIENT_ID || row.CLIENT_ID || '',
        appVersion: (row.APP_VERSION || row.VERSAO_SISTEMA || row.VERSAO_MINIMA || row.VERSAO || row.VERSION || '').toString().trim()
      };
    });

    const modelos: Modelo[] = (modelosData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      return {
        id: getRobustId(row, ['ID_MODELO', 'ID']),
        escritorioId: (
          row.ID_ESCRITORIO || 
          row['ID ESCRITORIO'] || 
          row.ID_ESCRITÓRIO || 
          row['ID ESCRITÓRIO'] || 
          row.ID_ESC || 
          row.IDESCRITORIO || 
          row.IDESCRITÓRIO ||
          ''
        ).toString().trim() || 'x',
        nome: row.NOME_MODELO || row.NOME || row.TITULO || row.MODELO || 'Sem Nome',
        fase: row.FASE_MODELO || row.FASE || '',
        materia: row.MATERIA || row.MATÉRIA || '',
        link: row.LINK || row.URL || row.ARQUIVO || ''
      };
    });

    const tribunais: Tribunal[] = (tribunaisData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      const sigla = (row.SIGLA || row.sigla || '').toString().trim();
      const id = (row.ID_TJ || row.id_tj || row.ID_SIGLA || row.id_sigla || sigla || '').toString().trim();
      const nome = (row.NOME || row.nome || '').toString().trim();
      
      return {
        id: id || generateId(),
        sigla: sigla,
        nome: nome || sigla || id || 'Sem Nome'
      };
    });

    const forums: Forum[] = (forumData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      const id = (row.ID_FORUM || row.ID || '').toString().trim().toUpperCase();
      const nome = (row.NOME_FORUM || row.NOME || '').toString().trim();
      const endereco = (row.ENDERECO || '').toString().trim();
      const tribunalId = (row.ID_TJ || row.id_tj || row.ID_SIGLA || row.TRIBUNAL || '').toString().trim().toUpperCase();

      return {
        id: id || generateId(),
        nome: nome || 'Sem Nome',
        endereco: endereco,
        tribunalId: tribunalId,
        escritorioId: getOfficeId(row)
      };
    });

    const envolvidos: any[] = (envolvidosData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      return {
        id: getRobustId(row, ['ID_CADASTRO', 'ID']),
        contatoId: (row.ID_CONTATO || '').toString().trim(),
        processoId: (row.ID_PROC || row.ID_ENVOLVIDOS || '').toString().trim(),
        recursoId: (row.ID_RECURSO || '').toString().trim(),
        tipoEnvolvimento: (row.TIPO_ENVOLVIMENTO || row.TIPO_ENV || '').toString().trim(),
        escritorioId: (
          row.ID_ESCRITORIO || 
          row['ID ESCRITORIO'] || 
          row.ID_ESCRITÓRIO || 
          row['ID ESCRITÓRIO'] || 
          row.ID_ESC || 
          row.IDESCRITORIO || 
          row.IDESCRITÓRIO ||
          ''
        ).toString().trim()
      };
    });

    const etiquetas: Etiqueta[] = (etiquetasData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      return {
        id: getRobustId(row, ['ID', 'ID_ETIQUETA', 'ETIQUETA_ID']),
        nome: (row.NOME || '').toString().trim() || 'Sem Nome',
        cor: (row.COR || '').toString().trim(),
        escritorioId: (
          row.ID_ESCRITORIO || 
          row['ID ESCRITORIO'] || 
          row.ID_ESCRITÓRIO || 
          row['ID ESCRITÓRIO'] || 
          row.ID_ESC || 
          row.IDESCRITORIO || 
          row.IDESCRITÓRIO ||
          ''
        ).toString().trim()
      };
    });

    const tipoEnvolvimentos: TipoEnvolvimento[] = (tipoEnvolvimentosData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      return {
        id: (row.id_envolvimento || row.ID_ENVOLVIMENTO || '').toString().trim() || Math.random().toString(36).substr(2, 9),
        nome: (row.nome_envolvimento || row.NOME_ENVOLVIMENTO || '').toString().trim() || 'Sem Nome'
      };
    });

    // Garantir que tipos padrão existam
    const envDefaults = [
      { id: 'apelante', nome: 'Apelante' },
      { id: 'apelado', nome: 'Apelado' }
    ];
    envDefaults.forEach(d => {
      if (!tipoEnvolvimentos.find(t => t.nome.toLowerCase() === d.nome.toLowerCase())) {
        tipoEnvolvimentos.push(d);
      }
    });

    const calendario: Calendario[] = (calendarioData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      // Robust search for ID_ESCRITORIO value
      let eid = '';
      const eidKeys = ['ID_ESCRITORIO', 'ID_ESCRITÓRIO', 'ID ESCRITORIO', 'ID ESCRITÓRIO', 'IDESCRITORIO', 'IDESCRITÓRIO', 'ID_ESC'];
      for (const key of eidKeys) {
        const upperKey = key.toUpperCase();
        if (row[upperKey] !== undefined && row[upperKey] !== null && row[upperKey] !== '') {
          eid = row[upperKey].toString().trim();
          break;
        }
      }

      return {
        id: getRobustId(row, ['ID', 'ID_CALENDARIO']),
        tj: (row.TJ || row.TRIBUNAL || '').toString().trim(),
        data: parseDate(row.DATA || row.DATA_HORA),
        descricao: (row.DESCRICAO || row.DESCRIÇÃO || row.EVENTO || '').toString().trim(),
        escritorioId: eid
      };
    });

    const leads: Lead[] = (leadsData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      let eid = '';
      const eidKeys = ['ID_ESCRITORIO', 'ID_ESCRITÓRIO', 'ID ESCRITORIO', 'ID ESCRITÓRIO', 'IDESCRITORIO', 'IDESCRITÓRIO', 'ID_ESC'];
      for (const key of eidKeys) {
        const upperKey = key.toUpperCase();
        if (row[upperKey] !== undefined && row[upperKey] !== null && row[upperKey] !== '') {
          eid = row[upperKey].toString().trim().toUpperCase();
          break;
        }
      }

      return {
        id: (row.ID_LEAD || row.ID || '').toString().trim().toUpperCase() || generateId(),
        numero: (row.NUMERO || row.NÚMERO || row.PROCESSO || '').toString().trim(),
        classe: (row.CLASSE || '').toString().trim(),
        tribunal: (row.TRIBUNAL || '').toString().trim(),
        orgao: (row.ORGAO || row.ÓRGÃO || row.VARA || '').toString().trim(),
        partes: (row.PARTES || '').toString().trim(),
        advogados: (row.ADVOGADOS || '').toString().trim(),
        disponibilizacao: parseDate(row.DISPONIBILIZACAO || row.DISPONIBILIZAÇÃO || ''),
        publicacao: parseDate(row.PUBLICACAO || row.PUBLICAÇÃO || ''),
        dataCadastro: parseDate(row.DATA_CADASTRO || row.CADASTRO || ''),
        status: (row.STATUS || 'Novo').toString().trim() as Lead['status'],
        escritorioId: eid,
        resumo: (row.RESUMO || row.resumo || '').toString().trim(),
        prioridade: (row.PRIORIDADE || row.prioridade || 'Média').toString().trim() as Lead['prioridade']
      };
    });

    const leadsStatus: LeadStatus[] = (leadsStatusData || []).filter(row => !isEmptyRow(row)).map((row: any) => {
      let eid = '';
      const eidKeys = ['ID_ESCRITORIO', 'ID_ESCRITÓRIO', 'ID ESCRITORIO', 'ID ESCRITÓRIO', 'IDESCRITORIO', 'IDESCRITÓRIO', 'ID_ESC'];
      for (const key of eidKeys) {
        const upperKey = key.toUpperCase();
        if (row[upperKey] !== undefined && row[upperKey] !== null && row[upperKey] !== '') {
          eid = row[upperKey].toString().trim();
          break;
        }
      }

      const idVal = getRobustId(row, ['ID', 'ID_STATUS', 'ID_LEADS_STATUS']);
      const nomeVal = (row.NOME || row.STATUS || row.NOME_STATUS || '').toString().trim();
      const corVal = (row.COR || row.COLOR || '').toString().trim();

      return {
        id: idVal || (nomeVal ? nomeVal.toLowerCase().replace(/\s+/g, '_') : Math.random().toString(36).substring(2, 9)),
        nome: nomeVal || 'Novo',
        cor: corVal || '#3B82F6',
        escritorioId: eid || 'x',
        idEscritorio: eid || 'x'
      };
    });

    DEFAULT_LEAD_STATUSES.forEach(d => {
      if (!leadsStatus.find(s => s.nome.toLowerCase() === d.nome.toLowerCase())) {
        leadsStatus.push(d);
      }
    });

    const logs: LogRegistro[] = (logsData || []).filter(row => !isEmptyRow(row)).map((row: any, idx: number) => {
      let eid = '';
      const eidKeys = ['ID_ESCRITORIO', 'ID_ESCRITÓRIO', 'ID ESCRITORIO', 'ID ESCRITÓRIO', 'IDESCRITORIO', 'IDESCRITÓRIO', 'ID_ESC'];
      for (const key of eidKeys) {
        const upperKey = key.toUpperCase();
        if (row[upperKey] !== undefined && row[upperKey] !== null && row[upperKey] !== '') {
          eid = row[upperKey].toString().trim();
          break;
        }
      }

      return {
        id: (row.ID || row.id || `LOG_${idx}`).toString().trim(),
        data: (row.Data || row.data || row.DATA || row.TIMESTAMP || row.timestamp || '').toString().trim(),
        usuario: (row.Usuario || row.usuario || row.USUARIO || '').toString().trim(),
        acao: (row.Acao || row.acao || row.ACAO || '').toString().trim(),
        idEscritorio: eid,
        detalhes: (row.Detalhes || row.detalhes || row.DETALHES || '').toString().trim()
      };
    });

    // Parse permissions
    let permissions = '';
    if (permissoesData && permissoesData.length > 0) {
      const firstRow = permissoesData[0];
      // Try to get JSON from JSON or PERMISSOES column (old format in new sheet)
      const rawJson = firstRow.JSON || firstRow.PERMISSOES || firstRow.permissoes;
      
      if (rawJson && typeof rawJson === 'string' && rawJson.startsWith('[')) {
        try {
          const parsed = JSON.parse(rawJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            permissions = rawJson;
          }
        } catch (e) {}
      }
      
      // If still empty, it's structured as rows
      if (!permissions) {
        const validRoles = permissoesData.filter((r: any) => {
          const roleName = r.CATEGORIA || r.ROLE || r.ROLE_NAME || r.CATEGORIA_NOME || r.categoria || r.role || '';
          return roleName && roleName.toString().trim() !== '';
        });
        if (validRoles.length > 0) {
          permissions = JSON.stringify(validRoles);
        }
      }
    }

    // Parse settings
    let settings: any = {};
    let allSettings: any[] = [];
    if (settingsData && settingsData.length > 0) {
      allSettings = settingsData.filter(row => !isEmptyRow(row)).map((row: any) => {
        // Find permission fallback if current row is empty but we have global permissions
        let rowPerms = (row.PERMISSIONS && row.PERMISSIONS !== '[object Object]' && row.PERMISSIONS !== 'undefined' && row.PERMISSIONS !== 'null') 
          ? row.PERMISSIONS 
          : (row.PERMISSOES || row.PERMISSAO || '');
          
        if ((!rowPerms || rowPerms === '[]') && (permissions && permissions !== '[]')) {
          rowPerms = permissions;
        }

        return {
          idEscritorio: (row.ID_ESCRITORIO || row.ID_ESCRITÓRIO || row.id_escritorio || '').toString().trim().toUpperCase(),
          itemsPerPage: parseInt(row.ITEMS_PER_PAGE || row.ITENS_POR_PAGINA || '10') || 10,
          timezone: row.TIMEZONE || row.FUSO_HORARIO || 'America/Sao_Paulo',
          permissions: rowPerms || '[]',
          menuOrder: (() => {
            try {
              const val = row.MENU_ORDER || row.ORDEM_MENU;
              if (val && typeof val === 'string' && val.startsWith('[')) {
                return JSON.parse(val);
              }
              return [];
            } catch (e) {
              return [];
            }
          })(),
          emailUser: row.EMAIL_USER || row.EMAIL_USUARIO || '',
          emailPass: row.EMAIL_PASS || row.EMAIL_SENHA || '',
          useExternalSmtp: row.USE_EXTERNAL_SMTP === 'TRUE' || row.USE_SMTP === 'TRUE',
          smtpHost: row.SMTP_HOST || '',
          smtpPort: parseInt(row.SMTP_PORT || '465') || 465,
          smtpSecure: row.SMTP_SECURE === 'TRUE',
          enableEmailNotifications: row.ENABLE_EMAIL_NOTIFICATIONS === 'TRUE' || row.EMAIL_NOTIFICATIONS === 'TRUE',
          emailWeeklyReport: row.EMAIL_WEEKLY_REPORT === 'TRUE',
          emailDailyReport: row.EMAIL_DAILY_REPORT === 'TRUE',
          emailNewNotifications: row.EMAIL_NEW_NOTIFICATIONS === 'TRUE' || row.NEW_NOTIFICATIONS === 'TRUE',
          templateWeeklyReport: row.TEMPLATE_WEEKLY_REPORT || '',
          templateDailyReport: row.TEMPLATE_DAILY_REPORT || '',
          templateNewNotifications: row.TEMPLATE_NEW_NOTIFICATIONS || '',
          emailDispatchTime: row.EMAIL_DISPATCH_TIME || '08:00',
          showMovimentos: row.SHOW_MOVIMENTOS === 'TRUE' || row.SHOW_MOVIMENTOS === undefined,
          diasMorosidade: parseInt(row.DIAS_MOROSIDADE || row.MOROSIDADE || '30') || 30,
          googleClientId: row.GOOGLE_CLIENT_ID || row.CLIENT_ID || '',
          appVersion: (row.APP_VERSION || row.VERSAO_SISTEMA || row.VERSAO_MINIMA || row.VERSAO || row.VERSION || '').toString().trim()
        };
      });

      // Force all offices to use the exact same global permissions to keep them fully synchronized
      const globalBestPerms = permissions && permissions !== '[]' && permissions !== 'undefined'
        ? permissions
        : (allSettings.find(s => s.permissions && s.permissions !== '[]')?.permissions || '[]');
      allSettings = allSettings.map(s => ({
        ...s,
        permissions: globalBestPerms
      }));

      // Default settings is the first one or empty
      settings = allSettings.length > 0 ? allSettings[0] : {
        idEscritorio: '',
        itemsPerPage: 10,
        timezone: 'America/Sao_Paulo',
        permissions: permissions || '[]',
        menuOrder: []
      };
    }

    // --- RESOLVE ASSOCIATIONS (Names to IDs) ---
    
    // 1. Resolve Varas -> Forum (Tribunal ID)
    varas.forEach(v => {
      if (v.forum && !tribunais.some(t => t.id === v.forum)) {
        const found = tribunais.find(t => t.nome.toLowerCase() === v.forum.toLowerCase());
        if (found) v.forum = found.id;
      }
    });

    // 2. Resolve Varas -> Juiz (Julgador ID)
    varas.forEach(v => {
      if (v.juiz && !julgadores.some(j => j.id === v.juiz)) {
        const found = julgadores.find(j => j.nome.toLowerCase() === v.juiz.toLowerCase());
        if (found) v.juiz = found.id;
      }
      if (v.juiz_2 && !julgadores.some(j => j.id === v.juiz_2)) {
        const found = julgadores.find(j => j.nome.toLowerCase() === v.juiz_2.toLowerCase());
        if (found) v.juiz_2 = found.id;
      }
    });

    // 4. Resolve Processos -> Cliente (Contato ID)
    processos.forEach(p => {
      if (p.clienteId && !contatos.some(c => c.id === p.clienteId)) {
        const found = contatos.find(c => c.nome.toLowerCase() === p.clienteId.toLowerCase());
        if (found) p.clienteId = found.id;
      }
    });

    // 5. Resolve Processos -> Vara (Vara ID)
    processos.forEach(p => {
      if (p.varaId && !varas.some(v => v.id === p.varaId)) {
        const found = varas.find(v => v.nome.toLowerCase() === p.varaId.toLowerCase());
        if (found) p.varaId = found.id;
      }
    });

    // 6. Resolve Tarefas -> Vara (Vara ID)
    tarefas.forEach(t => {
      if (t.ID_VARA && !varas.some(v => v.id === t.ID_VARA)) {
        const found = varas.find(v => v.nome.toLowerCase() === t.ID_VARA.toLowerCase());
        if (found) t.ID_VARA = found.id;
      }
    });

    // 7. Resolve Tarefas -> User (Usuario ID)
    tarefas.forEach(t => {
      if (t.ID_USER && !usuarios.some(u => u.id === t.ID_USER)) {
        const found = usuarios.find(u => u.nome.toLowerCase() === t.ID_USER.toLowerCase());
        if (found) t.ID_USER = found.id;
      }
    });

    // 8. Resolve Recursos -> Relator (Julgador ID)
    recursos.forEach(r => {
      if (r.relatorId && !julgadores.some(j => j.id === r.relatorId)) {
        const found = julgadores.find(j => j.nome.toLowerCase() === r.relatorId.toLowerCase());
        if (found) r.relatorId = found.id;
      }
    });

    const finalResult: any = {
      contatos,
      processos,
      eventos,
      movimentos,
      financeiro,
      documentos,
      varas,
      tarefas,
      escritorios,
      usuarios,
      pendencias: [],
      modelos,
      julgadores,
      recursos,
      upj,
      envolvidos,
      tribunais,
      forums,
      servidores,
      etiquetas,
      tipoEnvolvimentos,
      calendario,
      leads,
      leadsStatus,
      logs,
      settings,
      allSettings
    };

    // Only return keys that were successfully fetched
    const filteredResult: Partial<AppState> = {};
    sheetsToFetch.forEach((sheet, index) => {
      if (results[index] !== null) {
        const key = sheet.key as keyof AppState;
        if (finalResult[key] !== undefined) {
          (filteredResult as any)[key] = finalResult[key];
        }
      }
    });

    filteredResult.allSettings = allSettings;

    return filteredResult;
  } catch (error) {
    console.error('Error importing from Google Sheets:', error);
    throw error;
  }
};

/**
 * Importa respostas de um formulário Google Forms a partir da planilha de respostas vinculada.
 */
export const importFromGoogleForms = async (
  spreadsheetId: string,
  sheetName: string = 'Respostas ao formulário 1'
): Promise<Partial<Contato>[]> => {
  const sId = extractSpreadsheetId(spreadsheetId);
  if (!sId) return [];

  const url = getSheetUrl(sId, sheetName);
  
  try {
    let responseText = '';
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Servidor retornou status ${response.status} (${response.statusText})`);
      }
      responseText = await response.text();
      
      // Se retornar HTML de login do Google ou página não encontrada
      if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
        throw new Error("A resposta não é um arquivo de dados válido. Isso geralmente ocorre se a planilha for privada ou o ID/Nome da Aba estiver incorreto.");
      }
    } catch (fetchErr: any) {
      console.error('Erro de rede ao baixar planilha do Forms:', fetchErr);
      throw new Error(`Não foi possível acessar a planilha de respostas do Google Forms.\n\n` +
                      `Causa provável:\n` +
                      `1. A planilha não foi compartilhada publicamente ("Qualquer pessoa com o link pode ler").\n` +
                      `2. O ID da planilha ou nome da aba ("${sheetName}") está incorreto.\n\n` +
                      `Detalhes adicionais: ${fetchErr.message || fetchErr.toString()}`);
    }

    const rawData = await new Promise<any[]>((resolve, reject) => {
      Papa.parse(responseText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            resolve(results.data);
          } else {
            resolve([]);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });

    if (rawData.length === 0) return [];

    // Mapeia cada linha para um objeto de Contato
    return rawData.map((row: any) => {
      const keys = Object.keys(row);
      
      const findValueByKeyword = (keywords: string[]): string => {
        const foundKey = keys.find(k => {
          const normK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return keywords.some(kw => {
            const normKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return normK.includes(normKw);
          });
        });
        return foundKey ? String(row[foundKey]).trim() : '';
      };

      const nome = findValueByKeyword(['nome completo', 'nome', 'name', 'cliente', 'usuario']) || 
                   String(row[keys[1]] || '').trim(); // Fallback para a segunda coluna caso não encontre

      const email = findValueByKeyword(['email', 'e-mail', 'mail']);
      const telefone = findValueByKeyword(['telefone', 'whatsapp', 'celular', 'phone', 'contato', 'tel']);
      const cpfCnpj = findValueByKeyword(['cpf', 'cnpj', 'cpf_cnpj', 'cpf/cnpj', 'documento']);
      const rg = findValueByKeyword(['rg', 'registro geral', 'identidade']);
      const endereco = findValueByKeyword(['endereco', 'endereço', 'address', 'rua', 'logradouro']);
      const cep = findValueByKeyword(['cep', 'codigo postal']);
      const municipio = findValueByKeyword(['municipio', 'município', 'cidade', 'city']);
      const estado = findValueByKeyword(['estado', 'uf', 'state']);
      const statusCivil = findValueByKeyword(['status civil', 'estado civil', 'civil']);
      const profissao = findValueByKeyword(['profissao', 'profissão', 'cargo', 'ocupacao', 'job', 'occupation']);
      const dadosPagamento = findValueByKeyword(['chave pix', 'pix', 'pagamento', 'dados de pagamento', 'dados_pagamento', 'dados pagamento', 'conta']);
      const resumoFatos = findValueByKeyword([
        'resumo dos fatos', 
        'resumo do fato', 
        'resumo de fatos', 
        'resumo fatos', 
        'relato dos fatos', 
        'relato de fatos',
        'descricao dos fatos',
        'descrição dos fatos',
        'resumo', 
        'fatos',
        'observacoes',
        'observações',
        'obs'
      ]);

      const observacoes = resumoFatos || '';

      return {
        nome: nome || 'Contato sem Nome',
        email,
        telefone,
        cpfCnpj,
        rg,
        endereco,
        cep,
        municipio,
        estado,
        statusCivil,
        profissao,
        dadosPagamento,
        tipo: 'Cliente' as const,
        status: 'Ativo' as const,
        observacoes,
        dataCadastro: findValueByKeyword(['timestamp', 'carimbo', 'data', 'hora', 'criado']) || new Date().toLocaleString('pt-BR')
      };
    });
  } catch (error: any) {
    console.error('Erro ao importar respostas do Google Forms:', error);
    throw error;
  }
};

