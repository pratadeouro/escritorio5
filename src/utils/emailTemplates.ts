
/**
 * Email templates for the Legal Management System
 */

export const DEFAULT_WEEKLY_REPORT_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 16px; }
    .content { padding: 40px; }
    .greeting { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
    .intro { color: #64748b; margin-bottom: 32px; }
    .stats-grid { display: table; width: 100%; border-collapse: separate; border-spacing: 12px 12px; margin: 0 -12px 32px; }
    .stat-card { display: table-cell; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9; width: 33.33%; vertical-align: top; }
    .stat-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .stat-value { font-size: 24px; font-weight: 800; color: #1e293b; margin: 0; }
    .btn-container { text-align: center; margin-top: 40px; }
    .btn { background-color: #4f46e5; color: #ffffff !important; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 700; display: inline-block; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); }
    .footer { background: #f1f5f9; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; }
    .footer p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Resumo Semanal</h1>
      <p>{{officeName}}</p>
    </div>
    <div class="content">
      <p class="greeting">Olá,</p>
      <p class="intro">Aqui está o balanço consolidado das atividades do seu escritório na última semana.</p>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Processos Ativos</div>
          <div class="stat-value">{{activeProcesses}}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Novas Intimações</div>
          <div class="stat-value">{{publicationsToday}}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Clientes</div>
          <div class="stat-value">{{totalCustomers}}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Tarefas Pendentes</div>
          <div class="stat-value">{{pendingTasks}}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Eventos Pendentes</div>
          <div class="stat-value">{{pendingEvents}}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Processos Pendentes</div>
          <div class="stat-value">{{pendingProcesses}}</div>
        </div>
      </div>

      <div class="stats-grid" style="margin-bottom: 32px;">
        <div class="stat-card" style="width: 100%; display: block; border-left: 4px solid #ef4444;">
          <div class="stat-label">Alerta de Morosidade</div>
          <div class="stat-value" style="color: #ef4444;">{{lateProcesses}} processos parados</div>
        </div>
      </div>

      <div class="btn-container">
        <a href="https://lexgestao.app" class="btn">Acessar Painel</a>
      </div>
    </div>
    <div class="footer">
      <p><b>{{officeName}}</b></p>
      <p>© {{year}} - Automação Jurídica</p>
      <p style="margin-top: 12px; font-size: 10px; opacity: 0.7;">Você está recebendo este e-mail porque as notificações automáticas estão ativadas em suas configurações de sistema.</p>
    </div>
  </div>
</body>
</html>
`;

export const DEFAULT_NEW_NOTIFICATIONS_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: #1e293b; color: white; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
    .header p { margin: 4px 0 0; opacity: 0.7; font-size: 14px; font-weight: 500; }
    .content { padding: 32px 24px; background-color: #f8fafc; }
    .alert-banner { background: #4f46e5; color: white; padding: 16px; border-radius: 12px; margin-bottom: 24px; text-align: center; font-weight: 600; }
    .intro { font-size: 16px; color: #1e293b; margin-bottom: 24px; }
    .items-container { margin-bottom: 32px; }
    .more-items { text-align: center; color: #64748b; font-size: 13px; background: #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 32px; }
    .btn-container { text-align: center; padding: 32px 0; }
    .btn { background-color: #4f46e5; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block; }
    .footer { background: #ffffff; padding: 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Novas Intimações Pendentes</h1>
      <p>{{date}}</p>
    </div>
    <div class="content">
      <div class="alert-banner">
        🚀 Foram identificadas {{count}} novas comunicações para você.
      </div>
      
      <p class="intro">Olá <b>{{responsible}}</b>, detectamos novas movimentações processuais que requerem sua atenção no Diário Eletrônico:</p>
      
      <div class="items-container">
        {{itemsHtml}}
      </div>

      {{moreItemsHtml}}

      <div class="btn-container">
        <a href="https://lexgestao.app" class="btn">Ver Todas no Painel</a>
      </div>
    </div>
    <div class="footer">
      <p><b>{{officeName}}</b></p>
      <p>© {{year}} - Automação Jurídica</p>
      <p style="margin-top: 10px;">Para parar de receber estes alertas, desative a opção "Novas Intimações" nas configurações.</p>
    </div>
  </div>
</body>
</html>
`;

export const DEFAULT_DAILY_REPORT_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: #1e293b; color: white; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
    .header p { margin: 4px 0 0; opacity: 0.7; font-size: 14px; font-weight: 500; }
    .content { padding: 32px 24px; }
    .greeting { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
    .intro { color: #64748b; margin-bottom: 32px; }
    .stats-grid { display: table; width: 100%; border-collapse: separate; border-spacing: 12px 12px; margin: 0 -12px 32px; }
    .stat-card { display: table-cell; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9; width: 50%; vertical-align: top; }
    .stat-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .stat-value { font-size: 24px; font-weight: 800; color: #1e293b; margin: 0; }
    .alert-section { background: #fef2f2; border-radius: 12px; padding: 20px; margin-bottom: 32px; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; }
    .alert-title { font-size: 14px; font-weight: 700; color: #991b1b; margin-bottom: 4px; }
    .alert-text { font-size: 20px; font-weight: 800; color: #ef4444; }
    .btn-container { text-align: center; margin-top: 32px; }
    .btn { background: #4f46e5; color: white !important; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2); }
    .footer { padding: 32px; text-align: center; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 11px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Relatório Diário</h1>
      <p>{{officeName}}</p>
    </div>
    <div class="content">
      <div class="greeting">Olá,</div>
      <p class="intro">Este é o resumo operacional do dia para seu escritório.</p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Novas Publicações</div>
          <div class="stat-value">{{publicationsToday}}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tarefas Pendentes</div>
          <div class="stat-value">{{pendingTasks}}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Processos Pendentes</div>
          <div class="stat-value">{{pendingProcesses}}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Eventos Hoje</div>
          <div class="stat-value">{{pendingEvents}}</div>
        </div>
      </div>

      <div class="alert-section">
        <div class="alert-title">Alerta de Morosidade</div>
        <div class="alert-text">{{lateProcesses}} processos parados</div>
        <p style="font-size: 12px; color: #b91c1c; margin-top: 8px;">Processos sem nova movimentação há mais de {{diasMorosidade}} dias.</p>
      </div>

      <div class="btn-container">
        <a href="https://lexgestao.app" class="btn">Acessar Painel</a>
      </div>
    </div>
    <div class="footer">
      <p><b>{{officeName}}</b></p>
      <p>© {{year}} - Todos os direitos reservados</p>
    </div>
  </div>
</body>
</html>
`;

export interface DailyReportData {
  officeName: string;
  publicationsToday: number;
  pendingTasks: number;
  pendingProcesses: number;
  pendingEvents: number;
  lateProcesses: number;
  diasMorosidade: number;
  year: number;
}

export const getDailyReportTemplate = (data: DailyReportData, customTemplate?: string) => {
  let template = customTemplate || DEFAULT_DAILY_REPORT_TEMPLATE;
  
  return template
    .replace(/{{officeName}}/g, data.officeName)
    .replace(/{{publicationsToday}}/g, String(data.publicationsToday))
    .replace(/{{pendingTasks}}/g, String(data.pendingTasks))
    .replace(/{{pendingProcesses}}/g, String(data.pendingProcesses))
    .replace(/{{pendingEvents}}/g, String(data.pendingEvents))
    .replace(/{{lateProcesses}}/g, String(data.lateProcesses))
    .replace(/{{diasMorosidade}}/g, String(data.diasMorosidade))
    .replace(/{{year}}/g, String(data.year));
};

export const getWeeklyReportTemplate = (data: {
  officeName: string;
  activeProcesses: number;
  pendingTasks: number;
  totalCustomers: number;
  pendingEvents: number;
  pendingProcesses: number;
  lateProcesses: number;
  publicationsToday: number;
  year: number;
}, customTemplate?: string) => {
  let template = customTemplate || DEFAULT_WEEKLY_REPORT_TEMPLATE;
  
  return template
    .replace(/{{officeName}}/g, data.officeName)
    .replace(/{{activeProcesses}}/g, String(data.activeProcesses))
    .replace(/{{pendingTasks}}/g, String(data.pendingTasks))
    .replace(/{{totalCustomers}}/g, String(data.totalCustomers))
    .replace(/{{pendingEvents}}/g, String(data.pendingEvents))
    .replace(/{{pendingProcesses}}/g, String(data.pendingProcesses))
    .replace(/{{lateProcesses}}/g, String(data.lateProcesses))
    .replace(/{{publicationsToday}}/g, String(data.publicationsToday))
    .replace(/{{year}}/g, String(data.year));
};

export const getNewNotificationsTemplate = (data: {
  officeName: string;
  date: string;
  count: number;
  responsible: string;
  items: Array<{ numeroProcesso: string; texto: string; orgao?: string }>;
  year: number;
}, customTemplate?: string) => {
  let itemsHtml = '';
  data.items.slice(0, 5).forEach(item => {
    itemsHtml += `
      <div style="margin-bottom: 20px; padding: 20px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; border-left: 4px solid #4f46e5;">
        <p style="margin: 0; font-weight: 800; color: #1e293b; font-size: 15px; letter-spacing: -0.01em;">${item.numeroProcesso}</p>
        <p style="margin: 12px 0; font-size: 13px; color: #475569; line-height: 1.6;">${item.texto?.substring(0, 250)}...</p>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.025em;">
          <span>📍 ${item.orgao || 'Tribunal / Órgão'}</span>
        </div>
      </div>
    `;
  });

  if (itemsHtml === '') {
    itemsHtml = '<div style="text-align: center; padding: 40px; color: #94a3b8;">Nenhuma intimação encontrada para hoje.</div>';
  }

  const moreItemsHtml = data.count > 5 
    ? `<div style="text-align: center; color: #64748b; font-size: 13px; background: #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 32px;">Ainda existem mais <b>${data.count - 5}</b> comunicações não listadas aqui.</div>`
    : '';

  let template = customTemplate || DEFAULT_NEW_NOTIFICATIONS_TEMPLATE;

  return template
    .replace(/{{officeName}}/g, data.officeName)
    .replace(/{{date}}/g, data.date)
    .replace(/{{count}}/g, String(data.count))
    .replace(/{{responsible}}/g, data.responsible)
    .replace(/{{itemsHtml}}/g, itemsHtml)
    .replace(/{{moreItemsHtml}}/g, moreItemsHtml)
    .replace(/{{year}}/g, String(data.year));
};
