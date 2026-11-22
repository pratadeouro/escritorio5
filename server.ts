import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import cron from "node-cron";
import Papa from "papaparse";
import { getWeeklyReportTemplate, getNewNotificationsTemplate, getDailyReportTemplate } from "./emailTemplatesServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let envFilePort: string | undefined;

// Carrega o arquivo .env dando prioridade absoluta aos valores definidos nele sobre variáveis antigas do container
(() => {
  const cwdEnv = path.resolve(process.cwd(), ".env");
  const dirEnv = path.resolve(__dirname, ".env");
  const envPath = fs.existsSync(cwdEnv) ? cwdEnv : (fs.existsSync(dirEnv) ? dirEnv : null);
  if (!envPath) {
    dotenv.config();
    return;
  }
  const parsed = dotenv.parse(fs.readFileSync(envPath, "utf-8"));
  envFilePort = (parsed.SERVER_PORT || parsed.APP_PORT || parsed.PORT || parsed.port || "").trim() || undefined;
  const allowEmptyOverrideKeys = new Set([
    "VITE_SPREADSHEET_ID",
    "SPREADSHEET_ID",
    "VITE_SCRIPT_URL",
    "SCRIPT_URL",
  ]);
  for (const [key, val] of Object.entries(parsed)) {
    const clean = val.trim();
    if (clean !== "" || allowEmptyOverrideKeys.has(key) || process.env[key] === undefined) {
      process.env[key] = clean;
    }
  }
})();

const resolveServerPort = (): number => {
  const parseValidPort = (val?: string): number | null => {
    if (!val) return null;
    const n = Number(String(val).trim());
    return Number.isInteger(n) && n > 0 && n <= 65535 ? n : null;
  };

  const fromEnvFile = parseValidPort(envFilePort);
  if (fromEnvFile) return fromEnvFile;

  const fromExplicitVar = parseValidPort(process.env.SERVER_PORT || process.env.APP_PORT || process.env.port);
  if (fromExplicitVar) return fromExplicitVar;

  const isManagedCloudContainer = !!(process.env.K_SERVICE || process.env.K_REVISION);
  if (!isManagedCloudContainer) {
    const fromProcessPort = parseValidPort(process.env.PORT);
    if (fromProcessPort) return fromProcessPort;
  }

  return 3000;
};

const getEnvSpreadsheetId = (): string =>
  (process.env.VITE_SPREADSHEET_ID || process.env.SPREADSHEET_ID || '').trim();

const getServerSupabaseConfig = () => {
  const candidates = [process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL]
    .map(v => (v || '').trim().replace(/\/$/, ''))
    .filter(Boolean);
  const supabaseUrl = candidates.find(u => u.startsWith('https://')) || candidates[0] || '';
  const secretCandidates = [process.env.SUPABASE_SECRET_KEY, process.env.SERVICE_ROLE_KEY]
    .map(v => (v || '').trim())
    .filter(Boolean);
  const secretKey = secretCandidates.find(k => !k.startsWith('eyJhbGciOi')) || secretCandidates[0] || '';
  const publishableCandidates = [
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.VITE_ANON_KEY,
    process.env.ANON_KEY,
  ].map(v => (v || '').trim()).filter(Boolean);
  const publishableKey = publishableCandidates.find(k => k.startsWith('sb_publishable_')) || publishableCandidates[0] || '';
  const supabaseKey = secretKey || publishableKey;
  const hasServiceRole = !!secretKey;
  return { supabaseUrl, supabaseKey, secretKey, publishableKey, hasServiceRole };
};

// Helper to fetch CSV from Google Sheets
async function fetchSheetData(sheetName: string) {
  const spreadsheetId = getEnvSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&headers=1&t=${Date.now()}`;
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

async function fetchSupabaseTablePaged(
  supabaseUrl: string,
  supabaseKey: string,
  table: string,
  orderCol?: string,
  ascending = true,
  maxRows = 10000
): Promise<any[]> {
  const pageSize = 1000;
  const allRows: any[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const to = from + pageSize - 1;
    const orderParam = orderCol ? `&order=${encodeURIComponent(orderCol)}.${ascending ? 'asc' : 'desc'}` : '';
    const resp = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*${orderParam}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Range-Unit": "items",
        "Range": `${from}-${to}`
      }
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.warn(`[Supabase Email] Falha ao consultar tabela ${table} (HTTP ${resp.status}): ${errText}`);
      break;
    }
    const chunk = await resp.json().catch(() => []);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    allRows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return allRows;
}

const parseBoolFlag = (val: any): boolean => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  const norm = String(val || '').trim().toLowerCase();
  return norm === 'true' || norm === '1' || norm === 'sim' || norm === 'yes';
};

interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  source: 'office' | 'global_db' | 'env' | 'explicit';
}

const resolveSmtpFromSource = (
  source: { smtpHost?: string; smtpPort?: any; smtpSecure?: any; emailUser?: string; emailPass?: string },
  sourceLabel: ResolvedSmtpConfig['source']
): ResolvedSmtpConfig | null => {
  const user = String(source.emailUser || '').trim();
  const pass = String(source.emailPass || '').trim();
  let host = String(source.smtpHost || '').trim();
  let port = Number(source.smtpPort) || 465;
  let secure = source.smtpSecure === undefined || source.smtpSecure === null
    ? port === 465
    : parseBoolFlag(source.smtpSecure);

  if (!host && user && /@(gmail|googlemail)\.com$/i.test(user)) {
    host = 'smtp.gmail.com';
    port = Number(source.smtpPort) || 465;
    secure = port === 465;
  }

  if (!host || !user || !pass) return null;
  return { host, port, secure, user, pass, source: sourceLabel };
};

const getEnvSmtpFallback = (): ResolvedSmtpConfig | null => {
  return resolveSmtpFromSource({
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT || 465,
    smtpSecure: process.env.SMTP_SECURE ?? 'true',
    emailUser: process.env.SMTP_USER,
    emailPass: process.env.SMTP_PASS,
  }, 'env');
};

async function saveSupabaseEmailLog(
  supabaseUrl: string,
  supabaseKey: string,
  entry: { usuario?: string; acao: string; idEscritorio?: string; detalhes: string }
) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/logs`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: `log_mail_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
        data: new Date().toISOString(),
        usuario: entry.usuario || 'Sistema (Automação)',
        acao: entry.acao,
        id_escritorio: entry.idEscritorio || null,
        detalhes: entry.detalhes
      })
    });
  } catch (err) {
    console.warn('[Automation] Aviso ao gravar log no Supabase:', err);
  }
}

async function verifySupabaseCaller(req: express.Request): Promise<{
  email: string;
  userId?: string;
  isAdmin: boolean;
  escritoriosIds: string[];
} | null> {
  const authHeader = String(req.headers.authorization || '').trim();
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  const { supabaseUrl, supabaseKey, publishableKey } = getServerSupabaseConfig();
  const apiKey = supabaseKey || publishableKey;
  if (!supabaseUrl || !apiKey) return null;

  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${token}` }
    });
    if (!userResp.ok) return null;
    const authUser = await userResp.json().catch(() => null);
    const email = String(authUser?.email || '').trim().toLowerCase();
    if (!email) return null;

    let pu: any = null;
    if (supabaseKey) {
      const puResp = await fetch(
        `${supabaseUrl}/rest/v1/usuarios?email=ilike.${encodeURIComponent(email)}&select=id,email,permissao,status,escritorios_ids&limit=1`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (puResp.ok) {
        const rows = await puResp.json().catch(() => []);
        pu = Array.isArray(rows) ? rows[0] : null;
      }
    }

    const meta = authUser?.user_metadata || {};
    const status = String(pu?.status || meta.status || 'Ativo').trim().toLowerCase();
    if (email !== 'pratadeouro@gmail.com' && status === 'inativo') return null;

    const permStr = String(pu?.permissao || meta.permissao || '').toLowerCase();
    const isAdmin =
      email === 'pratadeouro@gmail.com' ||
      email.includes('walber') ||
      permStr.includes('admin') ||
      permStr.includes('gestor');

    let rawEsc = pu?.escritorios_ids ?? meta.escritorios_ids ?? meta.escritoriosIds ?? [];
    if (typeof rawEsc === 'string') {
      try { rawEsc = JSON.parse(rawEsc); } catch { rawEsc = rawEsc.split(',').map((s: string) => s.trim()).filter(Boolean); }
    }
    const escritoriosIds = Array.isArray(rawEsc)
      ? rawEsc.map((id: any) => String(id || '').trim().toUpperCase()).filter(Boolean)
      : [];

    return { email, userId: pu?.id || authUser?.id, isAdmin, escritoriosIds };
  } catch {
    return null;
  }
}

const sentAutomationRegistry = new Map<string, number>();

interface AutomationRunResult {
  success: boolean;
  source: 'supabase' | 'sheets';
  type: 'weekly' | 'daily';
  checkedOffices: number;
  matchedOffices: number;
  sentCount: number;
  errors: number;
  details: Array<{ officeId: string; officeName: string; emailTo: string; sent: string[]; error?: string }>;
}

const isTimeDueNow = (
  now: Date,
  timezone: string,
  dispatchTime: string,
  type: 'weekly' | 'daily'
): { due: boolean; currentTimeStr: string; localDateKey: string; reason?: string } => {
  try {
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(now);

    const year = timeParts.find(p => p.type === 'year')?.value || '2026';
    const month = timeParts.find(p => p.type === 'month')?.value || '01';
    const day = timeParts.find(p => p.type === 'day')?.value || '01';
    const currentHour = timeParts.find(p => p.type === 'hour')?.value || '00';
    const currentMinute = timeParts.find(p => p.type === 'minute')?.value || '00';
    const currentTimeStr = `${currentHour}:${currentMinute}`;
    const localDateKey = `${year}-${month}-${day}`;

    if (type === 'weekly') {
      const dayName = new Intl.DateTimeFormat('pt-BR', {
        timeZone: timezone,
        weekday: 'long'
      }).format(now).toLowerCase();
      if (!dayName.includes('segunda')) {
        return { due: false, currentTimeStr, localDateKey, reason: 'not_monday' };
      }
    }

    const [rawH, rawM] = String(dispatchTime || '08:00').split(':');
    const targetH = String(parseInt(rawH, 10) || 0).padStart(2, '0');
    const targetMin = parseInt(rawM, 10) || 0;
    const currMin = parseInt(currentMinute, 10) || 0;

    if (currentHour !== targetH) {
      return { due: false, currentTimeStr, localDateKey, reason: 'hour_mismatch' };
    }
    if (targetMin < currMin || targetMin >= currMin + 30) {
      return { due: false, currentTimeStr, localDateKey, reason: 'minute_window_mismatch' };
    }

    return { due: true, currentTimeStr, localDateKey };
  } catch (err) {
    console.error(`[Automation] Error checking timezone for ${timezone}:`, err);
    return { due: false, currentTimeStr: '00:00', localDateKey: now.toISOString().split('T')[0], reason: 'timezone_error' };
  }
};

