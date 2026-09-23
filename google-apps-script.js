/**
 * SISTEMA JURÍDICO - SCRIPT DE SINCRONIZAÇÃO (VERSÃO SEGURA ANTI-WIPE E MULTI-USUÁRIO)
 * v12.1 - Adicionado suporte a GOOGLE_CLIENT_ID nas tabelas Escritorios e Configuracoes para autenticação Google OAuth 2.0.
 * v12.0 - Adicionado suporte a salvamento atômico (upsert/delete item),
 *         LockService para concorrência multiusuário,
 *         e ZeroWipeGuard para impedir que tabelas existentes sejam apagadas por sincronizações vazias.
 * v11.2 - Adicionado suporte a tabela leads_status e gerenciamento de status de leads.
 * v11.1 - Adicionado um campo dados_pagamento na tabela contatos.
 * v11 - Adicionado modulo no leads em modo tabela e prioridade em leads. 
 */

var CONFIG = {
  VERSION: "12.1.0",
  DEFAULT_COLUMNS: {
    'Escritorios': ['ID', 'NOME', 'CNPJ', 'ENDERECO', 'TELEFONE', 'EMAIL', 'LOGO_URL', 'RESPONSAVEL', 'OAB', 'UF', 'THEME', 'PRIMARY_COLOR', 'BACKGROUND_COLOR', 'SECONDARY_COLOR', 'TIMEZONE', 'ITEMS_PER_PAGE', 'MENU_ORDER', 'EMAIL_USER', 'EMAIL_PASS', 'USE_EXTERNAL_SMTP', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'ENABLE_EMAIL_NOTIFICATIONS', 'EMAIL_WEEKLY_REPORT', 'EMAIL_DAILY_REPORT', 'EMAIL_NEW_NOTIFICATIONS', 'TEMPLATE_WEEKLY_REPORT', 'TEMPLATE_DAILY_REPORT', 'TEMPLATE_NEW_NOTIFICATIONS', 'EMAIL_DISPATCH_TIME', 'SHOW_MOVIMENTOS', 'DIAS_MOROSIDADE', 'GOOGLE_FORMS_SPREADSHEET_ID', 'GOOGLE_FORMS_SHEET_NAME', 'GOOGLE_CLIENT_ID', 'APP_VERSION'],
    'Usuarios': ['ID', 'NOME', 'EMAIL', 'ROLE', 'PERMISSAO', 'STATUS', 'ID_ESCRITORIO', 'FOTO_URL', 'ESCRITORIOS_IDS', 'CARGO', 'CONTATO', 'SENHA', 'OAB', 'CPF', 'THEME', 'ITEMS_PER_PAGE', 'MENU_ORDER', 'ENABLE_NOTIFICATIONS'],
    'Contatos': ['ID', 'NOME', 'EMAIL', 'TELEFONE', 'TIPO', 'OBSERVACOES', 'ID_ESCRITORIO', 'DATA_CADASTRO', 'APELIDO', 'RG', 'CPF_CNPJ', 'ENDERECO', 'CEP', 'STATUS_CIVIL', 'STATUS', 'MUNICIPIO', 'ESTADO'],
    'Processos': ['ID', 'NUMERO', 'TITULO', 'CLIENTE_ID', 'VARA_ID', 'STATUS', 'ULTIMA_MOVIMENTACAO', 'VALOR_CAUSA', 'ID_ESCRITORIO', 'DATA_ABERTURA', 'TIPO_PROCESSO', 'URL_PROCESSO', 'LINK', 'ID_TRIBUNAL', 'ID_FORUM', 'ID_VAR', 'ADVOGADO_ID', 'ID_UPJ', 'ID_SERVIDOR', 'ASSUNTO', 'ETIQUETAS', 'INSTANCIA', 'CLASSE', 'DATA_DISTRIBUICAO', 'RESULTADO', 'PASTA'],
    'Eventos': ['ID', 'PROCESSO_ID', 'TITULO', 'DESCRICAO', 'DATA', 'TIPO', 'ID_ESCRITORIO', 'USUARIO_ID', 'CONCLUIDO', 'LINK'],
    'Movimentos': ['ID_MOVIMENTO', 'PROCESSO_ID', 'DESCRICAO', 'DATA', 'ID_USUARIO', 'ID_ESCRITORIO', 'PAGINA'],
    'Financeiro': ['ID', 'DESCRICAO', 'VALOR', 'DATA', 'TIPO', 'CATEGORIA', 'STATUS', 'ID_ESCRITORIO', 'PROCESSO_ID', 'CONTATO_ID', 'USUARIO_ID', 'OBSERVACOES'],
    'Tarefas': ['ID_TAREFA', 'TITULO', 'DESCRICAO', 'STATUS', 'PRIORIDADE', 'DATA_LIMITE', 'RESPONSAVEL_ID', 'PROCESSO_ID', 'ID_ESCRITORIO', 'DATA_CRIACAO', 'PROC_NOME', 'VARA_ID', 'VARA_NOME', 'UPJ_NOME', 'PRAZO_TIPO', 'ATRIBUIDO_ID'],
    'Documentos': ['ID', 'TITULO', 'TIPO', 'CONTEUDO', 'ID_ESCRITORIO'],
    'tribunal': ['ID_TJ', 'SIGLA', 'NOME'],
    'Forum': ['ID_FORUM', 'NOME_FORUM', 'ENDERECO', 'ID_TJ', 'ID_ESCRITORIO'],
    'Varas': ['ID_VARA', 'VARA_NOME', 'ID_FORUM', 'LOCALIZACAO', 'TEL01', 'EMAIL01', 'BALCAO01', 'JUIZ', 'JUIZ_2', 'ID_SERVIDORES', 'ID_ESCRITORIO', 'ID_TJ'],
    'Envolvidos': ['ID_CADASTRO', 'ID_CONTATO', 'ID_PROC', 'ID_RECURSO', 'TIPO_ENVOLVIMENTO', 'ID_ESCRITORIO'],
    'Modelos': ['ID', 'ID_ESCRITORIO', 'NOME_MODELO', 'FASE_MODELO', 'MATERIA', 'LINK'],
    'Etiquetas': ['ID', 'NOME', 'COR', 'ID_ESCRITORIO'],
    'Calendario': ['ID', 'TJ', 'DATA', 'DESCRICAO', 'ID_ESCRITORIO'],
    'Permissoes': ['CATEGORIA', 'ROLE', 'CATEGORIA_NOME', 'MENUS', 'ACOES'],
    'Configuracoes': ['ID_ESCRITORIO', 'ITEMS_PER_PAGE', 'TIMEZONE', 'PERMISSIONS', 'PERMISSOES', 'MENU_ORDER', 'EMAIL_USER', 'EMAIL_PASS', 'USE_EXTERNAL_SMTP', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'ENABLE_EMAIL_NOTIFICATIONS', 'EMAIL_WEEKLY_REPORT', 'EMAIL_DAILY_REPORT', 'EMAIL_NEW_NOTIFICATIONS', 'TEMPLATE_WEEKLY_REPORT', 'TEMPLATE_DAILY_REPORT', 'TEMPLATE_NEW_NOTIFICATIONS', 'EMAIL_DISPATCH_TIME', 'SHOW_MOVIMENTOS', 'DIAS_MOROSIDADE', 'GOOGLE_CLIENT_ID', 'APP_VERSION'],
    'Julgadores': ['ID_JULGADOR', 'NOME', 'CARGO', 'EMAIL', 'TELEFONE', 'ID_ESCRITORIO'],
    'Servidores': ['ID_SERVIDOR', 'NOME', 'CARGO', 'EMAIL', 'TELEFONE', 'ID_ESCRITORIO'],
    'Recursos': ['ID', 'PROCESSO_ORIGIN', 'REC.ORIGINARIO', 'CLASSE', 'ASSUNTO', 'SECAO', 'ORGAO JULGADOR', 'AREA', 'RELATOR', 'LINK', 'MARCADOR', 'RESULTADO', 'ATIVO', 'ID_ESCRITORIO', 'ENVOLVIDOS'],
    'UPJ': ['ID', 'NOME', 'EMAIL', 'EMAIL1', 'WHATSAPP', 'TELEFONE', 'DIRETOR', 'BALCAO', 'LOCALIZACAO', 'ID_ESCRITORIO'],
    'Leads': ['ID', 'NUMERO', 'CLASSE', 'TRIBUNAL', 'ORGAO', 'PARTES', 'ADVOGADOS', 'DISPONIBILIZACAO', 'PUBLICACAO', 'DATA_CADASTRO', 'STATUS', 'ID_ESCRITORIO', 'RESUMO', 'PRIORIDADE'],
    'leads_status': ['ID', 'NOME', 'COR', 'ID_ESCRITORIO'],
    'Logs': ['Data', 'Usuario', 'Acao', 'ID_ESCRITORIO', 'Detalhes']
  }
};

