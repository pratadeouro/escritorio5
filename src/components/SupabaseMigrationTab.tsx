import React, { useState } from 'react';
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
  Key, 
  Globe, 
  TableProperties,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { useAppContext } from '../context';
import { isSupabaseConfigured } from '../services/supabaseService';
import { 
  SUPABASE_SCHEMA_SQL, 
  testSupabaseConnection, 
  migrateAllDataToSupabase, 
  generateFullSQLDump,
  MigrationProgress 
} from '../services/supabaseMigration';

export const SupabaseMigrationTab: React.FC = () => {
  const { state, forceLoad, dataSource, setDataSource } = useAppContext();

  const [supabaseUrl, setSupabaseUrl] = useState<string>(() => {
    return localStorage.getItem('supabase_migration_url') || (import.meta as any).env.VITE_SUPABASE_URL || 'https://qhxdujbsipgwthrgvncl.supabase.co';
  });
  const [supabaseKey, setSupabaseKey] = useState<string>(() => {
    return localStorage.getItem('supabase_migration_key') || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Iyu6_roB7iGGd8-1xxK7tA_G7y7E0bL';
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [copiedSchema, setCopiedSchema] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; totalRecords: number; errors: string[] } | null>(null);

  const handleSaveCredentials = (url: string, key: string) => {
    setSupabaseUrl(url);
    setSupabaseKey(key);
    localStorage.setItem('supabase_migration_url', url);
    localStorage.setItem('supabase_migration_key', key);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(supabaseUrl, supabaseKey);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Falha ao testar conexão.' });
    } finally {
      setIsTesting(false);
    }
  };

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

  const handleStartMigration = async () => {
    if (!supabaseUrl || !supabaseKey) {
      alert('Por favor, informe a URL e a Chave do Supabase antes de iniciar.');
      return;
    }

    if (totalSheetsRecords === 0) {
      const confirmEmpty = window.confirm(
        'Atenção: Os dados parecem não estar carregados da planilha no momento. Deseja continuar mesmo assim ou prefere clicar em "Recarregar Dados da Planilha" primeiro?'
      );
      if (!confirmEmpty) return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const res = await migrateAllDataToSupabase(state, supabaseUrl, supabaseKey, (prog) => {
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

  // Contagem de registros atuais carregados da planilha
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
              <h2 className="text-xl font-bold text-app-text flex items-center gap-2">
                Módulo de Migração Google Sheets &rarr; Supabase
                <span className="text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  PostgreSQL
                </span>
              </h2>
              <p className="text-sm text-app-text-muted mt-0.5">
                Migre com facilidade todos os registros da sua planilha para um banco de dados relacional de alta performance no Supabase.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={forceLoad}
            className="flex items-center gap-2 px-4 py-2 bg-app-surface border border-app-border hover:bg-app-secondary rounded-xl text-xs font-semibold text-app-text transition-all shrink-0"
            title="Sincronizar novamente com o Google Sheets antes da migração"
          >
            <RefreshCw size={14} className={state.syncStatus === 'loading' ? 'animate-spin' : ''} />
            Recarregar Dados da Planilha
          </button>
        </div>
      </div>

      {/* Switch de Ativação da Fonte de Dados */}
      <div className={`border-2 rounded-2xl p-6 transition-all ${
        dataSource === 'supabase'
          ? 'bg-emerald-500/5 border-emerald-500/30'
          : 'bg-app-surface border-app-border'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${dataSource === 'supabase' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <h3 className="font-bold text-app-text text-base">
                Fonte de Dados em Uso:{' '}
                <span className={dataSource === 'supabase' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-amber-600 font-extrabold'}>
                  {dataSource === 'supabase' ? 'Supabase (PostgreSQL)' : 'Google Sheets (Planilha)'}
                </span>
              </h3>
            </div>
            <p className="text-xs text-app-text-muted">
              {dataSource === 'supabase'
                ? 'O aplicativo está operando com altíssima performance conectado diretamente ao seu banco de dados Supabase.'
                : 'O aplicativo está operando conectado à planilha Google Sheets. Após migrar os dados, clique no botão ao lado para ativar o Supabase.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {dataSource === 'supabase' ? (
              <button
                type="button"
                onClick={() => {
                  setDataSource('sheets');
                  setTimeout(() => forceLoad(), 100);
                }}
                className="px-4 py-2 bg-app-bg border border-app-border hover:bg-app-secondary rounded-xl text-xs font-bold text-app-text transition-all"
              >
                Reverter para Google Sheets
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDataSource('supabase');
                  setTimeout(() => forceLoad(), 100);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-emerald-500/20 transition-all"
              >
                <CheckCircle2 size={16} />
                Ativar Supabase como Banco Principal
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Passo 1: Status dos Dados Atuais */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-app-border pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">1</span>
            <h3 className="font-bold text-app-text">Dados Carregados do Google Sheets</h3>
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

      {/* Passo 2: Credenciais do Supabase */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-app-border pb-3">
          <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">2</span>
          <h3 className="font-bold text-app-text">Conexão com o Supabase</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-app-text-muted flex items-center gap-1.5 uppercase">
              <Globe size={14} className="text-primary" />
              URL do Projeto Supabase
            </label>
            <input
              type="text"
              placeholder="https://xyzabcdefg.supabase.co"
              value={supabaseUrl}
              onChange={(e) => handleSaveCredentials(e.target.value, supabaseKey)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-xs"
            />
            <p className="text-[11px] text-app-text-muted">
              Encontrada em: <b>Project Settings &rarr; API &rarr; Project URL</b>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-app-text-muted flex items-center gap-1.5 uppercase">
              <Key size={14} className="text-primary" />
              Chave de API (Service Role ou Anon Key)
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => handleSaveCredentials(supabaseUrl, e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-xs"
            />
            <p className="text-[11px] text-app-text-muted">
              Dica: A chave <b>service_role</b> é recomendada para importar tudo diretamente sem restrições de RLS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !supabaseUrl || !supabaseKey}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {isTesting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Testar Conexão com Supabase
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
        </div>
      </div>

      {/* Passo 3: Script DDL do Schema SQL */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-app-border pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <h3 className="font-bold text-app-text">Criar Tabelas no Supabase (Schema SQL)</h3>
              <p className="text-xs text-app-text-muted">
                Execute este script no <b>SQL Editor</b> do Supabase para criar as 24 tabelas antes de enviar os dados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySchema}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
            >
              {copiedSchema ? <Check size={14} /> : <Copy size={14} />}
              {copiedSchema ? 'Copiado!' : 'Copiar Script SQL'}
            </button>
            <button
              type="button"
              onClick={handleDownloadSchema}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-app-bg border border-app-border text-app-text rounded-lg text-xs font-semibold hover:bg-app-secondary transition-all"
            >
              <Download size={14} />
              Baixar .sql
            </button>
          </div>
        </div>

        <div className="relative">
          <pre className="bg-app-bg border border-app-border rounded-xl p-4 text-[11px] font-mono text-app-text-muted max-h-48 overflow-y-auto scrollbar-thin">
            {SUPABASE_SCHEMA_SQL}
          </pre>
        </div>
      </div>

      {/* Passo 4: Execução da Migração */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-app-border pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">4</span>
            <div>
              <h3 className="font-bold text-app-text">Migração dos Dados</h3>
              <p className="text-xs text-app-text-muted">
                Envia todos os registros em lotes atômicos com chave primária e integridade relacional.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              disabled={isMigrating || !supabaseUrl || !supabaseKey}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-emerald-500/20 disabled:opacity-50"
            >
              {isMigrating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {isMigrating ? 'Migrando...' : 'Iniciar Migração para o Supabase'}
            </button>
          </div>
        </div>

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

            <div className="w-full bg-app-bg border border-app-border rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-primary to-emerald-500 h-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
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
                  : `Migração finalizada com ${migrationResult.errors.length} avisos.`}
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
