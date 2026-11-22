const memoryStorage = new Map<string, string>();

export const safeGetStorageItem = (key: string): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Fallback para memória em iframes com armazenamento bloqueado
  }
  return memoryStorage.has(key) ? memoryStorage.get(key)! : null;
};

export const safeSetStorageItem = (key: string, value: string): void => {
  memoryStorage.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignora SecurityError / QuotaExceededError em iframes restritos
  }
};

export const safeRemoveStorageItem = (key: string): void => {
  memoryStorage.delete(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignora SecurityError em iframes restritos
  }
};

export const safeJsonParseStorage = <T>(key: string, fallback: T): T => {
  try {
    const raw = safeGetStorageItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const supabaseSafeStorageAdapter = {
  getItem: (key: string): string | null => safeGetStorageItem(key),
  setItem: (key: string, value: string): void => safeSetStorageItem(key, value),
  removeItem: (key: string): void => safeRemoveStorageItem(key),
};