function getSs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.getActive();
  if (!ss) {
    throw new Error("Não foi possível encontrar a planilha ativa. Certifique-se de que o script está vinculado a uma planilha.");
  }
  return ss;
}

function findSheet(sheetName, ss) {
  var variations = [sheetName];
  if (sheetName === 'Forum') variations = ['Forum', 'Fórum', 'FORUM', 'Fóruns', 'forums'];
  if (sheetName === 'tribunal') variations = ['tribunal', 'tribunais', 'Tribunais', 'TRIBUNAIS', 'TRIBUNAL', 'Tribunal'];
  if (sheetName === 'Varas') variations = ['Varas', 'Vara', 'VARAS', 'VARA', 'varas'];
  if (sheetName === 'Processos') variations = ['Processos', 'Processo', 'PROCESSOS', 'processos'];
  if (sheetName === 'Contatos') variations = ['Contatos', 'Contato', 'CONTATOS', 'contatos'];
  if (sheetName === 'Leads') variations = ['Leads', 'leads', 'LEADS'];
  if (sheetName === 'leads_status') variations = ['leads_status', 'LEADS_STATUS', 'Leads_Status', 'Status_Leads', 'status_leads'];
  if (sheetName === 'Permissoes') variations = ['Permissoes', 'Permissões', 'PERMISSOES', 'PERMISSÕES', 'Acessos', 'ACESSOS', 'Niveis', 'NIVEIS', 'CARGOS', 'FUNÇÕES', 'FUNCOES', 'ROLES'];
  if (sheetName === 'Configuracoes') variations = ['Configuracoes', 'Configurações', 'CONFIGURACOES', 'CONFIGURAÇÕES', 'Settings', 'Config', 'Ajustes', 'CAD_CONFIG', 'PARAMETROS'];
  if (sheetName === 'Escritorios') variations = ['Escritorios', 'Escritório', 'Escritorio', 'ESCRITORIO', 'ESCRITÓRIO', 'Escritórios', 'ESCRITÓRIOS', 'Empresa', 'Dados do Escritório', 'CONFIG', 'CAD_ESCRITORIO'];
  if (sheetName === 'Usuarios') variations = ['Usuarios', 'Usuários', 'USUARIOS', 'USUÁRIOS', 'Users', 'USUARIO', 'USUÁRIO', 'Login', 'LOGINS', 'CAD_USUARIOS', 'CAD_USUARIO'];
  if (sheetName === 'Envolvidos') variations = ['Envolvidos', 'ENVOLVIDOS', 'envolvidos'];
  if (sheetName === 'Etiquetas') variations = ['Etiquetas', 'ETIQUETAS', 'etiquetas'];
  if (sheetName === 'Calendario') variations = ['Calendario', 'Calendário', 'CALENDARIO', 'CALENDÁRIO'];
  if (sheetName === 'Modelos') variations = ['Modelos', 'MODELOS', 'modelos', 'Modelo', 'MODELO', 'Modelos de Documentos', 'Modelos_Documentos'];
  if (sheetName === 'Documentos') variations = ['Documentos', 'DOCUMENTOS', 'documentos', 'Documento', 'DOCUMENTO', 'Docs', 'DOCS', 'Gerador de Documentos', 'Gerador_Documentos'];
  if (sheetName === 'Logs') variations = ['Logs', 'LOGS', 'logs', 'Log', 'Historico', 'Histórico', 'AUDITORIA', 'Auditoria'];

  for (var i = 0; i < variations.length; i++) {
    var sheet = ss.getSheetByName(variations[i]);
    if (sheet) return sheet;
  }
  return null;
}

