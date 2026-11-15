import React, { useState, useEffect } from 'react';
import {
  Globe,
  Key,
  ShieldCheck,
  Lock,
  Database,
  Eye,
  EyeOff,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { OFFICIAL_SUPABASE_URL, OFFICIAL_SUPABASE_KEY } from '../services/supabaseService';
import { testSupabaseConnection } from '../services/supabaseMigration';

interface SupabaseConnectionFieldsProps {
  onCredentialsChange?: (creds: {
    supabaseUrl: string;
    publishableKey: string;
    secretKey: string;
    activeKey: string;
  }) => void;
  showHeader?: boolean;
}

export const SupabaseConnectionFields: React.FC<SupabaseConnectionFieldsProps> = ({
  onCredentialsChange,
  showHeader = false
}) => {
  const [supabaseUrl, setSupabaseUrl] = useState<string>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_migration_url') : '';
    if (saved && !saved.includes('walbermendonca') && !saved.includes('127.0.0.1')) return saved;
    return OFFICIAL_SUPABASE_URL;
  });

  const [publishableKey, setPublishableKey] = useState<string>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_migration_publishable_key') : '';
    if (saved && !saved.startsWith('eyJhbGciOi')) return saved;
    return OFFICIAL_SUPABASE_KEY;
  });

  const [secretKey, setSecretKey] = useState<string>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_migration_key') : '';
    if (saved && (saved.startsWith('sb_secret_') || saved.includes('service_role'))) return saved;
    return '';
  });

  const [jwtSecret, setJwtSecret] = useState<string>('');
  const [postgresPassword, setPostgresPassword] = useState<string>('');

  // Status de chaves já salvas no .env do servidor (sem expor segredos no GET)
  const [serverStatus, setServerStatus] = useState<{
    hasSecretKey: boolean;
    secretKeyMask: string;
    hasJwtSecret: boolean;
    jwtSecretMask: string;
    hasPostgresPassword: boolean;
    postgresPasswordMask: string;
  }>({
    hasSecretKey: false,
    secretKeyMask: '',
    hasJwtSecret: false,
    jwtSecretMask: '',
    hasPostgresPassword: false,
    postgresPasswordMask: ''
  });

  const [showKeys, setShowKeys] = useState({
    publishable: false,
    secret: false,
    jwt: false,
    postgres: false
  });

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchServerStatus = async () => {
      try {
        const resp = await fetch('/api/admin/supabase-config-status');
        if (!resp.ok) return;
        const data = await resp.json().catch(() => null);
        if (!mounted || !data?.success) return;

        if (data.supabaseUrl) setSupabaseUrl(data.supabaseUrl);
        if (data.publishableKey) setPublishableKey(data.publishableKey);

        setServerStatus({
          hasSecretKey: !!data.hasSecretKey,
          secretKeyMask: data.secretKeyMask || '',
          hasJwtSecret: !!data.hasJwtSecret,
          jwtSecretMask: data.jwtSecretMask || '',
          hasPostgresPassword: !!data.hasPostgresPassword,
          postgresPasswordMask: data.postgresPasswordMask || ''
        });
      } catch {
        // Fallback localStorage já carregado
      }
    };
    fetchServerStatus();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('supabase_migration_url', supabaseUrl);
      if (publishableKey) localStorage.setItem('supabase_migration_publishable_key', publishableKey);
      if (secretKey) {
        localStorage.setItem('supabase_migration_key', secretKey);
      } else if (publishableKey) {
        localStorage.setItem('supabase_migration_key', publishableKey);
      }
    } catch {}

    if (onCredentialsChange) {
      onCredentialsChange({
        supabaseUrl,
        publishableKey,
        secretKey,
        activeKey: secretKey.trim() || publishableKey.trim()
      });
    }
  }, [supabaseUrl, publishableKey, secretKey, onCredentialsChange]);

  const handleSaveToServer = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const resp = await fetch('/api/admin/save-supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUrl: supabaseUrl.trim(),
          publishableKey: publishableKey.trim(),
          secretKey: secretKey.trim(),
          jwtSecret: jwtSecret.trim(),
          postgresPassword: postgresPassword.trim()
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        setServerStatus({
          hasSecretKey: !!data.hasSecretKey,
          secretKeyMask: data.secretKeyMask || '',
          hasJwtSecret: !!data.hasJwtSecret,
          jwtSecretMask: data.jwtSecretMask || '',
          hasPostgresPassword: !!data.hasPostgresPassword,
          postgresPasswordMask: data.postgresPasswordMask || ''
        });
        setSaveMessage({
          success: true,
          message: 'Chaves salvas no .env do servidor e aplicadas em tempo real!'
        });
      } else {
        setSaveMessage({
          success: false,
          message: data.error || 'Erro ao gravar chaves no servidor.'
        });
      }
    } catch (err: any) {
      setSaveMessage({
        success: false,
        message: err?.message || 'Falha de comunicação ao salvar chaves no servidor.'
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // Testa via backend (permite testar inclusive a Secret Key já salva no .env)
      const resp = await fetch('/api/admin/test-supabase-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUrl: supabaseUrl.trim(),
          publishableKey: publishableKey.trim(),
          secretKey: secretKey.trim()
        })
      });

      if (resp.ok && (resp.headers.get('content-type') || '').includes('application/json')) {
        const data = await resp.json();
        setTestResult({ success: !!data.success, message: data.message || '' });
        return;
      }

      // Fallback cliente direto caso o backend não responda
      const res = await testSupabaseConnection(supabaseUrl, secretKey.trim() || publishableKey.trim());
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Falha ao testar conexão.' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {showHeader && (
        <div>
          <h4 className="text-sm font-bold text-app-text">Credenciais e Chaves de Integração Supabase</h4>
          <p className="text-xs text-app-text-muted mt-0.5">
            Configure as chaves de acesso público, importação administrativa e manipulação segura dos dados.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. URL do Projeto */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-bold text-app-text flex items-center gap-1.5 flex-wrap">
            <Globe size={14} className="text-primary shrink-0" />
            <span>URL do Projeto Supabase — SUPABASE_URL</span>
            <span className="font-normal text-app-text-muted">(endereço principal da API REST, banco de dados e autenticação do projeto)</span>
          </label>
          <input
            type="text"
            placeholder="https://xyzabcdefg.supabase.co"
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-xs font-mono text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <p className="text-[11px] text-app-text-muted">
            Onde encontrar: <b>Project Settings &rarr; Data API / API &rarr; Project URL</b>
          </p>
        </div>

        {/* 2. Chave Pública (Publishable / Anon Key) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-app-text flex items-center gap-1.5 flex-wrap">
            <Key size={14} className="text-blue-500 shrink-0" />
            <span>Publishable / Anon Key</span>
            <span className="font-normal text-app-text-muted">(leitura, login e manipulação pelo navegador respeitando as regras de RLS)</span>
          </label>
          <div className="relative">
            <input
              type={showKeys.publishable ? 'text' : 'password'}
              placeholder="sb_publishable_..."
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-app-border bg-app-bg text-xs font-mono text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowKeys(k => ({ ...k, publishable: !k.publishable }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text p-1"
              title={showKeys.publishable ? 'Ocultar' : 'Exibir'}
            >
              {showKeys.publishable ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-app-text-muted">
            Variável: <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> / <code className="font-mono">ANON_KEY</code>
          </p>
        </div>

        {/* 3. Chave Secreta (Secret / Service Role Key) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs font-bold text-app-text flex items-center gap-1.5 flex-wrap">
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
              <span>Secret / Service Role Key</span>
              <span className="font-normal text-app-text-muted">(importação em massa, migração, criação/status no Auth e manipulação administrativa com bypass de RLS)</span>
            </label>
          </div>
          <div className="relative">
            <input
              type={showKeys.secret ? 'text' : 'password'}
              placeholder={
                serverStatus.hasSecretKey
                  ? `Configurada no servidor (${serverStatus.secretKeyMask}) — digite apenas para substituir`
                  : 'sb_secret_... ou service_role'
              }
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-app-border bg-app-bg text-xs font-mono text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowKeys(k => ({ ...k, secret: !k.secret }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text p-1"
              title={showKeys.secret ? 'Ocultar' : 'Exibir'}
            >
              {showKeys.secret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-app-text-muted">
              Variável: <code className="font-mono">SUPABASE_SECRET_KEY</code> / <code className="font-mono">SERVICE_ROLE_KEY</code>
            </span>
            {serverStatus.hasSecretKey ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                <CheckCircle2 size={12} /> Ativa no servidor
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 shrink-0">
                <AlertCircle size={12} /> Pendente no .env
              </span>
            )}
          </div>
        </div>

        {/* 4. JWT Secret */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-app-text flex items-center gap-1.5 flex-wrap">
            <Lock size={14} className="text-amber-500 shrink-0" />
            <span>JWT Secret</span>
            <span className="font-normal text-app-text-muted">(validação e assinatura de tokens de sessão do Supabase Auth no servidor)</span>
          </label>
          <div className="relative">
            <input
              type={showKeys.jwt ? 'text' : 'password'}
              placeholder={
                serverStatus.hasJwtSecret
                  ? `Configurada no servidor (${serverStatus.jwtSecretMask}) — digite para substituir`
                  : 'Segredo JWT do projeto (opcional)'
              }
              value={jwtSecret}
              onChange={(e) => setJwtSecret(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-app-border bg-app-bg text-xs font-mono text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowKeys(k => ({ ...k, jwt: !k.jwt }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text p-1"
              title={showKeys.jwt ? 'Ocultar' : 'Exibir'}
            >
              {showKeys.jwt ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-app-text-muted">
              Variável: <code className="font-mono">JWT_SECRET</code>
            </span>
            {serverStatus.hasJwtSecret && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                <CheckCircle2 size={12} /> Ativa no servidor
              </span>
            )}
          </div>
        </div>

        {/* 5. Senha do Banco PostgreSQL */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-app-text flex items-center gap-1.5 flex-wrap">
            <Database size={14} className="text-purple-500 shrink-0" />
            <span>Senha do Banco PostgreSQL</span>
            <span className="font-normal text-app-text-muted">(acesso direto ao PostgreSQL para dumps SQL, psql ou manutenção avançada de schema)</span>
          </label>
          <div className="relative">
            <input
              type={showKeys.postgres ? 'text' : 'password'}
              placeholder={
                serverStatus.hasPostgresPassword
                  ? `Configurada no servidor (${serverStatus.postgresPasswordMask}) — digite para substituir`
                  : 'Senha do banco Postgres (opcional)'
              }
              value={postgresPassword}
              onChange={(e) => setPostgresPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-app-border bg-app-bg text-xs font-mono text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowKeys(k => ({ ...k, postgres: !k.postgres }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text p-1"
              title={showKeys.postgres ? 'Ocultar' : 'Exibir'}
            >
              {showKeys.postgres ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-app-text-muted">
              Variável: <code className="font-mono">POSTGRES_PASSWORD</code>
            </span>
            {serverStatus.hasPostgresPassword && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                <CheckCircle2 size={12} /> Ativa no servidor
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ações de Teste e Gravação no Servidor */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={isTesting || !supabaseUrl}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        >
          {isTesting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Testar Conexão com Supabase
        </button>

        <button
          type="button"
          onClick={handleSaveToServer}
          disabled={isSaving || !supabaseUrl}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isSaving ? 'Salvando no .env...' : 'Salvar Chaves no Servidor (.env)'}
        </button>

        {testResult && (
          <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg ${
            testResult.success
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-600 border border-red-500/20'
          }`}>
            {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {testResult.message}
          </div>
        )}

        {saveMessage && (
          <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg ${
            saveMessage.success
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-600 border border-red-500/20'
          }`}>
            {saveMessage.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {saveMessage.message}
          </div>
        )}
      </div>
    </div>
  );
};
