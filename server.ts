import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import cron from "node-cron";
import Papa from "papaparse";
import { getWeeklyReportTemplate, getNewNotificationsTemplate, getDailyReportTemplate } from "./emailTemplatesServer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPREADSHEET_ID = process.env.VITE_SPREADSHEET_ID || '1GuBKYPr_ea0A7Gh5mGQxxevQZs8qXZg4mSx93u5TCsg';

// Helper to fetch CSV from Google Sheets
async function fetchSheetData(sheetName: string) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&headers=1&t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const csv = await response.text();
    return new Promise<any[]>((resolve) => {
      Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data)
      });
    });
  } catch (err) {
    console.error(`Error fetching sheet ${sheetName}:`, err);
    return [];
  }
}

async function runAutomatedEmails(type: 'weekly' | 'daily') {
  console.log(`[Automation] Checking ${type} emails due at ${new Date().toISOString()}...`);
  
  // 1. Get Settings (Configuracoes)
  const settingsData = await fetchSheetData('Configuracoes');
  const officesData = await fetchSheetData('Escritorios');
  
  // 30 min window for matching
  const now = new Date();

  // 2. Identify offices with enabled notifications AND whose time matches now
  const officesToNotify = settingsData.filter(setting => {
    const isEnabled = setting.enableEmailNotifications === 'TRUE' || setting.enableEmailNotifications === 'true' || setting.enableEmailNotifications === true;
    const wantsWeekly = setting.emailWeeklyReport === 'TRUE' || setting.emailWeeklyReport === 'true' || setting.emailWeeklyReport === true;
    const wantsDaily = setting.emailDailyReport === 'TRUE' || setting.emailDailyReport === 'true' || setting.emailDailyReport === true;
    const wantsNotifications = setting.emailNewNotifications === 'TRUE' || setting.emailNewNotifications === 'true' || setting.emailNewNotifications === true;
    
    if (!isEnabled) return false;
    if (type === 'weekly' && !wantsWeekly) return false;
    if (type === 'daily' && !wantsDaily && !wantsNotifications) return false;

    // Time Check
    const officeTimezone = setting.timezone || 'America/Sao_Paulo';
    const dispatchTime = setting.emailDispatchTime || '08:00'; // Default to 08:00
    
    try {
      // Get current hour and minute in office timezone
      const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: officeTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      const currentHour = parts.find(p => p.type === 'hour')?.value || '00';
      const currentMinute = parts.find(p => p.type === 'minute')?.value || '00';
      const currentTimeStr = `${currentHour}:${currentMinute}`;

      // Weekly check: only on Monday in THEIR timezone
      if (type === 'weekly') {
        const dayNameFormatter = new Intl.DateTimeFormat('pt-BR', {
          timeZone: officeTimezone,
          weekday: 'long'
        });
        const currentDayName = dayNameFormatter.format(now).toLowerCase();
        if (!currentDayName.includes('segunda')) return false;
      }

      const [targetH, targetM] = dispatchTime.split(':');
      const [currH, currM] = currentTimeStr.split(':');

      // Match Hour exactly
      if (currH !== targetH) return false;
      
      // Match Minute within a 30-min window (since cron runs every 30 mins)
      const targetMin = parseInt(targetM);
      const currMin = parseInt(currM);
      // If cron runs at :00 and :30, we check if target is in [curr, curr+29]
      if (targetMin < currMin || targetMin >= currMin + 30) return false;

      console.log(`[Automation] Office ${setting.idEscritorio} is due for ${type} email (Time: ${currentTimeStr}, Scheduled: ${dispatchTime})`);
      return true;
    } catch (err) {
      console.error(`[Automation] Error checking timezone for ${officeTimezone}:`, err);
      return false;
    }
  });

  if (officesToNotify.length === 0) {
    console.log(`[Automation] No offices to notify for ${type}.`);
    return;
  }

  // Fetch only necessary data based on type
  let processos: any[] = [];
  let financeiro: any[] = [];
  let tarefas: any[] = [];
  let contatos: any[] = [];
  let eventos: any[] = [];
  let movimentos: any[] = [];

  if (type === 'weekly' || type === 'daily') {
    processos = await fetchSheetData('Processos');
    tarefas = await fetchSheetData('Tarefas');
    contatos = await fetchSheetData('Contatos');
    eventos = await fetchSheetData('Eventos');
    movimentos = await fetchSheetData('Movimentos');
  }

  for (const setting of officesToNotify) {
    const officeId = (setting.idEscritorio || setting.ID_ESCRITORIO || '').toString().trim();
    const office = officesData.find(o => (o.ID_ESCRITORIO || o.ID || '').toString().trim() === officeId);
    if (!office) continue;

    const emailTo = setting.emailUser || office.EMAIL || '';
    if (!emailTo) continue;

    const useExternal = setting.useExternalSmtp === 'TRUE' || setting.useExternalSmtp === 'true' || setting.useExternalSmtp === true;
    const scriptUrl = process.env.VITE_SCRIPT_URL || setting.scriptUrl;

    const sendHelper = async (to: string, sub: string, content: string) => {
      try {
        const fromName = office.Escritorio_nome || 'Meu Escritório';
        if (useExternal && setting.smtpHost && setting.emailUser && setting.emailPass) {
          const transporter = nodemailer.createTransport({
            host: setting.smtpHost,
            port: parseInt(setting.smtpPort) || 465,
            secure: setting.smtpSecure === 'TRUE' || setting.smtpSecure === 'true' || setting.smtpSecure === true,
            auth: { user: setting.emailUser, pass: setting.emailPass }
          });
          await transporter.sendMail({ from: `"${fromName}" <${setting.emailUser}>`, to, subject: sub, html: content });
        } else if (scriptUrl) {
          await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'sendEmail', to, subject: sub, body: content, user: setting.emailUser, pass: setting.emailPass }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
          });
        }
        console.log(`[Automation] Email sent to ${to} - ${sub}`);
      } catch (err) {
        console.error(`[Automation] Failed to send email to ${to} (${sub}):`, err);
      }
    };

    if (type === 'weekly') {
      const subject = `Resumo Semanal - ${office.Escritorio_nome || 'Meu Escritorio'}`;
      
      const officeProcessos = processos.filter(p => (p.ID_ESCRITORIO || '').toString().trim() === officeId && (p.STATUS === 'Ativo' || p.ATIVO === 'TRUE' || p.status === 'Ativo'));
      const officeTarefas = tarefas.filter(t => (t.ID_ESCRITORIO || '').toString().trim() === officeId && (t.STATUS !== 'ConcluidA' && t.STATUS !== 'Concluída' && t.STATUS !== 'concluida'));
      const officeContatos = contatos.filter(c => (c.ID_ESCRITORIO || '').toString().trim() === officeId && c.TIPO === 'Cliente');
      const officeEventos = eventos.filter(e => (e.ID_ESCRITORIO || '').toString().trim() === officeId && (e.CONCLUIDO !== 'TRUE' && e.CONCLUIDO !== 'true' && e.CONCLUIDO !== true));

      const officeProcessosPendentes = processos.filter(p => {
        if ((p.ID_ESCRITORIO || '').toString().trim() !== officeId) return false;
        const statusRaw = (p.ATIVO || p.STATUS || '').toLowerCase();
        const tagsRaw = (p.TAGS || '').toLowerCase();
        return statusRaw.includes('pend') || statusRaw === 'p' || tagsRaw.includes('pendência') || tagsRaw.includes('pendencia');
      });

      // Morosidade calculation
      const diasMorosidade = parseInt(setting.diasMorosidade || '30') || 30;
      const hoje = new Date();
      const processosMorosos = officeProcessos.filter(p => {
        const procId = p.ID || p.id;
        const procNumero = p.NUMERO || p.numero;
        const movs = movimentos.filter(m => (m.PROCESSO_ID || m.processoId) == procId || (m.PROCESSO_ID || m.processoId) == procNumero);
        
        if (movs.length === 0) {
          const dataDistStr = p.DATA_DISTRIBUICAO || p.dataDistribuicao;
          if (!dataDistStr) return false;
          const dataDist = new Date(dataDistStr);
          if (isNaN(dataDist.getTime())) return false;
          const diffDays = Math.ceil(Math.abs(hoje.getTime() - dataDist.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays > diasMorosidade;
        }

        const ultMov = movs.sort((a, b) => new Date(b.DATA || b.data).getTime() - new Date(a.DATA || a.data).getTime())[0];
        const dataMov = new Date(ultMov.DATA || ultMov.data);
        if (isNaN(dataMov.getTime())) return false;
        const diffDays = Math.ceil(Math.abs(hoje.getTime() - dataMov.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays > diasMorosidade;
      });

      const body = getWeeklyReportTemplate({
        officeName: office.Escritorio_nome || 'Meu Escritório',
        activeProcesses: officeProcessos.length,
        pendingTasks: officeTarefas.length,
        totalCustomers: officeContatos.length,
        pendingEvents: officeEventos.length,
        pendingProcesses: officeProcessosPendentes.length,
        lateProcesses: processosMorosos.length,
        publicationsToday: 0,
        year: new Date().getFullYear()
      }, setting.TEMPLATE_WEEKLY_REPORT || setting.templateWeeklyReport || setting.TEMPLATE_RELATORIO_SEMANAL);

      if (body) await sendHelper(emailTo, subject, body);

    } else if (type === 'daily') {
      // 1. Check for Daily Report
      const wantsDailyReport = setting.emailDailyReport === 'TRUE' || setting.emailDailyReport === 'true' || setting.emailDailyReport === true;
      const wantsNotifications = setting.emailNewNotifications === 'TRUE' || setting.emailNewNotifications === 'true' || setting.emailNewNotifications === true;

      let publicationsToday = 0;
      let notificationsItems: any[] = [];
      const responsavel = office.RESPONSAVEL || '';

      // Common fetch for Notifications/Publications
      if (responsavel) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=1&itensPorPagina=10&dataDisponibilizacaoInicio=${today}&dataDisponibilizacaoFim=${today}&nomeAdvogado=${encodeURIComponent(responsavel)}`;
          const response = await fetch(url);
          const data = await response.json();
          publicationsToday = data.count || 0;
          notificationsItems = data.items || [];
        } catch (err) {
          console.error(`[Automation] Error fetching notifications for ${responsavel}:`, err);
        }
      }

      // Handle "Daily Report"
      if (wantsDailyReport) {
        const subject = `Relatório Diário - ${office.Escritorio_nome || 'Meu Escritorio'}`;
        
        const officeProcessos = processos.filter(p => (p.ID_ESCRITORIO || '').toString().trim() === officeId && (p.STATUS === 'Ativo' || p.ATIVO === 'TRUE' || p.status === 'Ativo'));
        const officeTarefas = tarefas.filter(t => (t.ID_ESCRITORIO || '').toString().trim() === officeId && (t.STATUS !== 'ConcluidA' && t.STATUS !== 'Concluída' && t.STATUS !== 'concluida'));
        const officeEventos = eventos.filter(e => (e.ID_ESCRITORIO || '').toString().trim() === officeId && (e.CONCLUIDO !== 'TRUE' && e.CONCLUIDO !== 'true' && e.CONCLUIDO !== true));

        const officeProcessosPendentes = processos.filter(p => {
          if ((p.ID_ESCRITORIO || '').toString().trim() !== officeId) return false;
          const statusRaw = (p.ATIVO || p.STATUS || '').toLowerCase();
          const tagsRaw = (p.TAGS || '').toLowerCase();
          return statusRaw.includes('pend') || statusRaw === 'p' || tagsRaw.includes('pendência') || tagsRaw.includes('pendencia');
        });

        // Morosidade calculation
        const diasMorosidade = parseInt(setting.diasMorosidade || '30') || 30;
        const hoje = new Date();
        const processosMorosos = officeProcessos.filter(p => {
          const procId = p.ID || p.id;
          const procNumero = p.NUMERO || p.numero;
          const movs = movimentos.filter(m => (m.PROCESSO_ID || m.processoId) == procId || (m.PROCESSO_ID || m.processoId) == procNumero);
          
          if (movs.length === 0) {
            const dataDistStr = p.DATA_DISTRIBUICAO || p.dataDistribuicao;
            if (!dataDistStr) return false;
            const dataDist = new Date(dataDistStr);
            if (isNaN(dataDist.getTime())) return false;
            const diffDays = Math.ceil(Math.abs(hoje.getTime() - dataDist.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays > diasMorosidade;
          }

          const ultMov = movs.sort((a, b) => new Date(b.DATA || b.data).getTime() - new Date(a.DATA || a.data).getTime())[0];
          const dataMov = new Date(ultMov.DATA || ultMov.data);
          if (isNaN(dataMov.getTime())) return false;
          const diffDays = Math.ceil(Math.abs(hoje.getTime() - dataMov.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays > diasMorosidade;
        });

        const body = getDailyReportTemplate({
          officeName: office.Escritorio_nome || 'Meu Escritório',
          publicationsToday: publicationsToday,
          pendingTasks: officeTarefas.length,
          pendingProcesses: officeProcessosPendentes.length,
          pendingEvents: officeEventos.length,
          lateProcesses: processosMorosos.length,
          diasMorosidade: diasMorosidade,
          year: new Date().getFullYear()
        }, setting.templateDailyReport || setting.TEMPLATE_DAILY_REPORT);

        if (body) await sendHelper(emailTo, subject, body);
      }

      // Handle "New Notifications"
      if (wantsNotifications && publicationsToday > 0) {
        const subject = `Novas Intimações - ${office.Escritorio_nome || 'Meu Escritório'}`;
        const body = getNewNotificationsTemplate({
          officeName: office.Escritorio_nome || 'Meu Escritório',
          date: new Date().toLocaleDateString('pt-BR'),
          count: publicationsToday,
          responsible: responsavel,
          items: notificationsItems.slice(0, 5).map(item => ({
            numeroProcesso: item.numeroProcesso,
            texto: item.texto || '',
            orgao: item.orgaoMnemonic
          })),
          year: new Date().getFullYear()
        }, setting.templateNewNotifications || setting.TEMPLATE_NEW_NOTIFICATIONS);

        if (body) await sendHelper(emailTo, subject, body);
      }
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Cron Job: Run every 30 minutes to check for office-specific dispatch times
  cron.schedule('0,30 * * * *', () => {
    runAutomatedEmails('weekly');
    runAutomatedEmails('daily');
  }, { timezone: "America/Sao_Paulo" });

  console.log("[Automation] Cron jobs scheduled.");

  // For testing: Endpoint to trigger manually
  app.post("/api/cron/trigger", async (req, res) => {
    const { type, secret } = req.body;
    if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: "Unauthorized" });
    }
    await runAutomatedEmails(type as any);
    res.json({ status: "triggered" });
  });

  // API Proxy for Datajud Search to avoid CORS issues
  app.post("/api/datajud/search", async (req, res) => {
    const { tribunal = 'tjam' } = req.query;
    const normalizedTribunal = String(tribunal).toLowerCase().trim();
    const targetUrl = `https://api-publica.datajud.cnj.jus.br/api_publica_${normalizedTribunal}/_search`;

    console.log(`[Datajud Proxy] Target: ${targetUrl}`);

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Host': 'api-publica.datajud.cnj.jus.br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };

      let apiKey = (process.env.PDPJ_API_TOKEN || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==').trim();
      
      // Ensure we don't double the prefix if the user already included it in the env var
      if (apiKey.startsWith('APIKey ')) {
        headers['Authorization'] = apiKey;
      } else {
        headers['Authorization'] = `APIKey ${apiKey}`;
      }

      console.log(`[Datajud Proxy] Using API Key (start): ${apiKey.substring(0, 8)}...`);

      const response = await fetch(targetUrl, { 
        method: 'POST',
        headers,
        body: JSON.stringify(req.body)
      });

      console.log(`[Datajud Proxy] Response Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorDetails = '';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorJson = await response.json();
            errorDetails = JSON.stringify(errorJson);
          } else {
            errorDetails = await response.text();
          }
        } catch (e) {
          errorDetails = response.statusText;
        }

        console.error(`[Datajud Proxy] API Error: ${response.status} - ${errorDetails}`);
        return res.status(response.status).json({ 
          error: "Erro na API do Datajud", 
          status: response.status,
          details: errorDetails 
        });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("[Datajud Proxy] Internal Error:", error);
      res.status(500).json({ error: "Erro interno no servidor de proxy", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // API to test external SMTP configuration
  app.post("/api/email/test", async (req, res) => {
    const { host, port, secure, user, pass, to, subject, body, html } = req.body;
    
    console.log(`[SMTP Test] Request for: ${to || user}. Subject: ${subject || 'Default'}. Body Length: ${(body || html || '').length}`);

    if (!host || !user || !pass) {
      return res.status(400).json({ success: false, error: "Configurações de SMTP incompletas." });
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });

      // Verify connection configuration
      await transporter.verify();

      // Content determination
      const finalHtml = html || body || `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5;">SMTP Externo: Teste Bem-sucedido!</h2>
            <p>Este é um e-mail de teste enviado pelo servidor Node.js do seu sistema.</p>
            <p>Se você recebeu este e-mail, as configurações de SMTP externo estão funcionando corretamente.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #64748b;">
              Servidor: ${host}:${port}<br>
              Usuário: ${user}<br>
              Destinatário: ${to || user}
            </p>
          </div>
        `;

      // Send test email
      await transporter.sendMail({
        from: `"Sistema Jurídico" <${user}>`,
        to: to || user,
        subject: subject || "🔒 Teste de Configuração SMTP Externo",
        html: finalHtml,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[SMTP Test] Error:", error);
      res.status(500).json({ success: false, error: "Erro ao conectar ao SMTP: " + (error.message || String(error)) });
    }
  });

  // API Proxy for Projudi WebService
  app.post("/api/projudi/consulta", async (req, res) => {
    const { numero_processo } = req.body;
    
    if (!numero_processo) {
      return res.status(400).json({ error: "numero_processo é obrigatório" });
    }

    console.log(`Consultando Projudi para o processo: ${numero_processo}`);

    try {
      // In a real scenario, we would make a SOAP request here.
      // For this implementation, we return null for vara and movements if not found.
      
      const responseData = {
        "numero_processo": numero_processo,
        "vara": null,
        "movimentacoes": []
      };

      // Optional: Attempt a real SOAP call (commented out as it requires precise XML schema)
      /*
      const soapEnvelope = `
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webservice.projudi.tjam.jus.br/">
           <soapenv:Header/>
           <soapenv:Body>
              <web:obterDadosProcesso>
                 <numeroProcesso>${numero_processo}</numeroProcesso>
                 <sistemaOrigem>PROJUDI</sistemaOrigem>
              </web:obterDadosProcesso>
           </soapenv:Body>
        </soapenv:Envelope>
      `;
      
      const soapResponse = await fetch('https://projudi.tjam.jus.br/projudi/webservices/consultaProcessualWebService', {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=UTF-8', 'SOAPAction': '' },
        body: soapEnvelope
      });
      // ... parse XML to JSON ...
      */

      res.json(responseData);
    } catch (error) {
      console.error("Projudi Proxy Error:", error);
      res.status(500).json({ error: "Erro ao consultar WebService Projudi", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // API para gravação atômica segura no Supabase (com bypass de RLS via chave do servidor)
  app.post("/api/supabase/upsert", async (req, res) => {
    const { table, record, conflictColumn } = req.body;
    if (!table || !record) {
      return res.status(400).json({ success: false, error: "Tabela e registro são obrigatórios." });
    }

    const supabaseUrl = (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('127.0.0.1') && !process.env.SUPABASE_URL.includes('walbermendonca')) ? process.env.SUPABASE_URL : 'https://qhxdujbsipgwthrgvncl.supabase.co';
    const supabaseKey = (process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi')) ? process.env.SUPABASE_SECRET_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL');

    try {
      const conflictHeader = conflictColumn ? `resolution=merge-duplicates,on_conflict=${conflictColumn}` : 'resolution=merge-duplicates';
      const resp = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": conflictHeader
        },
        body: JSON.stringify(record)
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[Server Supabase Upsert] Erro em ${table}:`, errText);
        return res.status(resp.status).json({ success: false, error: errText });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error(`[Server Supabase Upsert] Exceção em ${table}:`, err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/supabase/delete", async (req, res) => {
    const { table, id, column } = req.body;
    if (!table || !id) {
      return res.status(400).json({ success: false, error: "Tabela e id são obrigatórios." });
    }

    const supabaseUrl = (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('127.0.0.1') && !process.env.SUPABASE_URL.includes('walbermendonca')) ? process.env.SUPABASE_URL : 'https://qhxdujbsipgwthrgvncl.supabase.co';
    const supabaseKey = (process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi')) ? process.env.SUPABASE_SECRET_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL');

    try {
      const idCol = column || 'id';
      const resp = await fetch(`${supabaseUrl}/rest/v1/${table}?${idCol}=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        }
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[Server Supabase Delete] Erro em ${table}:`, errText);
        return res.status(resp.status).json({ success: false, error: errText });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error(`[Server Supabase Delete] Exceção em ${table}:`, err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API para listar escritórios com bypass de RLS via servidor
  app.get("/api/supabase/escritorios", async (req, res) => {
    const supabaseUrl = (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('127.0.0.1') && !process.env.SUPABASE_URL.includes('walbermendonca')) ? process.env.SUPABASE_URL : 'https://qhxdujbsipgwthrgvncl.supabase.co';
    const supabaseKey = (process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi')) ? process.env.SUPABASE_SECRET_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL');

    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/escritorios?select=*`, {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`
        }
      });

      let dbEscritorios: any[] = [];
      if (resp.ok) {
        dbEscritorios = await resp.json().catch(() => []);
      }

      // Se o banco estiver vazio, busca da planilha e alimenta o Supabase
      if (!Array.isArray(dbEscritorios) || dbEscritorios.length === 0) {
        try {
          const sheetData = await fetchSheetData('Escritorios');
          if (Array.isArray(sheetData) && sheetData.length > 0) {
            const mapped = sheetData.map((row: any, idx: number) => ({
              id: (row.ID_ESCRITORIO || row.id || `ESC_${idx + 1}`).toString().trim(),
              nome: row.Escritorio_nome || row.nome || `Escritório ${idx + 1}`,
              endereco: row.escritorio_end || row.endereco || '',
              responsavel: row.RESPONSAVEL || '',
            })).filter((e: any) => e.id && e.nome);

            if (mapped.length > 0) {
              dbEscritorios = mapped;
              for (const esc of mapped) {
                fetch(`${supabaseUrl}/rest/v1/escritorios`, {
                  method: "POST",
                  headers: {
                    "apikey": supabaseKey,
                    "Authorization": `Bearer ${supabaseKey}`,
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates,on_conflict=id"
                  },
                  body: JSON.stringify(esc)
                }).catch(() => {});
              }
            }
          }
        } catch (sheetErr) {
          console.warn("[Server Supabase Escritorios] Erro ao sincronizar da planilha:", sheetErr);
        }
      }

      return res.json({ success: true, escritorios: dbEscritorios });
    } catch (err: any) {
      console.error("[Server Supabase Escritorios] Exceção:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ============================================================================
  // GESTÃO COMPLETA DE USUÁRIOS BASEADA EM AUTH.USERS
  // ============================================================================

  // 1. CONSULTAR USUÁRIOS DIRETAMENTE DE AUTH.USERS (com dados mesclados de public.usuarios)
  app.get("/api/supabase/admin/users", async (req, res) => {
    const supabaseUrl = (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('127.0.0.1') && !process.env.SUPABASE_URL.includes('walbermendonca')) ? process.env.SUPABASE_URL : 'https://qhxdujbsipgwthrgvncl.supabase.co';
    const supabaseKey = (process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi')) ? process.env.SUPABASE_SECRET_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL');
    const hasServiceRole = !!(process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi'));

    if (!hasServiceRole) {
      return res.status(500).json({ success: false, error: "Chave administrativa não configurada para consultar auth.users." });
    }

    try {
      const [authRes, pubRes] = await Promise.all([
        fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }).then(r => r.json()),
        fetch(`${supabaseUrl}/rest/v1/usuarios?select=*`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }).then(r => r.json()).catch(() => [])
      ]);

      const pubUsers = Array.isArray(pubRes) ? pubRes : [];
      const pubByEmail = new Map<string, any>();
      pubUsers.forEach(u => {
        if (u.email) pubByEmail.set(u.email.trim().toLowerCase(), u);
      });

      const authUsers = authRes.users || [];
      const mergedUsers = authUsers.map((au: any) => {
        const email = (au.email || "").trim().toLowerCase();
        const pu = pubByEmail.get(email) || {};
        const meta = au.user_metadata || {};
        const nome = meta.display_name || meta.nome || meta.full_name || meta.name || pu.nome || email;

        return {
          id: au.id,
          authId: au.id,
          nome,
          email: au.email,
          cargo: meta.cargo || pu.cargo || '',
          contato: pu.contato || meta.contato || '',
          cpf: pu.cpf || meta.cpf || '',
          senha: pu.senha || '',
          oab: pu.oab || meta.oab || '',
          permissao: meta.permissao || pu.permissao || 'user',
          escritoriosIds: meta.escritorios_ids || pu.escritorios_ids || [],
          status: meta.status || pu.status || (au.banned_until ? 'Inativo' : 'Ativo'),
          fotoUrl: meta.avatar_url || pu.foto_url,
          theme: pu.theme,
          itemsPerPage: pu.items_per_page,
          menuOrder: pu.menu_order,
          enableNotifications: pu.enable_notifications !== false,
          createdAt: au.created_at,
          lastSignInAt: au.last_sign_in_at
        };
      });

      return res.json({ success: true, users: mergedUsers });
    } catch (err: any) {
      console.error("[Server Supabase Admin Users] Erro ao listar usuários:", err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 2. ADICIONAR USUÁRIO DIRETAMENTE EM AUTH.USERS (e sincronizar public.usuarios)
  app.post("/api/supabase/admin/users", async (req, res) => {
    const { email, nome, cargo, permissao, escritoriosIds, oab, cpf, contato, status } = req.body;
    const password = req.body.password || req.body.senha;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "E-mail e senha são obrigatórios." });
    }

    const supabaseUrl = (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('127.0.0.1') && !process.env.SUPABASE_URL.includes('walbermendonca')) ? process.env.SUPABASE_URL : 'https://qhxdujbsipgwthrgvncl.supabase.co';
    const supabaseKey = (process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi')) ? process.env.SUPABASE_SECRET_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL');
    const hasServiceRole = !!(process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi'));

    const safePassword = password.toString().trim().length >= 6 
      ? password.toString().trim() 
      : password.toString().trim().padEnd(6, '0');
    const normalizedEmail = email.trim().toLowerCase();
    const fullName = nome ? nome.trim() : normalizedEmail;

    try {
      if (!hasServiceRole) {
        return res.status(500).json({ success: false, error: "Chave administrativa não configurada para criar em auth.users." });
      }

      // 1. Cria em auth.users
      const adminResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password: safePassword,
          email_confirm: true,
          user_metadata: {
            nome: fullName,
            display_name: fullName,
            full_name: fullName,
            name: fullName,
            cargo: cargo || '',
            permissao: permissao || 'user',
            escritorios_ids: escritoriosIds || [],
            oab: oab || '',
            cpf: cpf || '',
            contato: contato || '',
            status: status || 'Ativo'
          },
        }),
      });

      const adminData = await adminResp.json();
      if (!adminResp.ok) {
        const errorMsg = adminData.msg || adminData.message || JSON.stringify(adminData);
        return res.status(adminResp.status).json({ success: false, error: errorMsg });
      }

      const authId = adminData.id;

      // 2. Sincroniza em public.usuarios com o mesmo UUID de auth.users
      await fetch(`${supabaseUrl}/rest/v1/usuarios`, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          id: authId,
          nome: fullName,
          email: normalizedEmail,
          cargo: cargo || '',
          contato: contato || '',
          senha: password || null,
          oab: oab || null,
          cpf: cpf || '',
          permissao: permissao || 'user',
          escritorios_ids: escritoriosIds || [],
          status: status || 'Ativo',
          enable_notifications: true
        })
      });

      return res.json({
        success: true,
        user: {
          id: authId,
          nome: fullName,
          email: normalizedEmail,
          cargo: cargo || '',
          contato: contato || '',
          cpf: cpf || '',
          oab: oab || '',
          permissao: permissao || 'user',
          escritoriosIds: escritoriosIds || [],
          status: status || 'Ativo'
        }
      });
    } catch (err: any) {
      console.error("[Server Supabase Admin Create User] Exceção:", err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 3. ALTERAR USUÁRIO E SENHA DIRETAMENTE EM AUTH.USERS
  app.put("/api/supabase/admin/users/:id", async (req, res) => {
    const { id } = req.params;
    const { email, nome, cargo, permissao, escritoriosIds, oab, cpf, contato, status } = req.body;
    const password = req.body.password || req.body.senha;

    const supabaseUrl = (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('127.0.0.1') && !process.env.SUPABASE_URL.includes('walbermendonca')) ? process.env.SUPABASE_URL : 'https://qhxdujbsipgwthrgvncl.supabase.co';
    const supabaseKey = (process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi')) ? process.env.SUPABASE_SECRET_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL');
    const hasServiceRole = !!(process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi'));

    if (!hasServiceRole) {
      return res.status(500).json({ success: false, error: "Chave administrativa não configurada para atualizar em auth.users." });
    }

    try {
      let targetAuthId = id;
      const normalizedEmail = email ? email.trim().toLowerCase() : undefined;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUUID && normalizedEmail) {
        const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }).then(r => r.json());
        const match = (listRes.users || []).find((u: any) => (u.email || "").toLowerCase().trim() === normalizedEmail);
        if (match) targetAuthId = match.id;
      }

      // Monta payload de atualização para auth.users
      const authUpdatePayload: any = {
        user_metadata: {
          nome: nome?.trim(),
          display_name: nome?.trim(),
          full_name: nome?.trim(),
          name: nome?.trim(),
          cargo: cargo || '',
          permissao: permissao || 'user',
          escritorios_ids: escritoriosIds || [],
          oab: oab || '',
          cpf: cpf || '',
          contato: contato || '',
          status: status || 'Ativo'
        }
      };

      if (password && password.trim().length >= 6) {
        authUpdatePayload.password = password.trim();
      }

      if (normalizedEmail) {
        authUpdatePayload.email = normalizedEmail;
        authUpdatePayload.email_confirm = true;
      }

      // 1. Atualiza em auth.users
      const updateAuthResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetAuthId}`, {
        method: "PUT",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(authUpdatePayload)
      });

      if (!updateAuthResp.ok) {
        const errJson = await updateAuthResp.json();
        console.warn("[Server Supabase Admin Update User] Erro ao atualizar em auth.users:", errJson);
        return res.status(updateAuthResp.status).json({ success: false, error: errJson.msg || errJson.message || JSON.stringify(errJson) });
      }

      // 2. Sincroniza em public.usuarios
      const pubPayload: any = {
        id: targetAuthId,
        nome: nome?.trim(),
        cargo: cargo || '',
        contato: contato || '',
        oab: oab || null,
        cpf: cpf || '',
        permissao: permissao || 'user',
        escritorios_ids: escritoriosIds || [],
        status: status || 'Ativo'
      };
      if (normalizedEmail) pubPayload.email = normalizedEmail;
      if (password && password.trim().length >= 6) pubPayload.senha = password.trim();

      await fetch(`${supabaseUrl}/rest/v1/usuarios`, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify(pubPayload)
      });

      return res.json({ success: true, updated: true });
    } catch (err: any) {
      console.error("[Server Supabase Admin Update User] Exceção:", err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 4. EXCLUIR USUÁRIO DIRETAMENTE DE AUTH.USERS (e de public.usuarios)
  app.delete("/api/supabase/admin/users/:id", async (req, res) => {
    const { id } = req.params;
    const email = req.query.email as string | undefined;

    const supabaseUrl = (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('127.0.0.1') && !process.env.SUPABASE_URL.includes('walbermendonca')) ? process.env.SUPABASE_URL : 'https://qhxdujbsipgwthrgvncl.supabase.co';
    const supabaseKey = (process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi')) ? process.env.SUPABASE_SECRET_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL');
    const hasServiceRole = !!(process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi'));

    if (!hasServiceRole) {
      return res.status(500).json({ success: false, error: "Chave administrativa não configurada para excluir de auth.users." });
    }

    try {
      let targetAuthId = id;
      const normalizedEmail = email ? email.trim().toLowerCase() : undefined;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUUID && normalizedEmail) {
        const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }).then(r => r.json());
        const match = (listRes.users || []).find((u: any) => (u.email || "").toLowerCase().trim() === normalizedEmail);
        if (match) targetAuthId = match.id;
      }

      // 1. Exclui de auth.users
      const delAuthResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetAuthId}`, {
        method: "DELETE",
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });

      if (!delAuthResp.ok) {
        const errJson = await delAuthResp.json().catch(() => ({}));
        console.warn("[Server Supabase Admin Delete User] Aviso ao excluir de auth.users:", errJson);
      }

      // 2. Exclui de public.usuarios
      await fetch(`${supabaseUrl}/rest/v1/usuarios?id=eq.${encodeURIComponent(targetAuthId)}`, {
        method: "DELETE",
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      if (normalizedEmail) {
        await fetch(`${supabaseUrl}/rest/v1/usuarios?email=eq.${encodeURIComponent(normalizedEmail)}`, {
          method: "DELETE",
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
      }

      return res.json({ success: true, deleted: true });
    } catch (err: any) {
      console.error("[Server Supabase Admin Delete User] Exceção:", err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // API para criação/provisionamento de usuário no Supabase Auth
  app.post("/api/supabase/create-user", async (req, res) => {
    const { email, password, nome, cargo, permissao } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "E-mail e senha são obrigatórios." });
    }

    const supabaseUrl = (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('127.0.0.1') && !process.env.SUPABASE_URL.includes('walbermendonca')) ? process.env.SUPABASE_URL : 'https://qhxdujbsipgwthrgvncl.supabase.co';
    const supabaseKey = (process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi')) ? process.env.SUPABASE_SECRET_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL');
    const hasServiceRole = !!(process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi'));

    // Garante que a senha atenda ao requisito mínimo de 6 dígitos do Supabase Auth
    const safePassword = password.toString().trim().length >= 6 
      ? password.toString().trim() 
      : password.toString().trim().padEnd(6, '0');

    try {
      if (hasServiceRole) {
        const adminResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password: safePassword,
            email_confirm: true,
            user_metadata: {
              nome,
              display_name: nome,
              full_name: nome,
              name: nome,
              cargo,
              permissao
            },
          }),
        });

        const adminData = await adminResp.json();
        if (!adminResp.ok) {
          console.warn("[Server Supabase Auth Admin] Erro:", adminData);
          return res.status(adminResp.status).json({ success: false, error: adminData.msg || adminData.message || JSON.stringify(adminData) });
        }
        return res.json({ success: true, user: adminData });
      } else {
        const signUpResp = await fetch(`${supabaseUrl}/auth/v1/signup`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password: safePassword,
            data: {
              nome,
              display_name: nome,
              full_name: nome,
              name: nome,
              cargo,
              permissao
            },
          }),
        });

        const signUpData = await signUpResp.json();
        if (!signUpResp.ok) {
          console.warn("[Server Supabase Auth Signup] Erro:", signUpData);
          return res.status(signUpResp.status).json({ success: false, error: signUpData.msg || signUpData.message || JSON.stringify(signUpData) });
        }
        return res.json({ success: true, user: signUpData });
      }
    } catch (err: any) {
      console.error("[Server Supabase Auth] Exceção:", err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // API para importação em lote de usuários para o Supabase Auth
  app.post("/api/supabase/import-users-batch", async (req, res) => {
    const { users, defaultPassword = 'Mudar123!' } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: "Nenhum usuário informado para importação." });
    }

    const supabaseUrl = (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('127.0.0.1') && !process.env.SUPABASE_URL.includes('walbermendonca')) ? process.env.SUPABASE_URL : 'https://qhxdujbsipgwthrgvncl.supabase.co';
    const supabaseKey = (process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi')) ? process.env.SUPABASE_SECRET_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL');
    const hasServiceRole = !!(process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SECRET_KEY.startsWith('eyJhbGciOi'));

    let createdCount = 0;
    let alreadyRegisteredCount = 0;
    const errors: Array<{ email: string; nome: string; error: string }> = [];

    for (const u of users) {
      const email = (u.email || '').trim().toLowerCase();
      const nome = u.nome || 'Usuário';

      if (!email || !email.includes('@') || !email.includes('.')) {
        errors.push({ email: email || 'Não informado', nome, error: 'E-mail inválido ou vazio.' });
        continue;
      }

      const rawPassword = (u.senha || defaultPassword).toString().trim();
      const safePassword = rawPassword.length >= 6 ? rawPassword : rawPassword.padEnd(6, '0');

      try {
        if (hasServiceRole) {
          const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
            method: "POST",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password: safePassword,
              email_confirm: true,
              user_metadata: {
                nome,
                display_name: nome,
                full_name: nome,
                name: nome,
                cargo: u.cargo || '',
                permissao: u.permissao || 'user',
                oab: u.oab || '',
                cpf: u.cpf || ''
              },
            }),
          });

          const data = await resp.json();
          if (resp.ok) {
            createdCount++;
          } else {
            const msg = data.msg || data.message || JSON.stringify(data);
            if (msg.includes('already registered') || msg.includes('already been registered')) {
              alreadyRegisteredCount++;
            } else {
              errors.push({ email, nome, error: msg });
            }
          }
        } else {
          const resp = await fetch(`${supabaseUrl}/auth/v1/signup`, {
            method: "POST",
            headers: {
              "apikey": supabaseKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password: safePassword,
              data: {
                nome,
                display_name: nome,
                full_name: nome,
                name: nome,
                cargo: u.cargo || '',
                permissao: u.permissao || 'user',
                oab: u.oab || '',
                cpf: u.cpf || ''
              },
            }),
          });

          const data = await resp.json();
          if (resp.ok) {
            // Se identities estiver vazio, usuário já existe no auth
            if (data.identities && data.identities.length === 0) {
              alreadyRegisteredCount++;
            } else {
              createdCount++;
            }
          } else {
            const msg = data.msg || data.message || JSON.stringify(data);
            if (msg.includes('already registered') || msg.includes('already been registered')) {
              alreadyRegisteredCount++;
            } else {
              errors.push({ email, nome, error: msg });
            }
          }
        }
      } catch (err: any) {
        errors.push({ email, nome, error: err.message || String(err) });
      }
    }

    return res.json({
      success: true,
      total: users.length,
      created: createdCount,
      alreadyRegistered: alreadyRegisteredCount,
      errorsCount: errors.length,
      errors
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