function ensureSheetWithHeaders(sheetName, ss) {
  var sheet = findSheet(sheetName, ss);
  var defaultCols = CONFIG.DEFAULT_COLUMNS[sheetName] || ['ID'];
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(defaultCols);
    return { sheet: sheet, headers: defaultCols };
  }
  
  var headers = [];
  if (sheet.getLastColumn() > 0) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) {
      return String(h).trim();
    });
  }
  
  if (headers.length === 0 || headers.every(function(h) { return !h; })) {
    headers = defaultCols;
    sheet.clear();
    sheet.appendRow(headers);
  }
  
  return { sheet: sheet, headers: headers };
}

function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : 'getData';
    var ss = getSs();
    
    if (action === 'getData') {
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: getAllData(ss) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Ação inválida: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = false;
  
  try {
    // Aguarda até 15 segundos para evitar colisões entre múltiplos usuários simultâneos
    hasLock = lock.tryLock(15000);
    if (!hasLock) {
      return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        error: 'Servidor ocupado processando outra sincronização. Tente novamente em alguns segundos.' 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    var ss = getSs();
    var action = data.action;
    var payload = data.payload || data.data || {};
    
    // 1. SALVAMENTO ATÔMICO: Atualiza ou insere um único registro (Segurança máxima para multiusuário)
    if (action === 'upsertItem') {
      var upsertResult = upsertSingleItem(data.table, payload, data.idField, ss);
      return ContentService.createTextOutput(JSON.stringify(upsertResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. EXCLUSÃO ATÔMICA: Remove um único registro sem alterar o resto da tabela
    if (action === 'deleteItem') {
      var deleteResult = deleteSingleItem(data.table, data.id, data.idField, ss);
      return ContentService.createTextOutput(JSON.stringify(deleteResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. SALVAR TABELA ESPECÍFICA (com Zero-Wipe Guard)
    if (action === 'saveTable') {
      var tableResult = saveSingleTable(data.table, payload, data.allowEmpty === true, ss);
      return ContentService.createTextOutput(JSON.stringify(tableResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 4. SALVAR TODAS AS TABELAS (com Zero-Wipe Guard em cada tabela)
    if (action === 'saveAll') {
      var saveAllResult = saveAllData(payload, data.allowEmptyTables === true, ss);
      return ContentService.createTextOutput(JSON.stringify(saveAllResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'checkHeaders') {
      return ContentService.createTextOutput(JSON.stringify(checkSheetHeaders()))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'fixHeaders') {
      return ContentService.createTextOutput(JSON.stringify(fixSheetHeaders()))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'sendTestEmail') {
      var testResult = sendTestEmail(data.email, data.user, data.pass, data.subject, data.body);
      return ContentService.createTextOutput(JSON.stringify(testResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'log') {
      var sheet = ss.getSheetByName('Logs');
      if (!sheet) {
        sheet = ss.insertSheet('Logs');
        sheet.appendRow(CONFIG.DEFAULT_COLUMNS['Logs']);
      }
      
      var logData = payload || {};
      var now = new Date();
      var formattedDate = Utilities.formatDate(now, ss.getSpreadsheetTimeZone() || "GMT-3", "dd/MM/yyyy HH:mm:ss");
      
      var newRow = [
        formattedDate,
        logData.usuario || "",
        logData.acao || "",
        logData.idEscritorio || "",
        logData.detalhes || ""
      ];
      sheet.appendRow(newRow);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Log gravado com sucesso' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Ação inválida: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

/**
 * Insere ou atualiza um único registro em uma aba com base no ID
 */
function upsertSingleItem(sheetName, item, customIdField, ss) {
  if (!sheetName || !item) {
    return { success: false, error: 'Nome da tabela ou dados do item inválidos.' };
  }

  var sheetInfo = ensureSheetWithHeaders(sheetName, ss);
  var sheet = sheetInfo.sheet;
  var headers = sheetInfo.headers;
  
  // Determina qual é o campo de chave primária
  var idField = customIdField;
  if (!idField) {
    if (sheetName === 'Movimentos') idField = 'ID_MOVIMENTO';
    else if (sheetName === 'Tarefas') idField = 'ID_TAREFA';
    else if (sheetName === 'tribunal') idField = 'ID_TJ';
    else if (sheetName === 'Forum') idField = 'ID_FORUM';
    else if (sheetName === 'Varas') idField = 'ID_VARA';
    else if (sheetName === 'Envolvidos') idField = 'ID_CADASTRO';
    else if (sheetName === 'Julgadores') idField = 'ID_JULGADOR';
    else if (sheetName === 'Servidores') idField = 'ID_SERVIDOR';
    else if (sheetName === 'Configuracoes') idField = 'ID_ESCRITORIO';
    else if (sheetName === 'Modelos') idField = 'ID';
    else if (sheetName === 'Documentos') idField = 'ID';
    else idField = 'ID';
  }

  var itemId = item[idField] || item['ID'] || item['id'] || item['ID_MODELO'] || item['ID_DOC'] || item['ID_DOCUMENTO'] || item[idField.toLowerCase()];
  if (!itemId) {
    return { success: false, error: 'O item não possui um identificador válido (campo: ' + idField + ').' };
  }
  itemId = String(itemId).trim().toUpperCase();

  // Encontra o índice da coluna do ID
  var idColIdx = -1;
  for (var c = 0; c < headers.length; c++) {
    var h = headers[c].toUpperCase();
    if (h === idField.toUpperCase() || (idField === 'ID' && (h === 'ID' || h === 'ID_CADASTRO' || h === 'ID_MOVIMENTO' || h === 'ID_TAREFA' || h === 'ID_VARA' || h === 'ID_FORUM' || h === 'ID_TJ' || h === 'ID_MODELO' || h === 'ID_DOC' || h === 'ID_DOCUMENTO'))) {
      idColIdx = c + 1;
      break;
    }
  }
  if (idColIdx === -1) idColIdx = 1; // Default primeira coluna

  // Monta a linha com base nos cabeçalhos
  var rowValues = headers.map(function(header) {
    if (!header) return "";
    if (item[header] !== undefined) return item[header];
    var lowerHeader = header.toLowerCase();
    if (item[lowerHeader] !== undefined) return item[lowerHeader];
    var upperHeader = header.toUpperCase();
    if (item[upperHeader] !== undefined) return item[upperHeader];

    for (var k in item) {
      if (k.toUpperCase() === upperHeader) return item[k];
    }

    if (sheetName === 'Documentos' || sheetName === 'documentos') {
      if (upperHeader === 'ID' || upperHeader === 'ID_DOC' || upperHeader === 'ID_DOCUMENTO') {
        if (item['ID'] !== undefined) return item['ID'];
        if (item['ID_DOC'] !== undefined) return item['ID_DOC'];
        if (item['id'] !== undefined) return item['id'];
      }
      if (upperHeader === 'TITULO' || upperHeader === 'NOME' || upperHeader === 'MODELO') {
        if (item['TITULO'] !== undefined) return item['TITULO'];
        if (item['titulo'] !== undefined) return item['titulo'];
        if (item['NOME'] !== undefined) return item['NOME'];
        if (item['MODELO'] !== undefined) return item['MODELO'];
      }
      if (upperHeader === 'CONTEUDO' || upperHeader === 'CONTEÚDO' || upperHeader === 'ARQUIVO' || upperHeader === 'TEXTO') {
        if (item['CONTEUDO'] !== undefined) return item['CONTEUDO'];
        if (item['conteudo'] !== undefined) return item['conteudo'];
        if (item['ARQUIVO'] !== undefined) return item['ARQUIVO'];
        if (item['TEXTO'] !== undefined) return item['TEXTO'];
      }
      if (upperHeader === 'PROCESSO_ID' || upperHeader === 'ID_PROC' || upperHeader === 'ID_PROCESSO') {
        if (item['PROCESSO_ID'] !== undefined) return item['PROCESSO_ID'];
        if (item['processoId'] !== undefined) return item['processoId'];
        if (item['ID_PROC'] !== undefined) return item['ID_PROC'];
      }
      if (upperHeader === 'DATA_CRIACAO' || upperHeader === 'DATA_UPLOAD' || upperHeader === 'DATA') {
        if (item['DATA_CRIACAO'] !== undefined) return item['DATA_CRIACAO'];
        if (item['dataCriacao'] !== undefined) return item['dataCriacao'];
        if (item['DATA_UPLOAD'] !== undefined) return item['DATA_UPLOAD'];
      }
      if (upperHeader === 'ID_ESCRITORIO' || upperHeader === 'ID_ESCRITÓRIO' || upperHeader === 'IDESCRITORIO' || upperHeader === 'ID_ESC') {
        if (item['ID_ESCRITORIO'] !== undefined) return item['ID_ESCRITORIO'];
        if (item['escritorioId'] !== undefined) return item['escritorioId'];
      }
    }

    if (sheetName === 'Modelos' || sheetName === 'modelos') {
      if (upperHeader === 'ID' || upperHeader === 'ID_MODELO') {
        if (item['ID'] !== undefined) return item['ID'];
        if (item['ID_MODELO'] !== undefined) return item['ID_MODELO'];
        if (item['id'] !== undefined) return item['id'];
      }
      if (upperHeader === 'NOME_MODELO' || upperHeader === 'NOME' || upperHeader === 'TITULO') {
        if (item['NOME_MODELO'] !== undefined) return item['NOME_MODELO'];
        if (item['nome'] !== undefined) return item['nome'];
        if (item['NOME'] !== undefined) return item['NOME'];
        if (item['TITULO'] !== undefined) return item['TITULO'];
      }
      if (upperHeader === 'FASE_MODELO' || upperHeader === 'FASE') {
        if (item['FASE_MODELO'] !== undefined) return item['FASE_MODELO'];
        if (item['fase'] !== undefined) return item['fase'];
        if (item['FASE'] !== undefined) return item['FASE'];
      }
      if (upperHeader === 'MATERIA' || upperHeader === 'MATÉRIA') {
        if (item['MATERIA'] !== undefined) return item['MATERIA'];
        if (item['materia'] !== undefined) return item['materia'];
      }
      if (upperHeader === 'LINK' || upperHeader === 'URL' || upperHeader === 'ARQUIVO') {
        if (item['LINK'] !== undefined) return item['LINK'];
        if (item['link'] !== undefined) return item['link'];
        if (item['URL'] !== undefined) return item['URL'];
      }
      if (upperHeader === 'ID_ESCRITORIO' || upperHeader === 'ID_ESCRITÓRIO' || upperHeader === 'IDESCRITORIO' || upperHeader === 'ID_ESC') {
        if (item['ID_ESCRITORIO'] !== undefined) return item['ID_ESCRITORIO'];
        if (item['escritorioId'] !== undefined) return item['escritorioId'];
      }
    }

    return "";
  });

  var lastRow = sheet.getLastRow();
  var targetRow = -1;

  if (lastRow > 1) {
    var existingIds = sheet.getRange(2, idColIdx, lastRow - 1, 1).getValues();
    for (var r = 0; r < existingIds.length; r++) {
      var currentId = String(existingIds[r][0] || '').trim().toUpperCase();
      if (currentId === itemId) {
        targetRow = r + 2; // +2 porque começou na linha 2
        break;
      }
    }
  }

  if (targetRow !== -1) {
    // Atualiza apenas aquela linha
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
    return { success: true, operation: 'updated', row: targetRow, id: itemId };
  } else {
    // Insere como nova linha no final
    sheet.appendRow(rowValues);
    return { success: true, operation: 'inserted', row: sheet.getLastRow(), id: itemId };
  }
}

/**
 * Remove um único registro de uma aba com base no ID
 */
function deleteSingleItem(sheetName, idToDelete, customIdField, ss) {
  if (!sheetName || !idToDelete) {
    return { success: false, error: 'Nome da tabela ou ID inválidos.' };
  }

  var sheet = findSheet(sheetName, ss);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { success: true, message: 'Tabela vazia ou inexistente, nada a excluir.' };
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) {
    return String(h).trim();
  });

  var idField = customIdField || 'ID';
  var idColIdx = -1;
  for (var c = 0; c < headers.length; c++) {
    var h = headers[c].toUpperCase();
    if (h === idField.toUpperCase() || h.indexOf('ID') !== -1) {
      idColIdx = c + 1;
      break;
    }
  }
  if (idColIdx === -1) idColIdx = 1;

  var targetId = String(idToDelete).trim().toUpperCase();
  var existingIds = sheet.getRange(2, idColIdx, sheet.getLastRow() - 1, 1).getValues();
  
  for (var r = 0; r < existingIds.length; r++) {
    var currentId = String(existingIds[r][0] || '').trim().toUpperCase();
    if (currentId === targetId) {
      var rowNum = r + 2;
      sheet.deleteRow(rowNum);
      return { success: true, operation: 'deleted', row: rowNum, id: targetId };
    }
  }

  return { success: true, operation: 'not_found', message: 'Registro não encontrado para exclusão' };
}

/**
 * Salva apenas uma tabela específica com guarda Zero-Wipe
 */
function saveSingleTable(sheetName, data, allowEmpty, ss) {
  if (!CONFIG.DEFAULT_COLUMNS[sheetName]) {
    return { success: false, error: 'Tabela desconhecida: ' + sheetName };
  }
  var result = saveData(sheetName, data, ss, { allowEmpty: allowEmpty });
  return { success: true, table: sheetName, details: result };
}

function checkSheetHeaders() {
  var ss = getSs();
  var report = [];
  for (var sheetName in CONFIG.DEFAULT_COLUMNS) {
    var expected = CONFIG.DEFAULT_COLUMNS[sheetName];
    var sheet = findSheet(sheetName, ss);
    var status = "OK";
    var missing = [];
    
    if (!sheet) {
      status = "Missing Sheet";
    } else {
      var actual = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
      expected.forEach(function(col) {
        if (actual.indexOf(col) === -1) {
          missing.push(col);
        }
      });
      if (missing.length > 0) status = "Missing Columns";
    }
    report.push({ sheet: sheetName, status: status, missingColumns: missing });
  }
  return { success: true, report: report };
}

function fixSheetHeaders() {
  var ss = getSs();
  for (var sheetName in CONFIG.DEFAULT_COLUMNS) {
    var expected = CONFIG.DEFAULT_COLUMNS[sheetName];
    var sheet = findSheet(sheetName, ss);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(expected);
    } else {
      var actualRows = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues();
      var actual = actualRows[0];
      expected.forEach(function(col) {
        if (col === 'ID_MOVIMENTO' && (actual.indexOf('ID_MOVIMENTO') !== -1 || actual.indexOf('ID') !== -1)) {
          return;
        }
        if (col === 'ID_USUARIO' && (actual.indexOf('ID_USUARIO') !== -1 || actual.indexOf('RESPONSAVEL') !== -1 || actual.indexOf('RESPONSÁVEL') !== -1)) {
          return;
        }
        if (actual.indexOf(col) === -1) {
          sheet.getRange(1, actual.length + 1).setValue(col);
          actual.push(col);
        }
      });
    }
  }
  return { success: true };
}

function sendTestEmail(email, user, pass, subject, body) {
  try {
    MailApp.sendEmail({
      to: email,
      subject: subject || "Teste de E-mail - Sistema Jurídico",
      htmlBody: body || "<p>Este é um e-mail de teste enviado pelo Sistema Jurídico.</p>"
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function getAllData(ss) {
  var result = {};
  var sheets = ss.getSheets();
  
  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    var data = sheet.getDataRange().getValues();
    if (data.length > 1) {
      var headers = data[0];
      var rows = data.slice(1);
      result[name] = rows.map(function(row) {
        var obj = {};
        headers.forEach(function(header, index) {
          obj[header] = row[index];
        });
        return obj;
      });
    } else {
      result[name] = [];
    }
  });
  
  return result;
}

function saveAllData(payload, allowEmptyTables, ss) {
  try {
    var report = {};
    for (var sheetName in payload) {
      // NUNCA apaga ou sobreescreve a tabela Logs em saveAll.
      // Logs é um histórico de auditoria estritamente acumulativo (append-only) via ação 'log'.
      if (sheetName === 'Logs') {
        continue;
      }
      if (CONFIG.DEFAULT_COLUMNS[sheetName]) {
        report[sheetName] = saveData(sheetName, payload[sheetName], ss, { allowEmpty: allowEmptyTables === true });
      }
    }
    return { success: true, message: 'Dados sincronizados com sucesso', report: report };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Salva os dados de uma aba com ZERO-WIPE GUARD
 */
function saveData(sheetName, data, ss, options) {
  options = options || {};
  var allowEmpty = options.allowEmpty === true;

  var sheetInfo = ensureSheetWithHeaders(sheetName, ss);
  var sheet = sheetInfo.sheet;
  var headers = sheetInfo.headers;
  var currentLastRow = sheet.getLastRow();

  // ZERO-WIPE GUARD:
  // Se o payload enviado estiver vazio ([] ou null) e a planilha JÁ POSSUI DADOS (> 1 linha),
  // NUNCA apagamos a aba da planilha para proteger contra sincronizações corrompidas de novos dispositivos.
  if ((!data || data.length === 0) && currentLastRow > 1 && !allowEmpty) {
    return {
      status: 'protected_preserved',
      message: 'Zero-Wipe Guard: Dados existentes preservados (' + (currentLastRow - 1) + ' linhas). O payload vazio foi ignorado para segurança.'
    };
  }

  // Se tivermos dados novos ou for permitido esvaziar, limpa as linhas antigas
  if (currentLastRow > 1) {
    sheet.getRange(2, 1, currentLastRow - 1, sheet.getLastColumn()).clearContent();
  }
  
  if (data && data.length > 0) {
    var rows = data.map(function(item) {
      return headers.map(function(header) {
        if (!header) return "";
        if (item[header] !== undefined) return item[header];
        var lowerHeader = header.toLowerCase();
        if (item[lowerHeader] !== undefined) return item[lowerHeader];
        var upperHeader = header.toUpperCase();
        if (item[upperHeader] !== undefined) return item[upperHeader];

        for (var k in item) {
          if (k.toUpperCase() === upperHeader) return item[k];
        }

        // CUSTOM ROBUST FALLBACKS FOR MOVIMENTOS
        if (sheetName === 'Movimentos' || sheetName === 'movimentos') {
          if (header === 'ID' || header === 'ID_MOVIMENTO' || header === 'ID_MOVIMENTACO') {
            if (item['ID_MOVIMENTO'] !== undefined) return item['ID_MOVIMENTO'];
            if (item['ID'] !== undefined) return item['ID'];
            if (item['id'] !== undefined) return item['id'];
          }
          if (header === 'RESPONSAVEL' || header === 'ID_USUARIO' || header === 'RESPONSÁVEL') {
            if (item['ID_USUARIO'] !== undefined) return item['ID_USUARIO'];
            if (item['RESPONSAVEL'] !== undefined) return item['RESPONSAVEL'];
            if (item['usuarioId'] !== undefined) return item['usuarioId'];
          }
        }

        // CUSTOM ROBUST FALLBACKS FOR DOCUMENTOS
        if (sheetName === 'Documentos' || sheetName === 'documentos') {
          if (upperHeader === 'ID' || upperHeader === 'ID_DOC' || upperHeader === 'ID_DOCUMENTO') {
            if (item['ID'] !== undefined) return item['ID'];
            if (item['ID_DOC'] !== undefined) return item['ID_DOC'];
            if (item['id'] !== undefined) return item['id'];
          }
          if (upperHeader === 'TITULO' || upperHeader === 'NOME' || upperHeader === 'MODELO') {
            if (item['TITULO'] !== undefined) return item['TITULO'];
            if (item['titulo'] !== undefined) return item['titulo'];
            if (item['NOME'] !== undefined) return item['NOME'];
            if (item['MODELO'] !== undefined) return item['MODELO'];
          }
          if (upperHeader === 'CONTEUDO' || upperHeader === 'CONTEÚDO' || upperHeader === 'ARQUIVO' || upperHeader === 'TEXTO') {
            if (item['CONTEUDO'] !== undefined) return item['CONTEUDO'];
            if (item['conteudo'] !== undefined) return item['conteudo'];
            if (item['ARQUIVO'] !== undefined) return item['ARQUIVO'];
            if (item['TEXTO'] !== undefined) return item['TEXTO'];
          }
          if (upperHeader === 'PROCESSO_ID' || upperHeader === 'ID_PROC' || upperHeader === 'ID_PROCESSO') {
            if (item['PROCESSO_ID'] !== undefined) return item['PROCESSO_ID'];
            if (item['processoId'] !== undefined) return item['processoId'];
            if (item['ID_PROC'] !== undefined) return item['ID_PROC'];
          }
          if (upperHeader === 'DATA_CRIACAO' || upperHeader === 'DATA_UPLOAD' || upperHeader === 'DATA') {
            if (item['DATA_CRIACAO'] !== undefined) return item['DATA_CRIACAO'];
            if (item['dataCriacao'] !== undefined) return item['dataCriacao'];
            if (item['DATA_UPLOAD'] !== undefined) return item['DATA_UPLOAD'];
          }
          if (upperHeader === 'ID_ESCRITORIO' || upperHeader === 'ID_ESCRITÓRIO' || upperHeader === 'IDESCRITORIO' || upperHeader === 'ID_ESC') {
            if (item['ID_ESCRITORIO'] !== undefined) return item['ID_ESCRITORIO'];
            if (item['escritorioId'] !== undefined) return item['escritorioId'];
          }
        }

        // CUSTOM ROBUST FALLBACKS FOR MODELOS
        if (sheetName === 'Modelos' || sheetName === 'modelos') {
          if (upperHeader === 'ID' || upperHeader === 'ID_MODELO') {
            if (item['ID'] !== undefined) return item['ID'];
            if (item['ID_MODELO'] !== undefined) return item['ID_MODELO'];
            if (item['id'] !== undefined) return item['id'];
          }
          if (upperHeader === 'NOME_MODELO' || upperHeader === 'NOME' || upperHeader === 'TITULO') {
            if (item['NOME_MODELO'] !== undefined) return item['NOME_MODELO'];
            if (item['nome'] !== undefined) return item['nome'];
            if (item['NOME'] !== undefined) return item['NOME'];
            if (item['TITULO'] !== undefined) return item['TITULO'];
          }
          if (upperHeader === 'FASE_MODELO' || upperHeader === 'FASE') {
            if (item['FASE_MODELO'] !== undefined) return item['FASE_MODELO'];
            if (item['fase'] !== undefined) return item['fase'];
            if (item['FASE'] !== undefined) return item['FASE'];
          }
          if (upperHeader === 'MATERIA' || upperHeader === 'MATÉRIA') {
            if (item['MATERIA'] !== undefined) return item['MATERIA'];
            if (item['materia'] !== undefined) return item['materia'];
          }
          if (upperHeader === 'LINK' || upperHeader === 'URL' || upperHeader === 'ARQUIVO') {
            if (item['LINK'] !== undefined) return item['LINK'];
            if (item['link'] !== undefined) return item['link'];
            if (item['URL'] !== undefined) return item['URL'];
          }
          if (upperHeader === 'ID_ESCRITORIO' || upperHeader === 'ID_ESCRITÓRIO' || upperHeader === 'IDESCRITORIO' || upperHeader === 'ID_ESC') {
            if (item['ID_ESCRITORIO'] !== undefined) return item['ID_ESCRITORIO'];
            if (item['escritorioId'] !== undefined) return item['escritorioId'];
          }
        }

        return "";
      });
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    return { status: 'saved', count: rows.length };
  }

  return { status: 'empty', count: 0 };
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚖️ Sistema Jurídico')
    .addItem('Verificar Estrutura de Tabelas', 'setupSpreadsheet')
    .addItem('Corrigir Cabeçalhos', 'fixSheetHeaders')
    .addToUi();
}

function setupSpreadsheet() {
  try {
    var res = fixSheetHeaders();
    if (res.success) {
      SpreadsheetApp.getUi().alert('Estrutura de tabelas verificada e atualizada com sucesso!');
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert('Erro: ' + e.toString());
  }
}
