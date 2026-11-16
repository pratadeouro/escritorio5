import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Download, 
  Play, 
  Loader2, 
  Terminal, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { useAppContext } from '../context';
import { 
  SUPABASE_SCHEMA_SQL, 
  SUPABASE_RLS_SQL,
  migrateAllDataToSupabase, 
  generateFullSQLDump,
  MigrationProgress 
} from '../services/supabaseMigration';
import { registerUserInSupabaseAuth } from '../services/supabaseAuth';
import { OFFICIAL_SUPABASE_URL, OFFICIAL_SUPABASE_KEY, isSupabaseConfigured } from '../services/supabaseService';

export const SupabaseMigrationTab: React.FC = () => {
  const { state, forceLoad } = useAppContext();

  const supabaseConfigured = isSupabaseConfigured();

  useEffect(() => {
    try {
      localStorage.removeItem('supabase_migration_url');
      localStorage.removeItem('supabase_migration_key');
      localStorage.removeItem('supabase_migration_publishable_key');
    } catch {}
  }, []);

  const [copiedSchema, setCopiedSchema] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; totalRecords: number; errors: string[] } | null>(null);
  const [confirmEmptyMigration, setConfirmEmptyMigration] = useState(false);

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2500);
  };

  const handleDownloadSchema = () => {
    const blob = new Blob([SUPABASE_SCHEMA_SQL], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supabase_schema.sql';
    link.click();
    URL.revokeObjectURL(url);
  };

  const [sqlViewTab, setSqlViewTab] = useState<'schema' | 'rls'>('schema');
  const [copiedRls, setCopiedRls] = useState(false);

  const handleCopyRls = () => {
    navigator.clipboard.writeText(SUPABASE_RLS_SQL);
    setCopiedRls(true);
    setTimeout(() => setCopiedRls(false), 2500);
  };

  const handleDownloadRls = () => {
    const blob = new Blob([SUPABASE_RLS_SQL], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supabase_rls_policies.sql';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDump = () => {
    const sqlDump = generateFullSQLDump(state);
    const blob = new Blob([sqlDump], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `escritorio_dados_supabase_${new Date().toISOString().slice(0, 10)}.sql`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Contagem de registros atuais em memória
  const tablesCount = [
    { name: 'Processos', count: state.processos?.length || 0 },
    { name: 'Contatos / Clientes', count: state.contatos?.length || 0 },
    { name: 'Tarefas', count: state.tarefas?.length || 0 },
    { name: 'Audiências e Prazos', count: state.eventos?.length || 0 },
    { name: 'Movimentações', count: state.movimentos?.length || 0 },
    { name: 'Financeiro', count: state.financeiro?.length || 0 },
    { name: 'Documentos', count: state.documentos?.length || 0 },
    { name: 'Usuários', count: state.usuarios?.length || 0 },
    { name: 'Escritórios', count: state.escritorios?.length || 0 },
    { name: 'Varas / Fóruns', count: (state.varas?.length || 0) + (state.forums?.length || 0) },
    { name: 'Leads Processuais', count: state.leads?.length || 0 },
  ];

  const totalSheetsRecords = tablesCount.reduce((acc, curr) => acc + curr.count, 0);

  const executeMigration = async () => {
    setConfirmEmptyMigration(false);
    if (!supabaseConfigured) {
      setMigrationResult({
        success: false,
        totalRecords: 0,
        errors: ['Credenciais do Supabase não configuradas no arquivo .env do servidor.']
      });
      return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const res = await migrateAllDataToSupabase(state, OFFICIAL_SUPABASE_URL, OFFICIAL_SUPABASE_KEY, (prog) => {
        setProgress(prog);
      });
      setMigrationResult(res);
    } catch (err: any) {
      setMigrationResult({
        success: false,
        totalRecords: progress?.migratedRecords || 0,
        errors: [err.message || String(err)]
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleStartMigration = async () => {
    if (!supabaseConfigured) {
      setMigrationResult({
        success: false,
        totalRecords: 0,
        errors: ['Credenciais do Supabase não configuradas no arquivo .env do servidor.']
      });
      return;
    }

    if (totalSheetsRecords === 0 && !confirmEmptyMigration) {
      setConfirmEmptyMigration(true);
      return;
    }

    await executeMigration();
  };

  const [isSyncingAuth, setIsSyncingAuth] = useState(false);
  const [authSyncStatus, setAuthSyncStatus] = useState<string | null>(null);

  const handleSyncAuthUsers = async () => {
    const usuarios = state.usuarios || [];
    if (usuarios.length === 0) {
      setAuthSyncStatus('Nenhum usuário encontrado na memória para sincronizar.');
      return;
    }

    setIsSyncingAuth(true);
    setAuthSyncStatus('Iniciando provisionamento de usuários no Supabase Auth...');
    let successCount = 0;

    for (let i = 0; i < usuarios.length; i++) {
      const u = usuarios[i];
      if (!u.email) continue;
      const senhaToUse = u.senha ? u.senha.toString() : '123456';
      setAuthSyncStatus(`Provisionando (${i + 1}/${usuarios.length}): ${u.email}...`);
      
      try {
        const res = await registerUserInSupabaseAuth(u.email, senhaToUse, {
          nome: u.nome,
          cargo: u.cargo,
          permissao: u.permissao
        });

        if (res.success) {
          successCount++;
        }
      } catch {
        // segue para o próximo usuário
      }
    }

    setIsSyncingAuth(false);
    setAuthSyncStatus(`Concluído! ${successCount} usuário(s) sincronizados no Supabase Auth.`);
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl">
      {/* Header do Módulo */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-primary/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Database size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-app-text flex items-center gap-2 flex-wrap">
                Módulo de Migração de Dados &rarr; Supabase
                <span className="text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Conexão via .env
                </span>
              </h2>
              <p className="text-sm text-app-text-muted mt-0.5">
                Utiliza exclusivamente as variáveis definidas no arquivo <code className="font-mono">.env</code> para enviar registros e exportar scripts SQL.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={forceLoad}
            className="flex items-center gap-2 px-4 py-2 bg-app-surface border border-app-border hover:bg-app-secondary rounded-xl text-xs font-semibold text-app-text transition-all shrink-0"
            title="Recarregar dados atuais a partir da conexão configurada no .env"
          >
            <RefreshCw size={14} className={state.syncStatus === 'loading' ? 'animate-spin' : ''} />
            Recarregar Dados
          </button>
        </div>
      </div>

      {!supabaseConfigured && (
        <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl text-xs text-red-600 dark:text-red-400 flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold mb-0.5">Conexão Supabase ausente no .env</strong>
            <span>Defina <code className="font-mono">VITE_SUPABASE_URL</code> e <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> no arquivo <code className="font-mono">.env</code> do servidor para habilitar a migração direta.</span>
          </div>
        </div>
      )}

      {/* Passo 1: Status dos Dados Atuais */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-app-border pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">1</span>
            <h3 className="font-bold text-app-text">Dados Carregados em Memória</h3>
          </div>
          <span className="text-xs font-bold text-app-text-muted">
            Total em Memória: <b className="text-primary">{totalSheetsRecords} registros</b>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tablesCount.map((t, idx) => (
            <div key={idx} className="bg-app-bg/50 border border-app-border/70 rounded-xl p-3 text-center">
              <span className="text-lg font-black text-app-text block">{t.count}</span>
              <span className="text-[11px] font-medium text-app-text-muted truncate block">{t.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Passo 2: Script DDL do Schema SQL & RLS */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-app-border pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <h3 className="font-bold text-app-text">Scripts SQL para o Supabase (Schema & RLS)</h3>
              <p className="text-xs text-app-text-muted">
                Execute os scripts no <b>SQL Editor</b> do Supabase para criar as tabelas e aplicar as regras de segurança.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sqlViewTab === 'schema' ? (
              <>
                <button
                  type="button"
                  onClick={handleCopySchema}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
                >
                  {copiedSchema ? <Check size={14} /> : <Copy size={14} />}
                  {copiedSchema ? 'Copiado!' : 'Copiar Schema SQL'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSchema}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-app-bg border border-app-border text-app-text rounded-lg text-xs font-semibold hover:bg-app-secondary transition-all"
                >
                  <Download size={14} />
                  Baixar Schema .sql
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCopyRls}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
                >
                  {copiedRls ? <Check size={14} /> : <ShieldCheck size={14} />}
                  {copiedRls ? 'Copiado!' : 'Copiar RLS SQL'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadRls}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-app-bg border border-app-border text-app-text rounded-lg text-xs font-semibold hover:bg-app-secondary transition-all"
                >
                  <Download size={14} />
                  Baixar RLS .sql
                </button>
              </>
            )}
          </div>
        </div>

        {/* Abas do Script: Schema vs RLS */}
        <div className="flex items-center gap-2 border-b border-app-border">
          <button
            type="button"
            onClick={() => setSqlViewTab('schema')}
            className={`px-3 py-2 text-xs font-bold transition-all relative ${
              sqlViewTab === 'schema' 
                ? 'text-primary' 
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            1. Tabelas (Schema DDL)
            {sqlViewTab === 'schema' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSqlViewTab('rls')}
            className={`px-3 py-2 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
              sqlViewTab === 'rls' 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            <ShieldCheck size={13} />
            2. Regras de Segurança (RLS Policies)
            {sqlViewTab === 'rls' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
            )}
          </button>
        </div>

        <div className="relative">
          <pre className="bg-app-bg border border-app-border rounded-xl p-4 text-[11px] font-mono text-app-text-muted max-h-56 overflow-y-auto scrollbar-thin">
            {sqlViewTab === 'schema' ? SUPABASE_SCHEMA_SQL : SUPABASE_RLS_SQL}
          </pre>
        </div>
      </div>

      {/* Passo 3: Execução da Migração */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-app-border pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <h3 className="font-bold text-app-text">Migração dos Dados</h3>
              <p className="text-xs text-app-text-muted">
                Envia todos os registros em lotes atômicos com chave primária e integridade relacional usando a conexão do <code className="font-mono">.env</code>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSyncAuthUsers}
              disabled={isSyncingAuth || !supabaseConfigured}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
              title="Pré-provisionar todos os usuários existentes diretamente no Supabase Auth"
            >
              {isSyncingAuth ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {isSyncingAuth ? 'Provisionando no Auth...' : 'Sincronizar Usuários no Supabase Auth'}
            </button>

            <button
              type="button"
              onClick={handleDownloadDump}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-app-bg border border-app-border hover:bg-app-secondary rounded-xl text-xs font-semibold text-app-text transition-all"
              title="Baixar dump de inserts em SQL para execução manual"
            >
              <Download size={14} />
              Exportar Dump SQL Completo
            </button>

            <button
              type="button"
              onClick={handleStartMigration}
              disabled={isMigrating || !supabaseConfigured}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-emerald-500/20 disabled:opacity-50"
            >
              {isMigrating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {isMigrating ? 'Migrando...' : 'Iniciar Migração para o Supabase'}
            </button>
          </div>
        </div>

        {confirmEmptyMigration && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>Nenhum registro carregado em memória no momento. Deseja prosseguir com a migração mesmo assim?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmEmptyMigration(false)}
                className="px-3 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-text font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeMigration}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Status da Sincronização de Usuários no Auth */}
        {authSyncStatus && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs font-medium text-primary flex items-center gap-2 animate-fadeIn">
            {isSyncingAuth ? <Loader2 size={14} className="animate-spin shrink-0" /> : <CheckCircle2 size={14} className="shrink-0" />}
            <span>{authSyncStatus}</span>
          </div>
        )}

        {/* Barra de Progresso */}
        {progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-app-text flex items-center gap-2">
                {isMigrating && <Loader2 size={12} className="animate-spin text-primary" />}
                Progresso: {progress.currentTable} ({progress.tableIndex}/{progress.totalTables})
              </span>
              <span className="font-bold text-primary">{progress.percentage}%</span>
            </div>

            <progress
              value={progress.percentage}
              max={100}
              className="w-full h-3 rounded-full overflow-hidden accent-emerald-600"
            />
          </div>
        )}

        {/* Resultado Final */}
        {migrationResult && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            migrationResult.success 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
          }`}>
            {migrationResult.success ? (
              <CheckCircle2 size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <p className="font-bold">
                {migrationResult.success 
                  ? `Migração concluída com êxito! ${migrationResult.totalRecords} registros foram migrados para o Supabase.`
                  : `Migração finalizada com ${migrationResult.errors.length} aviso(s).`}
              </p>
              {migrationResult.errors.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5 opacity-90">
                  {migrationResult.errors.slice(0, 5).map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                  {migrationResult.errors.length > 5 && (
                    <li>... e mais {migrationResult.errors.length - 5} detalhes no console.</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Console de Logs */}
        {progress && progress.logs && progress.logs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-app-text-muted">
              <Terminal size={14} />
              Registro de Execução em Tempo Real
            </div>
            <div className="bg-neutral-900 text-neutral-200 p-4 rounded-xl font-mono text-[11px] space-y-1 max-h-56 overflow-y-auto scrollbar-thin">
              {progress.logs.map((log, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-neutral-500 shrink-0">[{log.timestamp}]</span>
                  <span className={
                    log.type === 'error' ? 'text-red-400 font-semibold' :
                    log.type === 'success' ? 'text-emerald-400 font-semibold' :
                    log.type === 'warning' ? 'text-amber-400' : 'text-neutral-300'
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
