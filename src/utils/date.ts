/**
 * Formata uma data no formato YYYY-MM-DD para DD/MM/YYYY
 * sem sofrer desvios de fuso horário (UTC vs Local)
 */
export const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '-';
  
  // Se já estiver no formato brasileiro DD/MM/YYYY, retorna como está
  if (dateStr.includes('/') && dateStr.split('/').length === 3) {
    return dateStr;
  }

  // Tenta extrair partes de YYYY-MM-DD, lidando com ISO (T) ou espaços
  const parts = dateStr.split('T')[0].split(' ')[0].split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    // Verifica se o primeiro é o ano (4 dígitos)
    if (year.length === 4) {
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    // Se o último for o ano (4 dígitos), inverte (DD-MM-YYYY -> DD/MM/YYYY)
    if (day.length === 4) {
      return `${year.padStart(2, '0')}/${month.padStart(2, '0')}/${day}`;
    }
  }

  // Fallback seguro se não for o formato esperado, mas tentando evitar o bug do dia anterior
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      // Se a string contém apenas a data (sem T ou espaço), o JS trata como UTC se houver hífens
      // Adicionamos um horário ao meio dia para forçar a permanência no mesmo dia independente do fuso
      if (dateStr.length <= 10 && dateStr.includes('-')) {
        const localDate = new Date(dateStr + 'T12:00:00');
        return localDate.toLocaleDateString('pt-BR');
      }
      return d.toLocaleDateString('pt-BR');
    }
  } catch (e) {}

  return dateStr;
};

/**
 * Filtra e normaliza feriados do calendário para um tribunal específico
 */
export const getTribunalHolidays = (calendario: any[], tribunal: string): string[] => {
  return calendario
    .filter(c => c.tj && c.tj.toLowerCase().trim() === tribunal.toLowerCase().trim())
    .map(c => {
      if (!c.data) return '';
      if (c.data.includes('/')) {
        const parts = c.data.split('/');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return c.data.split('T')[0];
    })
    .filter(Boolean);
};

/**
 * Calcula a data final de um prazo (corridos ou úteis)
 */
export const calculateDeadline = (
  startDateStr: string,
  days: number,
  prazoTipo: string,
  holidays: string[]
): string => {
  if (!startDateStr) return '';

  const startDate = new Date(startDateStr + 'T12:00:00');
  let currentDay = new Date(startDate);
  let daysAdded = 0;
  let safety = 0;

  while (daysAdded < days && safety < 1000) {
    safety++;
    currentDay.setDate(currentDay.getDate() + 1);

    if (prazoTipo === 'Úteis') {
      const dayOfWeek = currentDay.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const formatted = currentDay.toISOString().split('T')[0];

      if (!isWeekend && !holidays.includes(formatted)) {
        daysAdded++;
      }
    } else {
      daysAdded++;
    }
  }

  return currentDay.toISOString().split('T')[0];
};

/**
 * Retorna a data de hoje formatada em YYYY-MM-DD ajustada pelo fuso horário especificado.
 */
export const getTodayInTimezone = (timezone?: string): string => {
  const tz = timezone || 'America/Sao_Paulo';
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } catch (error) {
    try {
      const formatter = new Intl.DateTimeFormat('fr-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const formatted = formatter.format(new Date());
      if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
        return formatted;
      }
    } catch (e) {}

    const local = new Date();
    const offset = local.getTimezoneOffset();
    const adjusted = new Date(local.getTime() - offset * 60 * 1000);
    return adjusted.toISOString().split('T')[0];
  }
};

/**
 * Formata uma data e hora no formato YYYY-MM-DDTHH:MM para DD/MM/YYYY às HH:MM
 */
export const formatDateTime = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '-';

  let hasTime = false;
  let timeStr = '';

  if (dateStr.includes('T')) {
    const parts = dateStr.split('T');
    if (parts[1] && parts[1].length >= 5) {
      hasTime = true;
      timeStr = parts[1].substring(0, 5); // HH:MM
    }
  } else if (dateStr.includes(' ')) {
    const parts = dateStr.split(' ');
    if (parts[1] && parts[1].includes(':')) {
      hasTime = true;
      timeStr = parts[1].substring(0, 5); // HH:MM
    }
  }

  const dateFormatted = formatDate(dateStr);
  
  if (hasTime && timeStr) {
    return `${dateFormatted} às ${timeStr}`;
  }

  return dateFormatted;
};