async function runAutomatedEmails(
  type: 'weekly' | 'daily',
  options?: { force?: boolean; officeId?: string }
): Promise<AutomationRunResult> {
  const now = new Date();
  const rawDataSource = String(process.env.DATA_SOURCE || process.env.VITE_DATA_SOURCE || 'supabase').trim().toLowerCase();
  const dataSource: 'supabase' | 'sheets' = rawDataSource === 'sheets' ? 'sheets' : 'supabase';
  const forceRun = !!options?.force;
  const targetOfficeUpper = options?.officeId ? String(options.officeId).trim().toUpperCase() : '';

  console.log(`[Automation] Checking ${type} emails (${dataSource.toUpperCase()}${forceRun ? ', FORCE' : ''}) at ${now.toISOString()}...`);

  // ============================================================================
  // MODO SUPABASE (PADRÃO ATUAL)
  // ============================================================================
  if (dataSource === 'supabase') {
    const { supabaseUrl, supabaseKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Automation] Supabase não configurado no .env. Abortando disparo automático.');
      return { success: false, source: 'supabase', type, checkedOffices: 0, matchedOffices: 0, sentCount: 0, errors: 1, details: [] };
    }
    if (!hasServiceRole) {
      console.warn('[Automation] SUPABASE_SECRET_KEY não configurada; a leitura em segundo plano pode sofrer restrições de RLS.');
    }

    const [escritoriosRows, settingsRows] = await Promise.all([
      fetchSupabaseTablePaged(supabaseUrl, supabaseKey, 'escritorios'),
      fetchSupabaseTablePaged(supabaseUrl, supabaseKey, 'app_settings'),
    ]);

    const globalSetting =
      settingsRows.find((s: any) => String(s?.id || '').trim().toLowerCase() === 'global') ||
      settingsRows.find((s: any) => String(s?.id_escritorio || '').trim().toUpperCase() === 'GLOBAL') ||
      settingsRows[0] ||
      null;

    const envSmtpFallback = getEnvSmtpFallback();
    const globalDbSmtp = globalSetting
      ? resolveSmtpFromSource({
          smtpHost: globalSetting.smtp_host,
          smtpPort: globalSetting.smtp_port,
          smtpSecure: globalSetting.smtp_secure,
          emailUser: globalSetting.email_user,
          emailPass: globalSetting.email_pass,
        }, 'global_db')
      : null;

    interface OfficeEmailJob {
      officeId: string;
      officeIdUpper: string;
      officeName: string;
      responsavel: string;
      emailTo: string;
      wantsWeekly: boolean;
      wantsDaily: boolean;
      wantsNotifications: boolean;
      diasMorosidade: number;
      templateWeekly?: string;
      templateDaily?: string;
      templateNotifications?: string;
      localDateKey: string;
      smtp: ResolvedSmtpConfig | null;
      scriptUrl?: string;
    }

    const jobs: OfficeEmailJob[] = [];

    for (const office of escritoriosRows) {
      const officeId = String(office?.id || '').trim();
      const officeIdUpper = officeId.toUpperCase();
      if (!officeId) continue;
      if (targetOfficeUpper && officeIdUpper !== targetOfficeUpper) continue;

      const officeSetting = settingsRows.find((s: any) => {
        const sEsc = String(s?.id_escritorio || '').trim().toUpperCase();
        const sId = String(s?.id || '').trim().toUpperCase();
        return sEsc === officeIdUpper || sId === officeIdUpper;
      });

      const isEnabled =
        parseBoolFlag(office?.enable_email_notifications) ||
        parseBoolFlag(officeSetting?.enable_email_notifications);
      const wantsWeekly =
        parseBoolFlag(office?.email_weekly_report) ||
        parseBoolFlag(officeSetting?.email_weekly_report);
      const wantsDaily =
        parseBoolFlag(office?.email_daily_report) ||
        parseBoolFlag(officeSetting?.email_daily_report);
      const wantsNotifications =
        parseBoolFlag(office?.email_new_notifications) ||
        parseBoolFlag(officeSetting?.email_new_notifications);

      if (!isEnabled) continue;
      if (type === 'weekly' && !wantsWeekly) continue;
      if (type === 'daily' && !wantsDaily && !wantsNotifications) continue;

      const timezone = office?.timezone || officeSetting?.timezone || globalSetting?.timezone || 'America/Sao_Paulo';
      const dispatchTime = office?.email_dispatch_time || officeSetting?.email_dispatch_time || globalSetting?.email_dispatch_time || '08:00';

      const scheduleCheck = isTimeDueNow(now, timezone, dispatchTime, type);
      if (!forceRun && !scheduleCheck.due) continue;

      const officeSmtp =
        resolveSmtpFromSource({
          smtpHost: office?.smtp_host || officeSetting?.smtp_host,
          smtpPort: office?.smtp_port || officeSetting?.smtp_port,
          smtpSecure: office?.smtp_secure ?? officeSetting?.smtp_secure,
          emailUser: office?.email_user || officeSetting?.email_user,
          emailPass: office?.email_pass || officeSetting?.email_pass,
        }, 'office') ||
        globalDbSmtp ||
        envSmtpFallback;

      const emailTo = String(
        office?.email ||
        office?.email_user ||
        officeSetting?.email_user ||
        officeSmtp?.user ||
        ''
      ).trim();

      if (!emailTo) continue;

      console.log(
        `[Automation/Supabase] Escritório ${office?.nome || officeId} apto para ${type} (Hora local: ${scheduleCheck.currentTimeStr}, Agendado: ${dispatchTime})`
      );

      jobs.push({
        officeId,
        officeIdUpper,
        officeName: office?.nome || 'Meu Escritório',
        responsavel: office?.responsavel || '',
        emailTo,
        wantsWeekly,
        wantsDaily,
        wantsNotifications,
        diasMorosidade: Number(office?.dias_morosidade || officeSetting?.dias_morosidade || globalSetting?.dias_morosidade || 30) || 30,
        templateWeekly: office?.template_weekly_report || officeSetting?.template_weekly_report || globalSetting?.template_weekly_report,
        templateDaily: office?.template_daily_report || officeSetting?.template_daily_report || globalSetting?.template_daily_report,
        templateNotifications: office?.template_new_notifications || officeSetting?.template_new_notifications || globalSetting?.template_new_notifications,
        localDateKey: scheduleCheck.localDateKey,
        smtp: officeSmtp,
        scriptUrl: process.env.VITE_SCRIPT_URL || process.env.SCRIPT_URL || '',
      });
    }

    if (jobs.length === 0) {
      console.log(`[Automation/Supabase] Nenhum escritório para notificar (${type}).`);
      return {
        success: true,
        source: 'supabase',
        type,
        checkedOffices: escritoriosRows.length,
        matchedOffices: 0,
        sentCount: 0,
        errors: 0,
        details: []
      };
    }

    const [processos, tarefas, contatos, eventos, movimentos] = await Promise.all([
      fetchSupabaseTablePaged(supabaseUrl, supabaseKey, 'processos'),
      fetchSupabaseTablePaged(supabaseUrl, supabaseKey, 'tarefas'),
      fetchSupabaseTablePaged(supabaseUrl, supabaseKey, 'contatos'),
      fetchSupabaseTablePaged(supabaseUrl, supabaseKey, 'eventos'),
      fetchSupabaseTablePaged(supabaseUrl, supabaseKey, 'movimentos'),
    ]);

    let sentCount = 0;
    let errors = 0;
    const details: AutomationRunResult['details'] = [];

    for (const job of jobs) {
      const sentForOffice: string[] = [];
      let officeError: string | undefined;

      const sendViaJob = async (reportKind: string, to: string, sub: string, html: string): Promise<boolean> => {
        const dedupKey = `${job.officeIdUpper}:${type}:${reportKind}:${job.localDateKey}`;
        if (!forceRun && sentAutomationRegistry.has(dedupKey)) {
          console.log(`[Automation/Supabase] Pulando envio duplicado hoje (${dedupKey}).`);
          return false;
        }

        try {
          if (job.smtp) {
            const transporter = nodemailer.createTransport({
              host: job.smtp.host,
              port: job.smtp.port,
              secure: job.smtp.secure,
              auth: { user: job.smtp.user, pass: job.smtp.pass }
            });
            await transporter.sendMail({
              from: `"${job.officeName}" <${job.smtp.user}>`,
              to,
              subject: sub,
              html
            });
          } else if (job.scriptUrl) {
            await fetch(job.scriptUrl, {
              method: 'POST',
              body: JSON.stringify({ action: 'sendEmail', to, subject: sub, body: html }),
              headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
          } else {
            throw new Error('Nenhum servidor SMTP configurado (nem no escritório, nem nas configurações globais, nem no .env).');
          }

          if (!forceRun) {
            sentAutomationRegistry.set(dedupKey, Date.now());
          }
          sentCount++;
          sentForOffice.push(reportKind);
          console.log(`[Automation/Supabase] E-mail (${reportKind}) enviado para ${to} - ${sub}`);

          await saveSupabaseEmailLog(supabaseUrl, supabaseKey, {
            acao: 'EMAIL_AUTOMATICO',
            idEscritorio: job.officeId,
            detalhes: `Disparo automático (${reportKind}) enviado para ${to}: ${sub}`
          });
          return true;
        } catch (err: any) {
          errors++;
          officeError = err?.message || String(err);
          console.error(`[Automation/Supabase] Erro ao enviar (${reportKind}) para ${to}:`, err);
          await saveSupabaseEmailLog(supabaseUrl, supabaseKey, {
            acao: 'EMAIL_AUTOMATICO_ERRO',
            idEscritorio: job.officeId,
            detalhes: `Falha no disparo automático (${reportKind}) para ${to}: ${officeError}`
          });
          return false;
        }
      };

      const matchesOffice = (row: any) => String(row?.escritorio_id || '').trim().toUpperCase() === job.officeIdUpper;

      const officeProcessosAtivos = processos.filter(p => {
        if (!matchesOffice(p)) return false;
        const st = String(p?.status || '').trim().toLowerCase();
        const atv = String(p?.ativo || '').trim().toLowerCase();
        return st === 'ativo' || atv === 'ativo' || atv === 'true';
      });

      const officeTarefasPendentes = tarefas.filter(t => {
        if (!matchesOffice(t)) return false;
        const st = String(t?.status || '').trim().toLowerCase();
        return st !== 'concluída' && st !== 'concluida';
      });

      const officeClientes = contatos.filter(c => {
        if (!matchesOffice(c)) return false;
        return String(c?.tipo || '').trim().toLowerCase() === 'cliente';
      });

      const officeEventosPendentes = eventos.filter(e => {
        if (!matchesOffice(e)) return false;
        return !parseBoolFlag(e?.concluido);
      });

      const officeProcessosPendentes = processos.filter(p => {
        if (!matchesOffice(p)) return false;
        const statusRaw = String(p?.ativo || p?.status || '').toLowerCase();
        const tagsRaw = String(p?.tags || '').toLowerCase();
        return statusRaw.includes('pend') || statusRaw === 'p' || tagsRaw.includes('pendência') || tagsRaw.includes('pendencia');
      });

      const processosMorosos = officeProcessosAtivos.filter(p => {
        const pKeys = new Set(
          [p?.id, p?.id_proc, p?.numero].map(v => String(v || '').trim()).filter(Boolean)
        );
        const movs = movimentos.filter(m => pKeys.has(String(m?.processo_id || '').trim()));

        if (movs.length === 0) {
          if (!p?.data_distribuicao) return false;
          const dataDist = new Date(p.data_distribuicao);
          if (isNaN(dataDist.getTime())) return false;
          const diffDays = Math.ceil(Math.abs(now.getTime() - dataDist.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays > job.diasMorosidade;
        }

        const ultMov = movs.sort((a, b) => new Date(b?.data || 0).getTime() - new Date(a?.data || 0).getTime())[0];
        const dataMov = new Date(ultMov?.data);
        if (isNaN(dataMov.getTime())) return false;
        const diffDays = Math.ceil(Math.abs(now.getTime() - dataMov.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays > job.diasMorosidade;
      });

      let publicationsToday = 0;
      let notificationsItems: any[] = [];
      if (job.responsavel && (type === 'daily' || job.wantsNotifications)) {
        try {
          const today = job.localDateKey || now.toISOString().split('T')[0];
          const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=1&itensPorPagina=10&dataDisponibilizacaoInicio=${today}&dataDisponibilizacaoFim=${today}&nomeAdvogado=${encodeURIComponent(job.responsavel)}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            publicationsToday = data.count || 0;
            notificationsItems = data.items || [];
          }
        } catch (err) {
          console.error(`[Automation/Supabase] Erro ao consultar DJEN para ${job.responsavel}:`, err);
        }
      }

      if (type === 'weekly' && job.wantsWeekly) {
        const subject = `Resumo Semanal - ${job.officeName}`;
        const body = getWeeklyReportTemplate({
          officeName: job.officeName,
          activeProcesses: officeProcessosAtivos.length,
          pendingTasks: officeTarefasPendentes.length,
          totalCustomers: officeClientes.length,
          pendingEvents: officeEventosPendentes.length,
          pendingProcesses: officeProcessosPendentes.length,
          lateProcesses: processosMorosos.length,
          publicationsToday,
          year: now.getFullYear()
        }, job.templateWeekly);
        if (body) await sendViaJob('weekly', job.emailTo, subject, body);
      }

      if (type === 'daily') {
        if (job.wantsDaily) {
          const subject = `Relatório Diário - ${job.officeName}`;
          const body = getDailyReportTemplate({
            officeName: job.officeName,
            publicationsToday,
            pendingTasks: officeTarefasPendentes.length,
            pendingProcesses: officeProcessosPendentes.length,
            pendingEvents: officeEventosPendentes.length,
            lateProcesses: processosMorosos.length,
            diasMorosidade: job.diasMorosidade,
            year: now.getFullYear()
          }, job.templateDaily);
          if (body) await sendViaJob('daily', job.emailTo, subject, body);
        }

        if (job.wantsNotifications && publicationsToday > 0) {
          const subject = `Novas Intimações - ${job.officeName}`;
          const body = getNewNotificationsTemplate({
            officeName: job.officeName,
            date: now.toLocaleDateString('pt-BR'),
            count: publicationsToday,
            responsible: job.responsavel,
            items: notificationsItems.slice(0, 5).map(item => ({
              numeroProcesso: item.numeroProcesso,
              texto: item.texto || '',
              orgao: item.orgaoMnemonic
            })),
            year: now.getFullYear()
          }, job.templateNotifications);
          if (body) await sendViaJob('notifications', job.emailTo, subject, body);
        }
      }

      details.push({
        officeId: job.officeId,
        officeName: job.officeName,
        emailTo: job.emailTo,
        sent: sentForOffice,
        ...(officeError ? { error: officeError } : {})
      });
    }

    return {
      success: errors === 0,
      source: 'supabase',
      type,
      checkedOffices: escritoriosRows.length,
      matchedOffices: jobs.length,
      sentCount,
      errors,
      details
    };
  }

  // ============================================================================
  // MODO GOOGLE SHEETS (LEGADO, QUANDO DATA_SOURCE=sheets)
  // ============================================================================
  const settingsData = await fetchSheetData('Configuracoes');
  const officesData = await fetchSheetData('Escritorios');

  const officesToNotify = settingsData.filter(setting => {
    const isEnabled = parseBoolFlag(setting.enableEmailNotifications);
    const wantsWeekly = parseBoolFlag(setting.emailWeeklyReport);
    const wantsDaily = parseBoolFlag(setting.emailDailyReport);
    const wantsNotifications = parseBoolFlag(setting.emailNewNotifications);

    if (!isEnabled) return false;
    if (type === 'weekly' && !wantsWeekly) return false;
    if (type === 'daily' && !wantsDaily && !wantsNotifications) return false;

    const officeIdUpper = String(setting.idEscritorio || setting.ID_ESCRITORIO || '').trim().toUpperCase();
    if (targetOfficeUpper && officeIdUpper !== targetOfficeUpper) return false;

    const officeTimezone = setting.timezone || 'America/Sao_Paulo';
    const dispatchTime = setting.emailDispatchTime || '08:00';
    const check = isTimeDueNow(now, officeTimezone, dispatchTime, type);
    return forceRun || check.due;
  });

  if (officesToNotify.length === 0) {
    console.log(`[Automation/Sheets] No offices to notify for ${type}.`);
    return { success: true, source: 'sheets', type, checkedOffices: officesData.length, matchedOffices: 0, sentCount: 0, errors: 0, details: [] };
  }

  const [processos, tarefas, contatos, eventos, movimentos] = await Promise.all([
    fetchSheetData('Processos'),
    fetchSheetData('Tarefas'),
    fetchSheetData('Contatos'),
    fetchSheetData('Eventos'),
    fetchSheetData('Movimentos'),
  ]);

  let sentCount = 0;
  let errors = 0;
  const details: AutomationRunResult['details'] = [];

  for (const setting of officesToNotify) {
    const officeId = (setting.idEscritorio || setting.ID_ESCRITORIO || '').toString().trim();
    const office = officesData.find(o => (o.ID_ESCRITORIO || o.ID || '').toString().trim() === officeId);
    if (!office) continue;

    const emailTo = setting.emailUser || office.EMAIL || '';
    if (!emailTo) continue;

    const useExternal = parseBoolFlag(setting.useExternalSmtp);
    const scriptUrl = process.env.VITE_SCRIPT_URL || setting.scriptUrl;
    const sentForOffice: string[] = [];
    let officeError: string | undefined;

    const sendHelper = async (kind: string, to: string, sub: string, content: string) => {
      try {
        const fromName = office.Escritorio_nome || 'Meu Escritório';
        if (useExternal && setting.smtpHost && setting.emailUser && setting.emailPass) {
          const transporter = nodemailer.createTransport({
            host: setting.smtpHost,
            port: parseInt(setting.smtpPort) || 465,
            secure: parseBoolFlag(setting.smtpSecure),
            auth: { user: setting.emailUser, pass: setting.emailPass }
          });
          await transporter.sendMail({ from: `"${fromName}" <${setting.emailUser}>`, to, subject: sub, html: content });
          sentCount++;
          sentForOffice.push(kind);
        } else if (scriptUrl) {
          await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'sendEmail', to, subject: sub, body: content, user: setting.emailUser, pass: setting.emailPass }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
          });
          sentCount++;
          sentForOffice.push(kind);
        }
        console.log(`[Automation/Sheets] Email sent to ${to} - ${sub}`);
      } catch (err: any) {
        errors++;
        officeError = err?.message || String(err);
        console.error(`[Automation/Sheets] Failed to send email to ${to} (${sub}):`, err);
      }
    };

    if (type === 'weekly') {
      const subject = `Resumo Semanal - ${office.Escritorio_nome || 'Meu Escritorio'}`;
      const officeProcessos = processos.filter(p => (p.ID_ESCRITORIO || '').toString().trim() === officeId && (p.STATUS === 'Ativo' || p.ATIVO === 'TRUE' || p.status === 'Ativo'));
      const officeTarefas = tarefas.filter(t => (t.ID_ESCRITORIO || '').toString().trim() === officeId && (t.STATUS !== 'ConcluidA' && t.STATUS !== 'Concluída' && t.STATUS !== 'concluida'));
      const officeContatos = contatos.filter(c => (c.ID_ESCRITORIO || '').toString().trim() === officeId && c.TIPO === 'Cliente');
      const officeEventos = eventos.filter(e => (e.ID_ESCRITORIO || '').toString().trim() === officeId && !parseBoolFlag(e.CONCLUIDO));
      const officeProcessosPendentes = processos.filter(p => {
        if ((p.ID_ESCRITORIO || '').toString().trim() !== officeId) return false;
        const statusRaw = (p.ATIVO || p.STATUS || '').toLowerCase();
        const tagsRaw = (p.TAGS || '').toLowerCase();
        return statusRaw.includes('pend') || statusRaw === 'p' || tagsRaw.includes('pendência') || tagsRaw.includes('pendencia');
      });

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
          return Math.ceil(Math.abs(hoje.getTime() - dataDist.getTime()) / (1000 * 60 * 60 * 24)) > diasMorosidade;
        }
        const ultMov = movs.sort((a, b) => new Date(b.DATA || b.data).getTime() - new Date(a.DATA || a.data).getTime())[0];
        const dataMov = new Date(ultMov.DATA || ultMov.data);
        if (isNaN(dataMov.getTime())) return false;
        return Math.ceil(Math.abs(hoje.getTime() - dataMov.getTime()) / (1000 * 60 * 60 * 24)) > diasMorosidade;
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

      if (body) await sendHelper('weekly', emailTo, subject, body);
    } else if (type === 'daily') {
      const wantsDailyReport = parseBoolFlag(setting.emailDailyReport);
      const wantsNotifications = parseBoolFlag(setting.emailNewNotifications);

      let publicationsToday = 0;
      let notificationsItems: any[] = [];
      const responsavel = office.RESPONSAVEL || '';

      if (responsavel) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=1&itensPorPagina=10&dataDisponibilizacaoInicio=${today}&dataDisponibilizacaoFim=${today}&nomeAdvogado=${encodeURIComponent(responsavel)}`;
          const response = await fetch(url);
          const data = await response.json();
          publicationsToday = data.count || 0;
          notificationsItems = data.items || [];
        } catch (err) {
          console.error(`[Automation/Sheets] Error fetching notifications for ${responsavel}:`, err);
        }
      }

      if (wantsDailyReport) {
        const subject = `Relatório Diário - ${office.Escritorio_nome || 'Meu Escritorio'}`;
        const officeProcessos = processos.filter(p => (p.ID_ESCRITORIO || '').toString().trim() === officeId && (p.STATUS === 'Ativo' || p.ATIVO === 'TRUE' || p.status === 'Ativo'));
        const officeTarefas = tarefas.filter(t => (t.ID_ESCRITORIO || '').toString().trim() === officeId && (t.STATUS !== 'ConcluidA' && t.STATUS !== 'Concluída' && t.STATUS !== 'concluida'));
        const officeEventos = eventos.filter(e => (e.ID_ESCRITORIO || '').toString().trim() === officeId && !parseBoolFlag(e.CONCLUIDO));
        const officeProcessosPendentes = processos.filter(p => {
          if ((p.ID_ESCRITORIO || '').toString().trim() !== officeId) return false;
          const statusRaw = (p.ATIVO || p.STATUS || '').toLowerCase();
          const tagsRaw = (p.TAGS || '').toLowerCase();
          return statusRaw.includes('pend') || statusRaw === 'p' || tagsRaw.includes('pendência') || tagsRaw.includes('pendencia');
        });

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
            return Math.ceil(Math.abs(hoje.getTime() - dataDist.getTime()) / (1000 * 60 * 60 * 24)) > diasMorosidade;
          }
          const ultMov = movs.sort((a, b) => new Date(b.DATA || b.data).getTime() - new Date(a.DATA || a.data).getTime())[0];
          const dataMov = new Date(ultMov.DATA || ultMov.data);
          if (isNaN(dataMov.getTime())) return false;
          return Math.ceil(Math.abs(hoje.getTime() - dataMov.getTime()) / (1000 * 60 * 60 * 24)) > diasMorosidade;
        });

        const body = getDailyReportTemplate({
          officeName: office.Escritorio_nome || 'Meu Escritório',
          publicationsToday,
          pendingTasks: officeTarefas.length,
          pendingProcesses: officeProcessosPendentes.length,
          pendingEvents: officeEventos.length,
          lateProcesses: processosMorosos.length,
          diasMorosidade,
          year: new Date().getFullYear()
        }, setting.templateDailyReport || setting.TEMPLATE_DAILY_REPORT);

        if (body) await sendHelper('daily', emailTo, subject, body);
      }

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

        if (body) await sendHelper('notifications', emailTo, subject, body);
      }
    }

    details.push({
      officeId,
      officeName: office.Escritorio_nome || officeId,
      emailTo,
      sent: sentForOffice,
      ...(officeError ? { error: officeError } : {})
    });
  }

  return {
    success: errors === 0,
    source: 'sheets',
    type,
    checkedOffices: officesData.length,
    matchedOffices: officesToNotify.length,
    sentCount,
    errors,
    details
  };
}

async function startServer() {
  const app = express();
  const PORT = resolveServerPort();

  app.use(express.json());

  // Cron Job: Run every 30 minutes to check for office-specific dispatch times
  cron.schedule('0,30 * * * *', () => {
    runAutomatedEmails('weekly');
    runAutomatedEmails('daily');
  }, { timezone: "America/Sao_Paulo" });

  console.log("[Automation] Cron jobs scheduled.");

  // Trigger manual/externo da automação de e-mails (protegido por CRON_SECRET ou sessão Admin do Supabase)
  app.post("/api/cron/trigger", async (req, res) => {
    const { type = 'daily', secret, force = false, officeId } = req.body || {};
    const headerSecret = String(req.headers['x-cron-secret'] || '').trim();
    const providedSecret = String(secret || headerSecret || '').trim();
    const configuredSecret = String(process.env.CRON_SECRET || '').trim();

    const hasValidCronSecret = !!(configuredSecret && providedSecret && providedSecret === configuredSecret);
    const caller = !hasValidCronSecret ? await verifySupabaseCaller(req) : null;

    if (!hasValidCronSecret && (!caller || !caller.isAdmin)) {
      return res.status(401).json({ error: "Não autorizado. Informe um CRON_SECRET válido ou autentique-se como Administrador." });
    }

    const normalizedType = String(type || 'daily').toLowerCase();
    if (normalizedType === 'both') {
      const [dailyRes, weeklyRes] = await Promise.all([
        runAutomatedEmails('daily', { force: !!force, officeId }),
        runAutomatedEmails('weekly', { force: !!force, officeId })
      ]);
      return res.json({
        status: "triggered",
        source: dailyRes.source,
        checkedOffices: dailyRes.checkedOffices,
        matchedOffices: dailyRes.matchedOffices + weeklyRes.matchedOffices,
        sentCount: dailyRes.sentCount + weeklyRes.sentCount,
        errors: dailyRes.errors + weeklyRes.errors,
        details: [...dailyRes.details, ...weeklyRes.details]
      });
    }

    if (normalizedType !== 'weekly' && normalizedType !== 'daily') {
      return res.status(400).json({ error: "Tipo inválido. Use 'daily', 'weekly' ou 'both'." });
    }

    const result = await runAutomatedEmails(normalizedType, { force: !!force, officeId });
    return res.json({ status: "triggered", ...result });
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

  // Helper interno para resolver SMTP a partir dos parâmetros ou das tabelas do Supabase (somente para chamador autenticado)
  const resolveEmailTransportConfig = async (
    req: express.Request,
    rawBody: { host?: string; port?: any; secure?: any; user?: string; pass?: string; officeId?: string }
  ): Promise<{ smtp: ResolvedSmtpConfig | null; error?: string; statusCode?: number }> => {
    const explicit = resolveSmtpFromSource({
      smtpHost: rawBody.host,
      smtpPort: rawBody.port,
      smtpSecure: rawBody.secure,
      emailUser: rawBody.user,
      emailPass: rawBody.pass,
    }, 'explicit');

    if (explicit) {
      return { smtp: explicit };
    }

    // Sem credenciais completas explícitas -> só usa credenciais armazenadas no servidor/Supabase para usuário autenticado
    const caller = await verifySupabaseCaller(req);
    if (!caller) {
      return {
        smtp: null,
        statusCode: 400,
        error: "Configurações de SMTP incompletas. Informe servidor SMTP, usuário e senha (ou autentique-se para usar o SMTP do escritório/sistema)."
      };
    }

    const { supabaseUrl, supabaseKey } = getServerSupabaseConfig();
    const requestedOfficeUpper = String(rawBody.officeId || '').trim().toUpperCase();

    if (requestedOfficeUpper && !caller.isAdmin && !caller.escritoriosIds.includes(requestedOfficeUpper)) {
      return {
        smtp: null,
        statusCode: 403,
        error: "Sem permissão para utilizar o SMTP deste escritório."
      };
    }

    if (supabaseUrl && supabaseKey) {
      const [escritoriosRows, settingsRows] = await Promise.all([
        requestedOfficeUpper ? fetchSupabaseTablePaged(supabaseUrl, supabaseKey, 'escritorios') : Promise.resolve([]),
        fetchSupabaseTablePaged(supabaseUrl, supabaseKey, 'app_settings'),
      ]);

      if (requestedOfficeUpper) {
        const office = escritoriosRows.find((e: any) => String(e?.id || '').trim().toUpperCase() === requestedOfficeUpper);
        const officeSetting = settingsRows.find((s: any) =>
          String(s?.id_escritorio || '').trim().toUpperCase() === requestedOfficeUpper ||
          String(s?.id || '').trim().toUpperCase() === requestedOfficeUpper
        );
        const officeSmtp = resolveSmtpFromSource({
          smtpHost: rawBody.host || office?.smtp_host || officeSetting?.smtp_host,
          smtpPort: rawBody.port || office?.smtp_port || officeSetting?.smtp_port,
          smtpSecure: rawBody.secure ?? office?.smtp_secure ?? officeSetting?.smtp_secure,
          emailUser: rawBody.user || office?.email_user || officeSetting?.email_user,
          emailPass: rawBody.pass || office?.email_pass || officeSetting?.email_pass,
        }, 'office');
        if (officeSmtp) return { smtp: officeSmtp };
      }

      const globalSetting =
        settingsRows.find((s: any) => String(s?.id || '').trim().toLowerCase() === 'global') ||
        settingsRows.find((s: any) => String(s?.id_escritorio || '').trim().toUpperCase() === 'GLOBAL') ||
        settingsRows[0];
      if (globalSetting) {
        const globalSmtp = resolveSmtpFromSource({
          smtpHost: globalSetting.smtp_host,
          smtpPort: globalSetting.smtp_port,
          smtpSecure: globalSetting.smtp_secure,
          emailUser: globalSetting.email_user,
          emailPass: globalSetting.email_pass,
        }, 'global_db');
        if (globalSmtp) return { smtp: globalSmtp };
      }
    }

    const envSmtp = getEnvSmtpFallback();
    if (envSmtp) return { smtp: envSmtp };

    return {
      smtp: null,
      statusCode: 400,
      error: "Configurações de SMTP não encontradas no escritório, nas Configurações Globais ou no servidor (.env)."
    };
  };

  // API to test SMTP configuration (com suporte a Gmail automático e fallback Supabase)
  app.post("/api/email/test", async (req, res) => {
    const { host, port, secure, user, pass, to, subject, body, html, officeId } = req.body || {};

    console.log(`[SMTP Test] Request for: ${to || user || officeId || 'server-fallback'}. Subject: ${subject || 'Default'}.`);

    const resolved = await resolveEmailTransportConfig(req, { host, port, secure, user, pass, officeId });
    if (!resolved.smtp) {
      return res.status(resolved.statusCode || 400).json({ success: false, error: resolved.error || "Configurações de SMTP incompletas." });
    }

    const smtp = resolved.smtp;
    const recipient = String(to || smtp.user || '').trim();
    if (!recipient) {
      return res.status(400).json({ success: false, error: "Destinatário do e-mail de teste é obrigatório." });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });

      await transporter.verify();

      const finalHtml = html || body || `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5;">SMTP Configurado: Teste Bem-sucedido!</h2>
            <p>Este é um e-mail de teste enviado pelo servidor Node.js integrado ao Supabase.</p>
            <p>As configurações de SMTP estão válidas e operando corretamente.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #64748b;">
              Servidor: ${smtp.host}:${smtp.port} (${smtp.secure ? 'SSL/TLS' : 'STARTTLS'})<br>
              Remetente: ${smtp.user}<br>
              Destinatário: ${recipient}
            </p>
          </div>
        `;

      await transporter.sendMail({
        from: `"Meu Escritório Jurídico" <${smtp.user}>`,
        to: recipient,
        subject: subject || "Teste de Configuração SMTP - Meu Escritório Jurídico",
        html: finalHtml,
      });

      res.json({ success: true, source: smtp.source });
    } catch (error: any) {
      console.error("[SMTP Test] Error:", error);
      res.status(500).json({ success: false, error: "Erro ao conectar ao SMTP: " + (error.message || String(error)) });
    }
  });

  // Rota autenticada para envio de e-mails operacionais via servidor + Supabase
  app.post("/api/email/send", async (req, res) => {
    const caller = await verifySupabaseCaller(req);
    if (!caller) {
      return res.status(401).json({ success: false, error: "Autenticação Supabase necessária para enviar e-mails." });
    }

    const { to, subject, html, text, officeId, fromName } = req.body || {};
    const recipient = String(to || '').trim();
    const cleanSubject = String(subject || '').trim();
    const cleanHtml = typeof html === 'string' ? html : '';
    const cleanText = typeof text === 'string' ? text : '';

    if (!recipient || !cleanSubject || (!cleanHtml && !cleanText)) {
      return res.status(400).json({ success: false, error: "Campos 'to', 'subject' e 'html' (ou 'text') são obrigatórios." });
    }

    const resolved = await resolveEmailTransportConfig(req, { officeId });
    if (!resolved.smtp) {
      return res.status(resolved.statusCode || 400).json({ success: false, error: resolved.error || "SMTP não configurado." });
    }

    const smtp = resolved.smtp;
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass }
      });

      await transporter.sendMail({
        from: `"${String(fromName || 'Meu Escritório Jurídico').replace(/"/g, '')}" <${smtp.user}>`,
        to: recipient,
        subject: cleanSubject,
        ...(cleanHtml ? { html: cleanHtml } : {}),
        ...(cleanText ? { text: cleanText } : {}),
      });

      const { supabaseUrl, supabaseKey } = getServerSupabaseConfig();
      if (supabaseUrl && supabaseKey) {
        await saveSupabaseEmailLog(supabaseUrl, supabaseKey, {
          usuario: caller.email,
          acao: 'EMAIL_ENVIADO',
          idEscritorio: officeId || undefined,
          detalhes: `E-mail enviado para ${recipient}: ${cleanSubject}`
        });
      }

      return res.json({ success: true, source: smtp.source });
    } catch (error: any) {
      console.error("[Email Send] Error:", error);
      return res.status(500).json({ success: false, error: "Erro ao enviar e-mail: " + (error?.message || String(error)) });
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

    const { supabaseUrl, supabaseKey } = getServerSupabaseConfig();
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ success: false, error: "Conexão Supabase não configurada no arquivo .env." });
    }

    try {
      const conflictHeader = conflictColumn ? `resolution=merge-duplicates,on_conflict=${conflictColumn}` : 'resolution=merge-duplicates';
      const sendUpsert = async (payloadRecord: any) => {
        return fetch(`${supabaseUrl}/rest/v1/${table}`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": conflictHeader
          },
          body: JSON.stringify(payloadRecord)
        });
      };

      let resp = await sendUpsert(record);

      // Tolerância para coluna environment_mode ausente em bancos app_settings antes da migração DDL
      if (!resp.ok && table === 'app_settings') {
        const errText = await resp.text();
        if (errText.includes('PGRST204') && errText.includes('environment_mode')) {
          const cleanRecord = Array.isArray(record)
            ? record.map(({ environment_mode, ...rest }: any) => rest)
            : (({ environment_mode, ...rest }: any) => rest)(record);
          resp = await sendUpsert(cleanRecord);
          if (resp.ok) {
            return res.json({ success: true, strippedMissingColumns: ['environment_mode'] });
          }
        }
        const finalErr = await resp.text().catch(() => errText);
        console.error(`[Server Supabase Upsert] Erro em ${table}:`, finalErr || errText);
        return res.status(resp.status).json({ success: false, error: finalErr || errText });
      }

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

    const { supabaseUrl, supabaseKey } = getServerSupabaseConfig();
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ success: false, error: "Conexão Supabase não configurada no arquivo .env." });
    }

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

  const normalizeEnvironmentMode = (val: any): 'homologacao' | 'producao' | null => {
    const clean = String(val || '').trim().toLowerCase();
    if (clean === 'producao' || clean === 'produção' || clean === 'production' || clean === 'prod') {
      return 'producao';
    }
    if (clean === 'homologacao' || clean === 'homologação' || clean === 'homolog' || clean === 'staging' || clean === 'dev') {
      return 'homologacao';
    }
    return null;
  };

  // API pública para carregar configurações essenciais (Google Client ID, Ambiente e Identidade) mesmo antes do login
  app.get("/api/public/settings", async (_req, res) => {
    try {
      let googleClientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
      const siteName = process.env.VITE_SITE_NAME || 'Meu Escritório Jurídico';
      const siteSubtitle = process.env.VITE_SITE_SUBTITLE || 'Sistema de Gestão Jurídica e Processual';

      const envMode = normalizeEnvironmentMode(process.env.APP_ENVIRONMENT || process.env.VITE_APP_ENVIRONMENT);
      let environmentMode: 'homologacao' | 'producao' = envMode || 'homologacao';
      let environmentSource: 'env' | 'supabase' | 'default' = envMode ? 'env' : 'default';

      // Fallback no Supabase app_settings para google_client_id e/ou environment_mode (usando select=* para evitar 400 se environment_mode não existir)
      const { supabaseUrl, supabaseKey } = getServerSupabaseConfig();
      if ((!googleClientId || !envMode) && supabaseUrl && supabaseKey) {
        try {
          const sbRes = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=*&limit=5`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });

          const rows = sbRes.ok ? await sbRes.json().catch(() => []) : [];
          if (Array.isArray(rows) && rows.length > 0) {
            if (!googleClientId) {
              const withGoogle = rows.find((r: any) => r?.google_client_id);
              if (withGoogle?.google_client_id) {
                googleClientId = withGoogle.google_client_id;
              }
            }
            if (!envMode) {
              const withEnv = rows.find((r: any) => normalizeEnvironmentMode(r?.environment_mode));
              const dbMode = normalizeEnvironmentMode(withEnv?.environment_mode);
              if (dbMode) {
                environmentMode = dbMode;
                environmentSource = 'supabase';
              }
            }
          }
        } catch (sbErr) {
          console.warn("[Public Settings] Erro ao consultar Supabase app_settings:", sbErr);
        }
      }

      const rawDataSource = String(process.env.DATA_SOURCE || process.env.VITE_DATA_SOURCE || 'supabase').trim().toLowerCase();
      const dataSource: 'supabase' | 'sheets' = rawDataSource === 'sheets' ? 'sheets' : 'supabase';

      res.json({
        success: true,
        googleClientId,
        siteName,
        siteSubtitle,
        environmentMode,
        environmentSource,
        dataSource,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  const writeEnvVarsSafely = (updates: Record<string, string | undefined>): { envFileSaved: boolean; envWriteError?: string } => {
    const cwdEnv = path.resolve(process.cwd(), ".env");
    const dirEnv = path.resolve(__dirname, ".env");
    const envPath = fs.existsSync(cwdEnv) ? cwdEnv : dirEnv;

    const cleanEntries: Array<[string, string]> = [];
    for (const [key, rawVal] of Object.entries(updates)) {
      if (typeof rawVal !== 'string') continue;
      const clean = rawVal.replace(/[\r\n]+/g, '').trim();
      if (!clean) continue;
      process.env[key] = clean;
      cleanEntries.push([key, clean]);
    }

    if (cleanEntries.length === 0) {
      return { envFileSaved: true };
    }

    try {
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      for (const [key, clean] of cleanEntries) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          // Usa callback no replace para evitar interpretação de '$' em senhas/chaves
          envContent = envContent.replace(regex, () => `${key}=${clean}`);
        } else {
          envContent += `${envContent.endsWith('\n') || !envContent ? '' : '\n'}${key}=${clean}\n`;
        }
      }
      fs.writeFileSync(envPath, envContent, "utf-8");
      return { envFileSaved: true };
    } catch (err: any) {
      const code = err?.code ? ` (${err.code})` : '';
      return { envFileSaved: false, envWriteError: `${err?.message || String(err)}${code}` };
    }
  };

  // API para o administrador salvar o Modo do Ambiente (homologacao | producao) no .env e sincronizar no Supabase
  app.post("/api/admin/save-environment-mode", async (req, res) => {
    try {
      const cleanMode = normalizeEnvironmentMode(req.body?.environmentMode);
      if (!cleanMode) {
        return res.status(400).json({ success: false, error: "Modo inválido. Utilize 'homologacao' ou 'producao'." });
      }

      // 1. Atualiza em memória e tenta gravar no arquivo .env do servidor atual
      const { envFileSaved, envWriteError } = writeEnvVarsSafely({
        APP_ENVIRONMENT: cleanMode,
        VITE_APP_ENVIRONMENT: cleanMode,
      });
      if (envFileSaved) {
        console.log(`[Configuração Global] APP_ENVIRONMENT=${cleanMode} gravado no .env com sucesso.`);
      } else {
        console.warn(`[Configuração Global] APP_ENVIRONMENT=${cleanMode} aplicado em memória; .env não gravado: ${envWriteError}`);
      }

      // 2. Sincroniza na tabela app_settings do Supabase somente se a coluna environment_mode existir no schema
      let supabaseSynced = false;
      const { supabaseUrl, supabaseKey } = getServerSupabaseConfig();
      if (supabaseUrl && supabaseKey) {
        try {
          const schemaProbe = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=*&limit=1`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          const sampleRows = schemaProbe.ok ? await schemaProbe.json().catch(() => []) : [];
          const hasEnvColumn = Array.isArray(sampleRows) && sampleRows.length > 0 && Object.prototype.hasOwnProperty.call(sampleRows[0], 'environment_mode');

          if (hasEnvColumn) {
            const sbResp = await fetch(`${supabaseUrl}/rest/v1/app_settings`, {
              method: "POST",
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
              },
              body: JSON.stringify({ id: "global", id_escritorio: "GLOBAL", environment_mode: cleanMode })
            });
            supabaseSynced = sbResp.ok;
            if (!sbResp.ok) {
              const errText = await sbResp.text().catch(() => '');
              console.warn("[Configuração Global] Aviso ao gravar environment_mode no Supabase:", errText);
            }
          }
        } catch (sbSyncErr) {
          console.warn("[Configuração Global] Aviso ao sincronizar environment_mode com Supabase:", sbSyncErr);
        }
      }

      res.json({
        success: true,
        environmentMode: cleanMode,
        environmentSource: envFileSaved ? 'env' : 'memory',
        envFileSaved,
        envWriteError,
        supabaseSynced
      });
    } catch (err: any) {
      console.error("[Configuração Global] Erro ao gravar APP_ENVIRONMENT no .env:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API para o administrador alternar a fonte de dados ativa ('supabase' | 'sheets') no .env
  app.post("/api/admin/save-data-source", (req, res) => {
    try {
      const raw = String(req.body?.dataSource || '').trim().toLowerCase();
      if (raw !== 'supabase' && raw !== 'sheets') {
        return res.status(400).json({ success: false, error: "Fonte de dados inválida. Utilize 'supabase' ou 'sheets'." });
      }
      const cleanSource: 'supabase' | 'sheets' = raw;

      const { envFileSaved, envWriteError } = writeEnvVarsSafely({
        DATA_SOURCE: cleanSource,
        VITE_DATA_SOURCE: cleanSource,
      });

      if (envFileSaved) {
        console.log(`[Configuração Global] DATA_SOURCE=${cleanSource} gravado no .env com sucesso.`);
      } else {
        console.warn(`[Configuração Global] DATA_SOURCE=${cleanSource} aplicado em memória; .env não gravado: ${envWriteError}`);
      }

      return res.json({
        success: true,
        dataSource: cleanSource,
        envFileSaved,
        envWriteError
      });
    } catch (err: any) {
      console.error("[Configuração Global] Erro ao gravar DATA_SOURCE no .env:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API para o administrador salvar o Google Client ID no .env e sincronizar no Supabase
  app.post("/api/admin/save-google-client-id", async (req, res) => {
    try {
      const { googleClientId } = req.body || {};
      const cleanId = typeof googleClientId === 'string' ? googleClientId.replace(/[\r\n]+/g, '').trim() : '';

      process.env.VITE_GOOGLE_CLIENT_ID = cleanId;
      let envFileSaved = true;
      let envWriteError: string | undefined;

      if (cleanId) {
        const result = writeEnvVarsSafely({ VITE_GOOGLE_CLIENT_ID: cleanId });
        envFileSaved = result.envFileSaved;
        envWriteError = result.envWriteError;
      } else {
        // Permite limpar explicitamente o Google Client ID se enviado vazio
        try {
          const cwdEnv = path.resolve(process.cwd(), ".env");
          const dirEnv = path.resolve(__dirname, ".env");
          const envPath = fs.existsSync(cwdEnv) ? cwdEnv : dirEnv;
          if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, "utf-8");
            if (/^VITE_GOOGLE_CLIENT_ID=.*$/m.test(envContent)) {
              envContent = envContent.replace(/^VITE_GOOGLE_CLIENT_ID=.*$/m, () => 'VITE_GOOGLE_CLIENT_ID=');
              fs.writeFileSync(envPath, envContent, "utf-8");
            }
          }
        } catch (wErr: any) {
          envFileSaved = false;
          envWriteError = wErr?.message || String(wErr);
        }
      }

      if (envFileSaved) {
        console.log(`[Configuração Global] VITE_GOOGLE_CLIENT_ID gravado no .env com sucesso.`);
      } else {
        console.warn(`[Configuração Global] VITE_GOOGLE_CLIENT_ID aplicado em memória; .env não gravado: ${envWriteError}`);
      }

      // 2. Sincroniza na tabela app_settings do Supabase (para persistência no banco)
      const { supabaseUrl, supabaseKey } = getServerSupabaseConfig();
      if (supabaseUrl && supabaseKey) {
        try {
          await fetch(`${supabaseUrl}/rest/v1/app_settings`, {
            method: "POST",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "resolution=merge-duplicates"
            },
            body: JSON.stringify({ id: "global", google_client_id: cleanId })
          }).catch(() => null);
        } catch (sbSyncErr) {
          console.warn("[Configuração Global] Aviso ao sincronizar com app_settings do Supabase:", sbSyncErr);
        }
      }

      res.json({ success: true, googleClientId: cleanId, envFileSaved, envWriteError });
    } catch (err: any) {
      console.error("[Configuração Global] Erro ao gravar .env:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API somente-leitura para diagnóstico de conexão (.env é a única fonte de configuração)
  app.get("/api/admin/supabase-config-status", (_req, res) => {
    const { supabaseUrl, publishableKey, secretKey } = getServerSupabaseConfig();
    res.json({
      success: true,
      configured: !!(supabaseUrl && (secretKey || publishableKey)),
      hasUrl: !!supabaseUrl,
      hasPublishableKey: !!publishableKey,
      hasSecretKey: !!secretKey,
      source: "env"
    });
  });

  // API de verificação ativa de chaves e conectividade com o Supabase (nunca retorna a chave secreta bruta)
  app.get("/api/admin/supabase-verify-keys", async (req, res) => {
    const { supabaseUrl, publishableKey, secretKey } = getServerSupabaseConfig();
    const clientUrlParam = String(req.query.clientUrl || '').trim().replace(/\/$/, '');

    const maskPublic = (k: string) => {
      if (!k) return '';
      if (k.length <= 20) return `${k.slice(0, 6)}...(${k.length} chars)`;
      return `${k.slice(0, 16)}...${k.slice(-4)} (${k.length} chars)`;
    };
    const maskSecret = (k: string) => {
      if (!k) return '';
      const prefix = k.startsWith('sb_secret_') ? 'sb_secret_' : k.startsWith('sb_publishable_') ? 'sb_publishable_' : k.startsWith('eyJ') ? 'eyJ...' : 'chave_';
      return `${prefix}*** (${k.length} caracteres)`;
    };

    const urlValidFormat = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(:\d+)?$/i.test(supabaseUrl);
    const hasWhitespaceInUrl = /\s/.test(supabaseUrl) || /["']/.test(supabaseUrl);

    const urlCheck: {
      ok: boolean;
      status: 'ok' | 'missing' | 'invalid_format' | 'connection_error';
      value: string;
      matchesClient: boolean | null;
      message: string;
    } = {
      ok: false,
      status: 'missing',
      value: supabaseUrl || '',
      matchesClient: clientUrlParam && supabaseUrl ? clientUrlParam.toLowerCase() === supabaseUrl.toLowerCase() : null,
      message: ''
    };

    if (!supabaseUrl) {
      urlCheck.status = 'missing';
      urlCheck.message = 'SUPABASE_URL / VITE_SUPABASE_URL não encontrada no .env.';
    } else if (!urlValidFormat || hasWhitespaceInUrl) {
      urlCheck.status = 'invalid_format';
      urlCheck.message = 'URL do Supabase com formato inválido (verifique https://, aspas ou espaços extras).';
    } else {
      urlCheck.ok = true;
      urlCheck.status = 'ok';
      urlCheck.message = 'Formato da URL válido.';
    }

    const pubCheck: {
      ok: boolean;
      status: 'ok' | 'missing' | 'invalid_format' | 'invalid_key' | 'connection_error';
      masked: string;
      message: string;
      googleProviderEnabled?: boolean;
    } = {
      ok: false,
      status: 'missing',
      masked: maskPublic(publishableKey),
      message: ''
    };

    if (!publishableKey) {
      pubCheck.status = 'missing';
      pubCheck.message = 'SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY não configurada no .env.';
    } else if (publishableKey.startsWith('sb_secret_')) {
      pubCheck.status = 'invalid_format';
      pubCheck.message = 'Uma chave secreta (sb_secret_) foi colocada no campo da chave pública!';
    } else if (/[\s"']/.test(publishableKey) || publishableKey.length < 20) {
      pubCheck.status = 'invalid_format';
      pubCheck.message = 'Chave pública contém espaços, aspas ou está incompleta.';
    } else if (urlCheck.ok) {
      try {
        const authResp = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: publishableKey },
          signal: AbortSignal.timeout(8000)
        });
        if (authResp.ok) {
          const authJson = await authResp.json().catch(() => null);
          pubCheck.ok = true;
          pubCheck.status = 'ok';
          pubCheck.googleProviderEnabled = Boolean(authJson?.external?.google);
          pubCheck.message = 'Chave pública aceita pelo Supabase Auth e conexão ativa.';
        } else if (authResp.status === 401 || authResp.status === 403) {
          pubCheck.status = 'invalid_key';
          pubCheck.message = `Chave pública rejeitada pelo Supabase (HTTP ${authResp.status}). Verifique se foi digitada corretamente.`;
        } else {
          pubCheck.status = 'connection_error';
          pubCheck.message = `Supabase retornou HTTP ${authResp.status} ao validar a chave pública.`;
        }
      } catch (err: any) {
        urlCheck.ok = false;
        urlCheck.status = 'connection_error';
        urlCheck.message = `Falha de rede ao conectar em ${supabaseUrl}: ${err?.cause?.code || err?.message || String(err)}`;
        pubCheck.status = 'connection_error';
        pubCheck.message = 'Não foi possível validar a chave pública devido a erro de conexão com a URL.';
      }
    } else {
      pubCheck.status = 'connection_error';
      pubCheck.message = 'Aguardando URL válida para testar a chave pública.';
    }

    const secCheck: {
      ok: boolean;
      status: 'ok' | 'missing' | 'invalid_format' | 'invalid_key' | 'connection_error';
      masked: string;
      message: string;
      tablesReachable?: boolean;
    } = {
      ok: false,
      status: 'missing',
      masked: maskSecret(secretKey),
      message: ''
    };

    if (!secretKey) {
      secCheck.status = 'missing';
      secCheck.message = 'SUPABASE_SECRET_KEY / SERVICE_ROLE_KEY não configurada no servidor (.env). Sem ela, o fallback /api/supabase/all-data e a geração de sessão JWT para login Google não funcionam.';
    } else if (secretKey.startsWith('sb_publishable_')) {
      secCheck.status = 'invalid_format';
      secCheck.message = 'Uma chave pública (sb_publishable_) foi colocada no lugar da SUPABASE_SECRET_KEY!';
    } else if (/[\s"']/.test(secretKey) || secretKey.length < 20) {
      secCheck.status = 'invalid_format';
      secCheck.message = 'Chave secreta contém espaços, aspas ou está incompleta.';
    } else if (urlCheck.ok) {
      try {
        const [adminResp, restResp] = await Promise.all([
          fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1`, {
            headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
            signal: AbortSignal.timeout(8000)
          }),
          fetch(`${supabaseUrl}/rest/v1/escritorios?select=id&limit=1`, {
            headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
            signal: AbortSignal.timeout(8000)
          })
        ]);

        if (adminResp.ok && restResp.ok) {
          secCheck.ok = true;
          secCheck.status = 'ok';
          secCheck.tablesReachable = true;
          secCheck.message = 'Chave secreta autenticada com sucesso (Auth Admin + REST/RLS OK).';
        } else if (adminResp.status === 401 || adminResp.status === 403 || restResp.status === 401 || restResp.status === 403) {
          secCheck.status = 'invalid_key';
          secCheck.message = `SUPABASE_SECRET_KEY rejeitada pelo Supabase (Auth HTTP ${adminResp.status} / REST HTTP ${restResp.status}). Verifique se a chave foi copiada corretamente.`;
        } else {
          secCheck.status = 'connection_error';
          secCheck.tablesReachable = restResp.ok;
          secCheck.message = `Resposta inesperada ao testar chave secreta (Auth HTTP ${adminResp.status}, REST HTTP ${restResp.status}).`;
        }
      } catch (err: any) {
        secCheck.status = 'connection_error';
        secCheck.message = `Erro de conexão ao testar chave secreta: ${err?.cause?.code || err?.message || String(err)}`;
      }
    } else {
      secCheck.status = 'connection_error';
      secCheck.message = 'Aguardando URL válida para testar a chave secreta.';
    }

    return res.json({
      success: urlCheck.ok && pubCheck.ok && secCheck.ok,
      checkedAt: new Date().toISOString(),
      url: urlCheck,
      publishableKey: pubCheck,
      secretKey: secCheck
    });
  });

  // API para listar escritórios com bypass de RLS via servidor
  app.get("/api/supabase/escritorios", async (_req, res) => {
    const { supabaseUrl, supabaseKey } = getServerSupabaseConfig();
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ success: false, error: "Conexão Supabase não configurada no arquivo .env." });
    }

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

  // API segura para carga completa paginada (fallback autenticado por e-mail quando sessão JWT do navegador estiver ausente)
  const handleSupabaseAllData = async (req: express.Request, res: express.Response) => {
    const rawEmail = String(req.body?.email || req.query?.email || "").trim().toLowerCase();
    if (!rawEmail) {
      return res.status(401).json({ success: false, error: "E-mail do usuário autenticado é obrigatório." });
    }

    const { supabaseUrl, supabaseKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ success: false, error: "Conexão Supabase não configurada no arquivo .env." });
    }
    if (!hasServiceRole) {
      return res.status(500).json({ success: false, error: "SUPABASE_SECRET_KEY não configurada no servidor." });
    }

    try {
      // 1. Verifica usuário ativo em auth.users e public.usuarios
      const [authResp, pubResp] = await Promise.all([
        fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }).then(r => r.json()).catch(() => ({ users: [] })),
        fetch(`${supabaseUrl}/rest/v1/usuarios?select=*`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }).then(r => r.json()).catch(() => [])
      ]);

      const authUsers = Array.isArray(authResp?.users) ? authResp.users : [];
      const pubUsers = Array.isArray(pubResp) ? pubResp : [];
      const au = authUsers.find((u: any) => String(u?.email || "").trim().toLowerCase() === rawEmail);
      const pu = pubUsers.find((u: any) => String(u?.email || "").trim().toLowerCase() === rawEmail);

      if (!au && !pu && rawEmail !== 'pratadeouro@gmail.com') {
        return res.status(403).json({ success: false, error: "Usuário não autorizado no Supabase." });
      }

      const meta = au?.user_metadata || {};
      const isBanned = !!(au?.banned_until && new Date(au.banned_until).getTime() > Date.now());
      const rawStatus = pu?.status || meta.status || (isBanned ? 'Inativo' : 'Ativo');
      const isInactive = rawEmail !== 'pratadeouro@gmail.com' &&
        (String(rawStatus).trim().toLowerCase() === 'inativo' || isBanned);
      if (isInactive) {
        return res.status(403).json({ success: false, error: "Usuário inativo." });
      }

      const permStr = String(pu?.permissao || meta.permissao || '').toLowerCase();
      const isAdminUser =
        rawEmail === 'pratadeouro@gmail.com' ||
        rawEmail.includes('walber') ||
        permStr.includes('admin') ||
        permStr.includes('gestor');

      let rawEsc = pu?.escritorios_ids ?? pu?.escritoriosIds ?? meta.escritorios_ids ?? meta.escritoriosIds ?? [];
      if (typeof rawEsc === 'string') {
        try { rawEsc = JSON.parse(rawEsc); } catch { rawEsc = rawEsc.split(',').map((s: string) => s.trim()).filter(Boolean); }
      }
      const userEscSet = new Set(
        (Array.isArray(rawEsc) ? rawEsc : []).map((id: any) => String(id || '').trim().toUpperCase()).filter(Boolean)
      );

      const fetchAllPaged = async (table: string, orderCol?: string, ascending = true, maxRows = 10000): Promise<any[]> => {
        const pageSize = 1000;
        const allRows: any[] = [];
        for (let from = 0; from < maxRows; from += pageSize) {
          const to = from + pageSize - 1;
          const orderParam = orderCol ? `&order=${encodeURIComponent(orderCol)}.${ascending ? 'asc' : 'desc'}` : '';
          const resp = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*${orderParam}`, {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Range-Unit": "items",
              "Range": `${from}-${to}`
            }
          });
          if (!resp.ok) break;
          const chunk = await resp.json().catch(() => []);
          if (!Array.isArray(chunk) || chunk.length === 0) break;
          allRows.push(...chunk);
          if (chunk.length < pageSize) break;
        }
        return allRows;
      };

      const [
        escritorios, processos, contatos, tarefas, eventos, movimentos, financeiro, documentos,
        varas, julgadores, servidores, recursos, upj, forums, tribunais, envolvidos,
        envolvidos_tipo, modelos, etiquetas, calendario, leads, leads_status, logs, app_settings
      ] = await Promise.all([
        fetchAllPaged('escritorios'),
        fetchAllPaged('processos', 'data_distribuicao', false),
        fetchAllPaged('contatos', 'nome', true),
        fetchAllPaged('tarefas', 'data_limite', true),
        fetchAllPaged('eventos', 'data', true),
        fetchAllPaged('movimentos', 'data', false),
        fetchAllPaged('financeiro', 'data', false),
        fetchAllPaged('documentos', 'data_criacao', false),
        fetchAllPaged('varas', 'nome', true),
        fetchAllPaged('julgadores', 'nome', true),
        fetchAllPaged('servidores', 'nome', true),
        fetchAllPaged('recursos'),
        fetchAllPaged('upj'),
        fetchAllPaged('forums'),
        fetchAllPaged('tribunais'),
        fetchAllPaged('envolvidos'),
        fetchAllPaged('envolvidos_tipo', 'nome', true),
        fetchAllPaged('modelos'),
        fetchAllPaged('etiquetas'),
        fetchAllPaged('calendario'),
        fetchAllPaged('leads', 'data_cadastro', false),
        fetchAllPaged('leads_status'),
        fetchAllPaged('logs', 'data', false, 200),
        fetchAllPaged('app_settings')
      ]);

      const filterByOffice = (rows: any[], allowNull: boolean, col = 'escritorio_id') => {
        if (isAdminUser) return rows;
        return rows.filter(r => {
          const val = String(r?.[col] || '').trim().toUpperCase();
          if (!val) return allowNull;
          if (val === 'X') return true;
          return userEscSet.has(val);
        });
      };

      return res.json({
        success: true,
        data: {
          escritorios: isAdminUser ? escritorios : escritorios.filter(e => userEscSet.has(String(e?.id || '').trim().toUpperCase())),
          usuarios: pubUsers,
          processos: filterByOffice(processos, false),
          contatos: filterByOffice(contatos, false),
          tarefas: filterByOffice(tarefas, false),
          eventos: filterByOffice(eventos, false),
          movimentos: filterByOffice(movimentos, false),
          financeiro: filterByOffice(financeiro, false),
          documentos: filterByOffice(documentos, false),
          varas: filterByOffice(varas, true),
          julgadores: filterByOffice(julgadores, true),
          servidores: filterByOffice(servidores, true),
          recursos,
          upj,
          forums,
          tribunais,
          envolvidos,
          envolvidos_tipo,
          modelos: filterByOffice(modelos, true),
          etiquetas: filterByOffice(etiquetas, true),
          calendario,
          leads: filterByOffice(leads, true),
          leads_status,
          logs: filterByOffice(logs, true, 'id_escritorio').slice(0, 200),
          app_settings
        }
      });
    } catch (err: any) {
      console.error("[Server Supabase All Data] Exceção:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  };
  app.get("/api/supabase/all-data", handleSupabaseAllData);
  app.post("/api/supabase/all-data", handleSupabaseAllData);

  // Endpoint leve para carregar logs recentes sem causar statement timeout de RLS no cliente
  app.get("/api/supabase/logs", async (req, res) => {
    const rawEmail = String(req.query?.email || "").trim().toLowerCase();
    if (!rawEmail) {
      return res.json({ success: true, logs: [] });
    }

    const { supabaseUrl, supabaseKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl || !supabaseKey || !hasServiceRole) {
      return res.json({ success: false, logs: [] });
    }

    try {
      const [pubResp, logsResp] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/usuarios?select=id,email,permissao,status,escritorios_ids&email=ilike.${encodeURIComponent(rawEmail)}&limit=5`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }).then(r => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${supabaseUrl}/rest/v1/logs?select=*&order=data.desc&limit=200`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }).then(r => (r.ok ? r.json() : [])).catch(() => [])
      ]);

      const pubUsers = Array.isArray(pubResp) ? pubResp : [];
      const pu = pubUsers[0];
      const permStr = String(pu?.permissao || '').toLowerCase();
      const isAdminUser =
        rawEmail === 'pratadeouro@gmail.com' ||
        rawEmail.includes('walber') ||
        permStr.includes('admin') ||
        permStr.includes('gestor');

      let rawEsc = pu?.escritorios_ids ?? [];
      if (typeof rawEsc === 'string') {
        try { rawEsc = JSON.parse(rawEsc); } catch { rawEsc = rawEsc.split(',').map((s: string) => s.trim()).filter(Boolean); }
      }
      const userEscSet = new Set(
        (Array.isArray(rawEsc) ? rawEsc : []).map((id: any) => String(id || '').trim().toUpperCase()).filter(Boolean)
      );

      const allLogs = Array.isArray(logsResp) ? logsResp : [];
      const filteredLogs = isAdminUser
        ? allLogs
        : allLogs.filter(r => {
            const val = String(r?.id_escritorio || '').trim().toUpperCase();
            return !val || val === 'X' || userEscSet.has(val);
          });

      return res.json({ success: true, logs: filteredLogs.slice(0, 200) });
    } catch (err: any) {
      console.warn("[Server Supabase Logs] Aviso:", err?.message || err);
      return res.json({ success: false, logs: [] });
    }
  });

  // Proxy seguro para ComunicaAPI / DJEN evitando bloqueio de CORS no navegador
  app.get("/api/djen/comunicacao", async (req, res) => {
    const silent = String(req.query?.silent || '') === 'true';
    const allowedParams = [
      'pagina',
      'itensPorPagina',
      'dataDisponibilizacaoInicio',
      'dataDisponibilizacaoFim',
      'nomeAdvogado',
      'numeroProcesso',
      'numeroOab',
      'ufOab',
      'texto',
      'siglaTribunal',
      'orgaoId',
      'nomeOrgao',
      'nomeParte',
    ];

    const params = new URLSearchParams();
    for (const key of allowedParams) {
      const val = req.query?.[key];
      if (typeof val === 'string' && val.trim() !== '') {
        params.set(key, val.trim());
      }
    }

    const upstreamUrl = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const upstreamResp = await fetch(upstreamUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timer);

      if (!upstreamResp.ok) {
        if (silent) {
          return res.json({ count: 0, items: [], unavailable: true, upstreamStatus: upstreamResp.status });
        }
        return res.status(upstreamResp.status === 403 ? 502 : upstreamResp.status).json({
          count: 0,
          items: [],
          unavailable: true,
          upstreamStatus: upstreamResp.status,
          error: upstreamResp.status === 403
            ? 'A API do DJEN (PJe) bloqueou temporariamente a consulta a partir do IP do servidor (HTTP 403).'
            : `Falha ao consultar API do DJEN (HTTP ${upstreamResp.status}).`
        });
      }

      const data = await upstreamResp.json().catch(() => ({ count: 0, items: [] }));
      return res.json(data);
    } catch (err: any) {
      clearTimeout(timer);
      if (silent) {
        return res.json({ count: 0, items: [], unavailable: true });
      }
      return res.status(502).json({
        count: 0,
        items: [],
        unavailable: true,
        error: err?.name === 'AbortError'
          ? 'Tempo limite excedido ao consultar a API do DJEN.'
          : 'Erro de conexão ao consultar a API do DJEN.'
      });
    }
  });

  // Endpoint leve para catálogos compartilhados/globais ('X'/'x'/NULL) quando políticas RLS antigas no Supabase bloqueiam linhas 'X'
  const handleSupabaseSharedCatalogs = async (req: express.Request, res: express.Response) => {
    const rawEmail = String(req.body?.email || req.query?.email || "").trim().toLowerCase();
    if (!rawEmail) {
      return res.status(401).json({ success: false, error: "E-mail do usuário autenticado é obrigatório." });
    }

    const { supabaseUrl, supabaseKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl || !supabaseKey || !hasServiceRole) {
      return res.status(500).json({ success: false, error: "Chaves de servidor do Supabase não configuradas." });
    }

    try {
      const pubResp = await fetch(
        `${supabaseUrl}/rest/v1/usuarios?select=id,email,permissao,status,escritorios_ids&limit=1000`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      ).then(r => (r.ok ? r.json() : [])).catch(() => []);

      const pubUsers = Array.isArray(pubResp) ? pubResp : [];
      let pu = pubUsers.find((u: any) => String(u?.email || "").trim().toLowerCase() === rawEmail);
      let meta: any = {};

      if (!pu && rawEmail !== 'pratadeouro@gmail.com') {
        const authResp = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }).then(r => (r.ok ? r.json() : { users: [] })).catch(() => ({ users: [] }));
        const authUsers = Array.isArray(authResp?.users) ? authResp.users : [];
        const au = authUsers.find((u: any) => String(u?.email || "").trim().toLowerCase() === rawEmail);
        if (!au) {
          return res.status(403).json({ success: false, error: "Usuário não autorizado." });
        }
        meta = au.user_metadata || {};
      }

      const rawStatus = pu?.status || meta.status || 'Ativo';
      if (rawEmail !== 'pratadeouro@gmail.com' && String(rawStatus).trim().toLowerCase() === 'inativo') {
        return res.status(403).json({ success: false, error: "Usuário inativo." });
      }

      const permStr = String(pu?.permissao || meta.permissao || '').toLowerCase();
      const isAdminUser =
        rawEmail === 'pratadeouro@gmail.com' ||
        rawEmail.includes('walber') ||
        permStr.includes('admin') ||
        permStr.includes('gestor');

      let rawEsc = pu?.escritorios_ids ?? meta.escritorios_ids ?? meta.escritoriosIds ?? [];
      if (typeof rawEsc === 'string') {
        try { rawEsc = JSON.parse(rawEsc); } catch { rawEsc = rawEsc.split(',').map((s: string) => s.trim()).filter(Boolean); }
      }
      const userEscSet = new Set(
        (Array.isArray(rawEsc) ? rawEsc : []).map((id: any) => String(id || '').trim().toUpperCase()).filter(Boolean)
      );

      const fetchTable = async (table: string): Promise<any[]> => {
        const resp = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (!resp.ok) return [];
        const rows = await resp.json().catch(() => []);
        return Array.isArray(rows) ? rows : [];
      };

      const filterShared = (rows: any[]) => {
        if (isAdminUser) return rows;
        return rows.filter(r => {
          const val = String(r?.escritorio_id || '').trim().toUpperCase();
          if (!val || val === 'X') return true;
          return userEscSet.has(val);
        });
      };

      const [etiquetas, modelos, julgadores, servidores] = await Promise.all([
        fetchTable('etiquetas'),
        fetchTable('modelos'),
        fetchTable('julgadores'),
        fetchTable('servidores'),
      ]);

      return res.json({
        success: true,
        data: {
          etiquetas: filterShared(etiquetas),
          modelos: filterShared(modelos),
          julgadores: filterShared(julgadores),
          servidores: filterShared(servidores),
        }
      });
    } catch (err: any) {
      console.error("[Server Supabase Shared Catalogs] Exceção:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  };
  app.get("/api/supabase/shared-catalogs", handleSupabaseSharedCatalogs);
  app.post("/api/supabase/shared-catalogs", handleSupabaseSharedCatalogs);

  // ============================================================================
  // GESTÃO COMPLETA DE USUÁRIOS BASEADA EM AUTH.USERS
  // ============================================================================

  const fetchAllEscritoriosIds = async (supabaseUrl: string, supabaseKey: string): Promise<string[]> => {
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/escritorios?select=id`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      if (!resp.ok) return [];
      const rows = await resp.json().catch(() => []);
      if (!Array.isArray(rows)) return [];
      return rows
        .map((r: any) => String(r?.id || '').trim().toUpperCase())
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  // 1.0 CONSULTAR USUÁRIO ESPECÍFICO POR E-MAIL DIRETAMENTE DO SUPABASE (Auth + public.usuarios)
  app.get("/api/supabase/user-by-email", async (req, res) => {
    const rawEmail = String(req.query.email || "").trim().toLowerCase();
    const withSession = req.query.withSession === 'true';
    if (!rawEmail) {
      return res.status(400).json({ success: false, error: "Parâmetro 'email' é obrigatório." });
    }

    const { supabaseUrl, supabaseKey, publishableKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl || (!supabaseKey && !publishableKey)) {
      return res.status(500).json({ success: false, error: "Conexão Supabase não configurada no arquivo .env." });
    }

    const fetchUserViaRpc = async (apiKeyToUse: string) => {
      try {
        const rpcResp = await fetch(`${supabaseUrl}/rest/v1/rpc/get_user_by_email_for_login`, {
          method: "POST",
          headers: {
            apikey: apiKeyToUse,
            Authorization: `Bearer ${apiKeyToUse}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ p_email: rawEmail })
        });
        if (!rpcResp.ok) return { ok: false, userRow: null };
        const rpcData = await rpcResp.json().catch(() => null);
        return { ok: true, userRow: rpcData || null };
      } catch {
        return { ok: false, userRow: null };
      }
    };

    try {
      if (!hasServiceRole) {
        const rpcKey = publishableKey || supabaseKey;
        const rpcResult = await fetchUserViaRpc(rpcKey);
        if (rpcResult.ok && rpcResult.userRow) {
          const r = rpcResult.userRow;
          let rawEsc = r.escritorios_ids ?? r.escritoriosIds ?? [];
          if (typeof rawEsc === 'string') {
            try { rawEsc = JSON.parse(rawEsc); } catch { rawEsc = rawEsc.split(',').map((s: string) => s.trim()).filter(Boolean); }
          }
          const safeEsc = Array.isArray(rawEsc)
            ? rawEsc.map((id: any) => String(id || '').trim().toUpperCase()).filter(Boolean)
            : [];
          const rawPerm = r.permissao || (rawEmail === 'pratadeouro@gmail.com' ? 'Admin' : 'user');
          const status = (rawEmail !== 'pratadeouro@gmail.com' && String(r.status || 'Ativo').trim().toLowerCase() === 'inativo')
            ? 'Inativo'
            : 'Ativo';
          return res.json({
            success: true,
            missingServiceRole: true,
            user: {
              id: r.id || `user-${Date.now()}`,
              nome: r.nome || rawEmail.split('@')[0],
              email: r.email || rawEmail,
              cargo: r.cargo || '',
              contato: r.contato || '',
              cpf: r.cpf || '',
              senha: '',
              oab: r.oab || '',
              permissao: rawEmail === 'pratadeouro@gmail.com' ? 'Admin' : rawPerm,
              escritoriosIds: safeEsc,
              status
            }
          });
        }
        return res.status(rpcResult.ok ? 404 : 503).json({
          success: false,
          missingServiceRole: true,
          error: rpcResult.ok
            ? "Usuário não encontrado no Supabase."
            : "Chave administrativa (SUPABASE_SECRET_KEY) não configurada no servidor."
        });
      }

      const [authResp, pubResp] = await Promise.all([
        fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }),
        fetch(`${supabaseUrl}/rest/v1/usuarios?email=ilike.${encodeURIComponent(rawEmail)}`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        })
      ]);

      const authRes = authResp.ok ? await authResp.json().catch(() => ({ users: [] })) : { users: [] };
      const pubRes = pubResp.ok ? await pubResp.json().catch(() => []) : [];

      if (!authResp.ok) {
        const authErrText = await authResp.text().catch(() => '');
        console.error("[Server Supabase User By Email] Erro ao consultar auth.users:", authResp.status, authErrText);
      }

      const authUsers = authRes?.users || [];
      const au = authUsers.find((u: any) => (u.email || "").trim().toLowerCase() === rawEmail);
      const pubUsers = Array.isArray(pubRes) ? pubRes : [];
      const pu = pubUsers.find((u: any) => (u.email || "").trim().toLowerCase() === rawEmail) || pubUsers[0] || {};

      if (!au && !pu.id && !pu.email) {
        const rpcFallback = await fetchUserViaRpc(publishableKey || supabaseKey);
        if (rpcFallback.ok && rpcFallback.userRow) {
          const r = rpcFallback.userRow;
          let rawEsc = r.escritorios_ids ?? r.escritoriosIds ?? [];
          if (typeof rawEsc === 'string') {
            try { rawEsc = JSON.parse(rawEsc); } catch { rawEsc = rawEsc.split(',').map((s: string) => s.trim()).filter(Boolean); }
          }
          return res.json({
            success: true,
            user: {
              id: r.id || `user-${Date.now()}`,
              nome: r.nome || rawEmail.split('@')[0],
              email: r.email || rawEmail,
              cargo: r.cargo || '',
              contato: r.contato || '',
              cpf: r.cpf || '',
              senha: '',
              oab: r.oab || '',
              permissao: rawEmail === 'pratadeouro@gmail.com' ? 'Admin' : (r.permissao || 'user'),
              escritoriosIds: Array.isArray(rawEsc) ? rawEsc.map((id: any) => String(id || '').trim().toUpperCase()).filter(Boolean) : [],
              status: (rawEmail !== 'pratadeouro@gmail.com' && String(r.status || 'Ativo').trim().toLowerCase() === 'inativo') ? 'Inativo' : 'Ativo'
            }
          });
        }
        return res.status(404).json({ success: false, error: "Usuário não encontrado no Supabase." });
      }

      const meta = au?.user_metadata || {};
      const nome = pu.nome || meta.display_name || meta.nome || meta.full_name || meta.name || rawEmail.split('@')[0];

      let rawEscritorios = (pu.escritorios_ids !== undefined && pu.escritorios_ids !== null)
        ? pu.escritorios_ids
        : (pu.escritoriosIds !== undefined && pu.escritoriosIds !== null)
          ? pu.escritoriosIds
          : (meta.escritorios_ids !== undefined && meta.escritorios_ids !== null)
            ? meta.escritorios_ids
            : (meta.escritoriosIds || []);
      if (typeof rawEscritorios === 'string') {
        try {
          rawEscritorios = JSON.parse(rawEscritorios);
        } catch {
          rawEscritorios = rawEscritorios.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      let safeEscritoriosIds = Array.isArray(rawEscritorios)
        ? rawEscritorios.map((id: any) => String(id || '').trim().toUpperCase()).filter(Boolean)
        : [];

      if (rawEmail === 'pratadeouro@gmail.com') {
        const allEscIds = await fetchAllEscritoriosIds(supabaseUrl, supabaseKey);
        safeEscritoriosIds = Array.from(new Set([...safeEscritoriosIds, ...allEscIds]));
      }

      const rawPerm = pu.permissao || meta.permissao || (rawEmail === 'pratadeouro@gmail.com' ? 'Admin' : 'user');
      const permissao = rawEmail === 'pratadeouro@gmail.com' ? 'Admin' : rawPerm;
      const isBanned = !!(au?.banned_until && new Date(au.banned_until).getTime() > Date.now());
      const rawStatus = pu.status || meta.status || (isBanned ? 'Inativo' : 'Ativo');
      const status = (rawEmail !== 'pratadeouro@gmail.com' && (String(rawStatus).trim().toLowerCase() === 'inativo' || isBanned))
        ? 'Inativo'
        : 'Ativo';

      const user = {
        id: pu.id || au?.id || `user-${Date.now()}`,
        authId: au?.id,
        nome,
        email: au?.email || pu.email || rawEmail,
        cargo: pu.cargo || meta.cargo || '',
        contato: pu.contato || meta.contato || '',
        cpf: pu.cpf || meta.cpf || '',
        senha: '',
        oab: pu.oab || meta.oab || '',
        permissao,
        escritoriosIds: safeEscritoriosIds,
        status,
        fotoUrl: meta.avatar_url || pu.foto_url,
        theme: pu.theme,
        itemsPerPage: pu.items_per_page,
        menuOrder: pu.menu_order,
        enableNotifications: pu.enable_notifications !== false,
        createdAt: au?.created_at,
        lastSignInAt: au?.last_sign_in_at
      };

      // Se solicitado, gera um token de sessão real no Supabase Auth (magiclink sem envio de e-mail)
      // apenas se o usuário NÃO estiver inativo
      let hashedToken: string | undefined;
      if (withSession && au?.email && status !== 'Inativo') {
        try {
          const linkResp = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
            method: "POST",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              type: "magiclink",
              email: au.email
            })
          });
          if (linkResp.ok) {
            const linkData = await linkResp.json().catch(() => null);
            hashedToken = linkData?.properties?.hashed_token || linkData?.hashed_token;
          }
        } catch (linkErr) {
          console.warn("[Server Supabase User By Email] Aviso ao gerar token de sessão:", linkErr);
        }
      }

      return res.json({ success: true, user, hashedToken });
    } catch (err: any) {
      console.error("[Server Supabase User By Email] Erro ao buscar usuário:", err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 1. CONSULTAR USUÁRIOS DIRETAMENTE DE AUTH.USERS (com dados mesclados de public.usuarios)
  app.get("/api/supabase/admin/users", async (req, res) => {
    const { supabaseUrl, supabaseKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl) {
      return res.status(500).json({ success: false, error: "SUPABASE_URL não configurada no arquivo .env." });
    }

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

      const allEscIdsForMaster = await fetchAllEscritoriosIds(supabaseUrl, supabaseKey);

      const authUsers = authRes.users || [];
      const mergedUsers = authUsers.map((au: any) => {
        const email = (au.email || "").trim().toLowerCase();
        const pu = pubByEmail.get(email) || {};
        const meta = au.user_metadata || {};
        const nome = pu.nome || meta.display_name || meta.nome || meta.full_name || meta.name || email;

        // Normalizar escritoriosIds para garantir que seja sempre array de strings (priorizando public.usuarios)
        let rawEscritorios = (pu.escritorios_ids !== undefined && pu.escritorios_ids !== null)
          ? pu.escritorios_ids
          : (pu.escritoriosIds !== undefined && pu.escritoriosIds !== null)
            ? pu.escritoriosIds
            : (meta.escritorios_ids !== undefined && meta.escritorios_ids !== null)
              ? meta.escritorios_ids
              : (meta.escritoriosIds || []);
        if (typeof rawEscritorios === 'string') {
          try {
            rawEscritorios = JSON.parse(rawEscritorios);
          } catch {
            rawEscritorios = rawEscritorios.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }
        let safeEscritoriosIds = Array.isArray(rawEscritorios)
          ? rawEscritorios.map((id: any) => String(id || '').trim().toUpperCase()).filter(Boolean)
          : [];

        // pratadeouro@gmail.com (admin mestre) sempre enxerga todos os escritórios cadastrados
        if (email === 'pratadeouro@gmail.com' && allEscIdsForMaster.length > 0) {
          safeEscritoriosIds = Array.from(new Set([...safeEscritoriosIds, ...allEscIdsForMaster]));
        }

        // pratadeouro@gmail.com é sempre Admin do sistema
        const rawPerm = pu.permissao || meta.permissao || (email === 'pratadeouro@gmail.com' ? 'Admin' : 'user');
        const permissao = email === 'pratadeouro@gmail.com' ? 'Admin' : rawPerm;
        const isBanned = !!(au.banned_until && new Date(au.banned_until).getTime() > Date.now());
        const rawStatus = pu.status || meta.status || (isBanned ? 'Inativo' : 'Ativo');
        const status = (email !== 'pratadeouro@gmail.com' && (String(rawStatus).trim().toLowerCase() === 'inativo' || isBanned))
          ? 'Inativo'
          : 'Ativo';

        return {
          id: pu.id || au.id,
          authId: au.id,
          nome,
          email: au.email,
          cargo: pu.cargo || meta.cargo || '',
          contato: pu.contato || meta.contato || '',
          cpf: pu.cpf || meta.cpf || '',
          senha: pu.senha || '',
          oab: pu.oab || meta.oab || '',
          permissao,
          escritoriosIds: safeEscritoriosIds,
          status,
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

    const { supabaseUrl, supabaseKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl) {
      return res.status(500).json({ success: false, error: "SUPABASE_URL não configurada no arquivo .env." });
    }

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
        const rawMsg = adminData.msg || adminData.message || JSON.stringify(adminData);
        let errorMsg = rawMsg;
        if (rawMsg.toLowerCase().includes('already been registered') || rawMsg.toLowerCase().includes('already registered')) {
          errorMsg = 'Já existe um usuário cadastrado com este e-mail no Supabase Auth.';
        }
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

    const { supabaseUrl, supabaseKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl) {
      return res.status(500).json({ success: false, error: "SUPABASE_URL não configurada no arquivo .env." });
    }

    if (!hasServiceRole) {
      return res.status(500).json({ success: false, error: "Chave administrativa não configurada para atualizar em auth.users." });
    }

    try {
      let targetAuthId = id;
      const normalizedEmail = email ? email.trim().toLowerCase() : undefined;
      const normalizedStatus = String(status || 'Ativo').trim().toLowerCase() === 'inativo' ? 'Inativo' : 'Ativo';

      if (normalizedEmail === 'pratadeouro@gmail.com' && normalizedStatus === 'Inativo') {
        return res.status(400).json({ success: false, error: "O administrador principal não pode ser inativado." });
      }

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
        ban_duration: normalizedStatus === 'Inativo' ? '876000h' : 'none',
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
          status: normalizedStatus
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

      // 2. Sincroniza em public.usuarios (atualiza registro existente por id ou e-mail antes de upsert)
      const pubPayload: any = {
        nome: nome?.trim(),
        cargo: cargo || '',
        contato: contato || '',
        oab: oab || null,
        cpf: cpf || '',
        permissao: permissao || 'user',
        escritorios_ids: escritoriosIds || [],
        status: normalizedStatus,
        updated_at: new Date().toISOString()
      };
      if (normalizedEmail) pubPayload.email = normalizedEmail;
      if (password && password.trim().length >= 6) pubPayload.senha = password.trim();

      let patched = false;
      const patchByIdResp = await fetch(`${supabaseUrl}/rest/v1/usuarios?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify(pubPayload)
      });
      if (patchByIdResp.ok) {
        const patchedRows = await patchByIdResp.json().catch(() => []);
        if (Array.isArray(patchedRows) && patchedRows.length > 0) patched = true;
      }

      if (!patched && normalizedEmail) {
        const patchByEmailResp = await fetch(`${supabaseUrl}/rest/v1/usuarios?email=ilike.${encodeURIComponent(normalizedEmail)}`, {
          method: "PATCH",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          },
          body: JSON.stringify(pubPayload)
        });
        if (patchByEmailResp.ok) {
          const patchedRows = await patchByEmailResp.json().catch(() => []);
          if (Array.isArray(patchedRows) && patchedRows.length > 0) patched = true;
        }
      }

      if (!patched) {
        await fetch(`${supabaseUrl}/rest/v1/usuarios?on_conflict=email`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
          },
          body: JSON.stringify({ id: targetAuthId, ...pubPayload })
        });
      }

      return res.json({ success: true, updated: true });
    } catch (err: any) {
      console.error("[Server Supabase Admin Update User] Exceção:", err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 3.1. ATIVAR / INATIVAR USUÁRIO DIRETAMENTE EM AUTH.USERS E PUBLIC.USUARIOS
  app.patch("/api/supabase/admin/users/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status, email } = req.body || {};

    const { supabaseUrl, supabaseKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl) {
      return res.status(500).json({ success: false, error: "SUPABASE_URL não configurada no arquivo .env." });
    }

    if (!hasServiceRole) {
      return res.status(500).json({ success: false, error: "Chave administrativa não configurada para alterar status em auth.users." });
    }

    const normalizedStatus = String(status || 'Ativo').trim().toLowerCase() === 'inativo' ? 'Inativo' : 'Ativo';
    let resolvedEmail = email ? String(email).trim().toLowerCase() : undefined;

    try {
      // Verifica se o chamador enviou JWT para impedir auto-inativação
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ') && normalizedStatus === 'Inativo') {
        const callerToken = authHeader.slice(7).trim();
        if (callerToken) {
          try {
            const callerResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${callerToken}` }
            });
            if (callerResp.ok) {
              const callerUser = await callerResp.json().catch(() => null);
              const callerEmail = callerUser?.email ? String(callerUser.email).trim().toLowerCase() : '';
              if (callerUser?.id === id || (callerEmail && resolvedEmail && callerEmail === resolvedEmail)) {
                return res.status(400).json({ success: false, error: "Você não pode inativar sua própria conta." });
              }
            }
          } catch {
            // prossegue se validação de token falhar por rede
          }
        }
      }

      // Resolve registro atual em public.usuarios caso email não tenha sido informado
      if (!resolvedEmail) {
        const pubLookup = await fetch(`${supabaseUrl}/rest/v1/usuarios?id=eq.${encodeURIComponent(id)}&select=id,email`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }).then(r => r.json()).catch(() => []);
        if (Array.isArray(pubLookup) && pubLookup[0]?.email) {
          resolvedEmail = String(pubLookup[0].email).trim().toLowerCase();
        }
      }

      if (resolvedEmail === 'pratadeouro@gmail.com' && normalizedStatus === 'Inativo') {
        return res.status(400).json({ success: false, error: "O administrador principal não pode ser inativado." });
      }

      // Localiza UUID em auth.users
      let targetAuthUser: any = null;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUUID) {
        const uResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (uResp.ok) {
          targetAuthUser = await uResp.json().catch(() => null);
        }
      }

      if (!targetAuthUser && resolvedEmail) {
        const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }).then(r => r.json()).catch(() => ({ users: [] }));
        targetAuthUser = (listRes.users || []).find((u: any) => (u.email || "").toLowerCase().trim() === resolvedEmail) || null;
      }

      const targetAuthId = targetAuthUser?.id || (isUUID ? id : undefined);
      if (!resolvedEmail && targetAuthUser?.email) {
        resolvedEmail = String(targetAuthUser.email).trim().toLowerCase();
      }

      // 1. Atualiza ban_duration e user_metadata em auth.users
      if (targetAuthId) {
        const existingMeta = targetAuthUser?.user_metadata || {};
        const authResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(targetAuthId)}`, {
          method: "PUT",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ban_duration: normalizedStatus === 'Inativo' ? '876000h' : 'none',
            user_metadata: {
              ...existingMeta,
              status: normalizedStatus
            }
          })
        });

        if (!authResp.ok) {
          const errJson = await authResp.json().catch(() => ({}));
          return res.status(authResp.status).json({
            success: false,
            error: errJson.msg || errJson.message || "Erro ao atualizar status no Supabase Auth."
          });
        }
      }

      // 2. Atualiza status em public.usuarios
      const patchBody = {
        status: normalizedStatus,
        updated_at: new Date().toISOString()
      };

      let updatedPub = false;
      const patchIdResp = await fetch(`${supabaseUrl}/rest/v1/usuarios?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify(patchBody)
      });
      if (patchIdResp.ok) {
        const rows = await patchIdResp.json().catch(() => []);
        if (Array.isArray(rows) && rows.length > 0) updatedPub = true;
      }

      if (resolvedEmail) {
        const patchEmailResp = await fetch(`${supabaseUrl}/rest/v1/usuarios?email=ilike.${encodeURIComponent(resolvedEmail)}`, {
          method: "PATCH",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          },
          body: JSON.stringify(patchBody)
        });
        if (patchEmailResp.ok) {
          const rows = await patchEmailResp.json().catch(() => []);
          if (Array.isArray(rows) && rows.length > 0) updatedPub = true;
        }
      }

      if (!updatedPub && resolvedEmail) {
        const meta = targetAuthUser?.user_metadata || {};
        await fetch(`${supabaseUrl}/rest/v1/usuarios?on_conflict=email`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
          },
          body: JSON.stringify({
            id: targetAuthId || id,
            email: resolvedEmail,
            nome: meta.nome || meta.full_name || meta.display_name || resolvedEmail,
            permissao: meta.permissao || 'user',
            escritorios_ids: meta.escritorios_ids || [],
            status: normalizedStatus,
            enable_notifications: true
          })
        });
      }

      return res.json({ success: true, status: normalizedStatus });
    } catch (err: any) {
      console.error("[Server Supabase Admin Status] Exceção:", err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // 4. EXCLUIR USUÁRIO DIRETAMENTE DE AUTH.USERS (e de public.usuarios)
  app.delete("/api/supabase/admin/users/:id", async (req, res) => {
    const { id } = req.params;
    const email = req.query.email as string | undefined;

    const { supabaseUrl, supabaseKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl) {
      return res.status(500).json({ success: false, error: "SUPABASE_URL não configurada no arquivo .env." });
    }

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

    const { supabaseUrl, supabaseKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ success: false, error: "Conexão Supabase não configurada no arquivo .env." });
    }

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

    const { supabaseUrl, supabaseKey, hasServiceRole } = getServerSupabaseConfig();
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ success: false, error: "Conexão Supabase não configurada no arquivo .env." });
    }

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
    const { createServer: createViteServer } = await import("vite");
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
