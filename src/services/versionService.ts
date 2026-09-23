/**
 * Serviço de Verificação de Versão e Atualização do Sistema
 * 
 * Compara a versão local em execução no navegador com a versão configurada
 * globalmente na planilha do Google Sheets (aba Configuracoes / Escritorios).
 */

// Versão atual do código do aplicativo (Build do Cliente)
export const CURRENT_APP_VERSION = '2.4.0';

export interface VersionCheckResult {
  isOutdated: boolean;
  isCritical: boolean;
  clientVersion: string;
  remoteVersion: string;
  difference: 'none' | 'patch' | 'minor' | 'major';
  message: string;
}

/**
 * Converte string de versão (ex: "v2.4.1", "2.5", "3.0.0-beta") em array numérico [major, minor, patch]
 */
export const parseVersion = (versionStr: string | null | undefined): [number, number, number] => {
  if (!versionStr || typeof versionStr !== 'string') {
    return [0, 0, 0];
  }

  // Remove caracteres não numéricos iniciais como 'v', 'V' ou espaços
  const cleaned = versionStr.trim().replace(/^[vV]/, '').split('-')[0];
  const parts = cleaned.split('.').map(p => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : num;
  });

  return [
    parts[0] || 0,
    parts[1] || 0,
    parts[2] || 0
  ];
};

/**
 * Compara duas versões semânticas (v1 vs v2)
 * Retorna:
 *  -1 se v1 < v2 (v1 é mais antiga que v2)
 *   0 se v1 === v2 (versões idênticas)
 *   1 se v1 > v2 (v1 é mais nova que v2)
 */
export const compareVersions = (v1: string, v2: string): number => {
  const [maj1, min1, pat1] = parseVersion(v1);
  const [maj2, min2, pat2] = parseVersion(v2);

  if (maj1 !== maj2) return maj1 < maj2 ? -1 : 1;
  if (min1 !== min2) return min1 < min2 ? -1 : 1;
  if (pat1 !== pat2) return pat1 < pat2 ? -1 : 1;

  return 0;
};

/**
 * Avalia se o cliente está rodando uma versão defasada em relação à planilha
 */
export const checkAppVersion = (
  remoteVersionStr?: string,
  clientVersionStr: string = CURRENT_APP_VERSION
): VersionCheckResult => {
  if (!remoteVersionStr || typeof remoteVersionStr !== 'string' || !remoteVersionStr.trim()) {
    return {
      isOutdated: false,
      isCritical: false,
      clientVersion: clientVersionStr,
      remoteVersion: clientVersionStr,
      difference: 'none',
      message: 'Sistema sincronizado na versão mais recente.'
    };
  }

  const comparison = compareVersions(clientVersionStr, remoteVersionStr);
  const [cMaj, cMin, cPat] = parseVersion(clientVersionStr);
  const [rMaj, rMin, rPat] = parseVersion(remoteVersionStr);

  const isOutdated = comparison < 0;

  let difference: 'none' | 'patch' | 'minor' | 'major' = 'none';
  if (isOutdated) {
    if (rMaj > cMaj) difference = 'major';
    else if (rMin > cMin) difference = 'minor';
    else if (rPat > cPat) difference = 'patch';
  }

  const isCritical = difference === 'major';

  let message = 'Sistema na versão mais recente.';
  if (isOutdated) {
    if (isCritical) {
      message = `Atualização obrigatória disponível: v${remoteVersionStr}. Recursos críticos foram atualizados.`;
    } else {
      message = `Uma nova versão do sistema está disponível: v${remoteVersionStr} (você está na v${clientVersionStr}).`;
    }
  }

  return {
    isOutdated,
    isCritical,
    clientVersion: clientVersionStr,
    remoteVersion: remoteVersionStr.trim(),
    difference,
    message
  };
};

const DISMISSED_SESSION_KEY = 'sys_version_notice_dismissed';

/**
 * Verifica se o aviso desta versão já foi dispensado na sessão atual do navegador
 */
export const isNoticeDismissedForSession = (targetVersion: string): boolean => {
  try {
    const dismissed = sessionStorage.getItem(DISMISSED_SESSION_KEY);
    return dismissed === targetVersion;
  } catch {
    return false;
  }
};

/**
 * Salva que o usuário dispensou o aviso nesta sessão para não incomodar enquanto trabalha
 */
export const dismissNoticeForSession = (targetVersion: string): void => {
  try {
    sessionStorage.setItem(DISMISSED_SESSION_KEY, targetVersion);
  } catch {}
};

/**
 * Limpa o status de dispensa da sessão
 */
export const resetNoticeDismissal = (): void => {
  try {
    sessionStorage.removeItem(DISMISSED_SESSION_KEY);
  } catch {}
};

/**
 * Força atualização limpa do aplicativo:
 * 1. Limpa Service Workers
 * 2. Esvazia Cache Storage
 * 3. Recarrega a página forçando bypass de cache
 */
export const reloadAppForUpdate = async (): Promise<void> => {
  try {
    // 1. Limpa caches de requisições / assets
    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map(key => window.caches.delete(key)));
    }

    // 2. Desregistra service workers se houver
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }

    // 3. Limpa marcação de dispensa de sessão
    resetNoticeDismissal();
  } catch (err) {
    console.warn('Aviso ao limpar caches de atualização:', err);
  } finally {
    // Força recarregamento limpo com timestamp para contornar qualquer cache proxy
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.set('_v_reload', Date.now().toString());
    window.location.replace(cleanUrl.toString());
  }
};
