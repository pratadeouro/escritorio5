import React, { useState } from 'react';
import { useAppContext } from '../context';
import { 
  ShieldCheck, 
  KeyRound, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Search, 
  RefreshCw, 
  ArrowRight, 
  Lock, 
  Mail, 
  Check, 
  HelpCircle,
  ExternalLink,
  Info
} from 'lucide-react';
import { registerUserInSupabaseAuth } from '../services/supabaseAuth';

interface UserImportStatus {
  status: 'idle' | 'loading' | 'success' | 'already_registered' | 'error';
  message?: string;
}

export const SupabaseAuthImportModule: React.FC = () => {
  const { state, updateUsuario } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, UserImportStatus>>({});
  const [defaultPassword, setDefaultPassword] = useState('Mudar123!');
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [batchSummary, setBatchSummary] = useState<{ created: number; already: number; failed: number } | null>(null);

  // Edição rápida de e-mail ou senha no formulário do módulo
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editSenha, setEditSenha] = useState('');

  const usuarios = state.usuarios || [];

  const filteredUsuarios = usuarios.filter(u => {
    const term = searchTerm.toLowerCase();
    return (u.nome || '').toLowerCase().includes(term) ||
           (u.email || '').toLowerCase().includes(term) ||
           (u.cargo || '').toLowerCase().includes(term);
  });

  const allSelected = filteredUsuarios.length > 0 && filteredUsuarios.every(u => selectedIds.includes(u.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsuarios.map(u => u.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Importar um único usuário
  const handleImportSingle = async (u: typeof usuarios[0]) => {
    const email = (u.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setStatuses(s => ({
        ...s,
        [u.id]: { status: 'error', message: 'E-mail inválido ou não informado.' }
      }));
      return;
    }

    setStatuses(s => ({ ...s, [u.id]: { status: 'loading' } }));

    const rawPassword = (u.senha || defaultPassword || 'Mudar123!').toString().trim();
    const safePassword = rawPassword.length >= 6 ? rawPassword : rawPassword.padEnd(6, '0');

    try {
      const res = await registerUserInSupabaseAuth(email, safePassword, {
        nome: u.nome,
        cargo: u.cargo,
        permissao: u.permissao
      });

      if (res.success) {
        if (res.error && res.error.includes('já')) {
          setStatuses(s => ({
            ...s,
            [u.id]: { status: 'already_registered', message: 'Já cadastrado no Supabase Auth' }
          }));
        } else {
          setStatuses(s => ({
            ...s,
            [u.id]: { status: 'success', message: 'Cadastrado no Auth com sucesso!' }
          }));
        }
      } else {
        setStatuses(s => ({
          ...s,
          [u.id]: { status: 'error', message: res.error || 'Erro ao registrar no Auth' }
        }));
      }
    } catch (err: any) {
      setStatuses(s => ({
        ...s,
        [u.id]: { status: 'error', message: err.message || 'Falha na requisição' }
      }));
    }
  };

  // Importar em lote os usuários selecionados
  const handleImportBatch = async () => {
    const toImport = usuarios.filter(u => selectedIds.includes(u.id));
    if (toImport.length === 0) {
      alert('Selecione ao menos um usuário para importar.');
      return;
    }

    setIsBatchRunning(true);
    setBatchSummary(null);
    setBatchProgress({ current: 0, total: toImport.length, percent: 0 });

    try {
      // Tenta via endpoint do servidor em lote
      const resp = await fetch('/api/supabase/import-users-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: toImport,
          defaultPassword: defaultPassword || 'Mudar123!'
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        
        // Atualiza status locais
        const newStatuses = { ...statuses };
        toImport.forEach(u => {
          const errItem = (data.errors || []).find((e: any) => e.email === (u.email || '').toLowerCase());
          if (errItem) {
            newStatuses[u.id] = { status: 'error', message: errItem.error };
          } else {
            newStatuses[u.id] = { status: 'success', message: 'Sincronizado no Supabase Auth' };
          }
        });

        setStatuses(newStatuses);
        setBatchSummary({
          created: data.created || 0,
          already: data.alreadyRegistered || 0,
          failed: data.errorsCount || 0
        });
      } else {
        // Fallback: processamento sequencial direto
        let created = 0;
        let already = 0;
        let failed = 0;

        for (let i = 0; i < toImport.length; i++) {
          const u = toImport[i];
          setBatchProgress({
            current: i + 1,
            total: toImport.length,
            percent: Math.round(((i + 1) / toImport.length) * 100)
          });
          await handleImportSingle(u);
          const st = statuses[u.id]?.status;
          if (st === 'success') created++;
          else if (st === 'already_registered') already++;
          else failed++;
        }

        setBatchSummary({ created, already, failed });
      }
    } catch (err: any) {
      console.error('Erro na importação em lote:', err);
      alert('Ocorreu um erro ao importar em lote. Detalhes: ' + err.message);
    } finally {
      setIsBatchRunning(false);
      setBatchProgress(null);
    }
  };

  // Salvar edição rápida de usuário
  const handleSaveQuickEdit = (u: typeof usuarios[0]) => {
    updateUsuario({
      ...u,
      email: editEmail.trim().toLowerCase(),
      senha: editSenha.trim() || u.senha
    });
    setEditingUserId(null);
  };

  const usersWithEmail = usuarios.filter(u => u.email && u.email.includes('@')).length;
  const usersWithoutEmail = usuarios.length - usersWithEmail;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header do Módulo */}
      <div className="bg-gradient-to-r from-primary/10 via-emerald-500/10 to-teal-500/10 border border-primary/20 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 text-primary rounded-xl">
              <KeyRound size={26} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-app-text flex items-center gap-2">
                Módulo de Importação para o Supabase Auth
                <span className="text-[11px] font-bold bg-primary/20 text-primary px-2.5 py-0.5 rounded-full border border-primary/30 uppercase tracking-wider">
                  auth.users
                </span>
              </h2>
              <p className="text-xs text-app-text-muted mt-0.5">
                Importe os usuários da base de dados local / planilha diretamente para o serviço de autenticação criptografada do Supabase.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-app-text-muted">
              Total no Sistema: <b className="text-app-text font-bold">{usuarios.length}</b>
            </span>
          </div>
        </div>
      </div>

      {/* Cards de Métricas e Configurações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Prontos */}
        <div className="bg-app-surface border border-app-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-xs font-semibold text-app-text-muted uppercase">E-mails Válidos</div>
            <div className="text-xl font-black text-app-text">{usersWithEmail} <span className="text-xs font-normal text-app-text-muted">/ {usuarios.length}</span></div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Prontos para provisionamento no Auth</p>
          </div>
        </div>

        {/* Card 2: Sem e-mail ou pendentes */}
        <div className="bg-app-surface border border-app-border rounded-xl p-4 flex items-center gap-3">
          <div className={`p-3 rounded-xl shrink-0 ${usersWithoutEmail > 0 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-primary/10 text-primary'}`}>
            <AlertCircle size={24} />
          </div>
          <div>
            <div className="text-xs font-semibold text-app-text-muted uppercase">Pendências de E-mail</div>
            <div className="text-xl font-black text-app-text">{usersWithoutEmail}</div>
            <p className="text-[11px] text-app-text-muted">
              {usersWithoutEmail > 0 ? 'Exigem preenchimento do e-mail' : 'Todos possuem e-mail válido'}
            </p>
          </div>
        </div>

        {/* Card 3: Configuração de Senha Padrão de Fallback */}
        <div className="bg-app-surface border border-app-border rounded-xl p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-app-text uppercase flex items-center gap-1.5">
              <Lock size={13} className="text-primary" />
              Senha Padrão (Fallback)
            </span>
            <span className="text-[10px] text-primary font-semibold">Mín. 6 dígitos</span>
          </div>
          <input
            type="text"
            value={defaultPassword}
            onChange={(e) => setDefaultPassword(e.target.value)}
            placeholder="Ex: Mudar123!"
            className="w-full px-3 py-1.5 rounded-lg border border-app-border bg-app-bg text-xs font-mono text-app-text focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-[10px] text-app-text-muted leading-tight">
            Usada se o usuário na tabela não possuir senha definida.
          </p>
        </div>
      </div>

      {/* Barra de Ações em Lote */}
      <div className="bg-app-surface border border-app-border rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, e-mail ou cargo..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-app-border bg-app-bg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="px-3 py-2 rounded-xl border border-app-border bg-app-bg hover:bg-app-secondary text-xs font-semibold text-app-text transition-all"
          >
            {allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
          </button>

          <button
            type="button"
            onClick={handleImportBatch}
            disabled={isBatchRunning || selectedIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-emerald-500/20 disabled:opacity-50"
          >
            {isBatchRunning ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {isBatchRunning ? 'Importando Lote...' : `Importar Selecionados (${selectedIds.length})`}
          </button>
        </div>
      </div>

      {/* Progresso de Lote */}
      {batchProgress && (
        <div className="bg-app-surface border border-app-border rounded-xl p-4 space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-app-text flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-primary" />
              Processando importação: {batchProgress.current} de {batchProgress.total} usuários
            </span>
            <span className="font-bold text-primary">{batchProgress.percent}%</span>
          </div>
          <div className="w-full bg-app-bg border border-app-border rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-primary to-emerald-500 h-full transition-all duration-300"
              style={{ width: `${batchProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Resumo da Importação */}
      {batchSummary && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>
              Importação finalizada! <b>{batchSummary.created}</b> novos usuários criados no Auth, <b>{batchSummary.already}</b> já existentes e <b>{batchSummary.failed}</b> com pendências.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setBatchSummary(null)}
            className="text-xs font-bold text-emerald-800 dark:text-emerald-200 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Tabela de Usuários */}
      <div className="bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-app-bg/70 border-b border-app-border text-app-text-muted uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-app-border text-primary focus:ring-primary cursor-pointer"
                  />
                </th>
                <th className="p-3">Usuário / Cargo</th>
                <th className="p-3">E-mail de Login</th>
                <th className="p-3">Senha</th>
                <th className="p-3">Status no Supabase Auth</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {filteredUsuarios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-app-text-muted">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsuarios.map((u) => {
                  const isSelected = selectedIds.includes(u.id);
                  const isEditing = editingUserId === u.id;
                  const currentStatus = statuses[u.id];
                  const hasValidEmail = u.email && u.email.includes('@');
                  const passwordLength = (u.senha || '').toString().trim().length;

                  return (
                    <tr key={u.id} className={`hover:bg-app-secondary/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(u.id)}
                          className="rounded border-app-border text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>

                      <td className="p-3 font-medium text-app-text">
                        <div className="font-bold">{u.nome || 'Sem Nome'}</div>
                        <div className="text-[11px] text-app-text-muted flex items-center gap-1.5">
                          <span>{u.cargo || 'Sem Cargo'}</span>
                          <span className="text-app-border">•</span>
                          <span className="font-mono text-[10px] bg-app-bg px-1.5 py-0.5 rounded border border-app-border">{u.permissao || 'user'}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="email@adv.com.br"
                            className="px-2.5 py-1 text-xs rounded border border-primary bg-app-bg text-app-text focus:outline-none w-full max-w-xs"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {hasValidEmail ? (
                              <span className="font-mono text-app-text">{u.email}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20">
                                <AlertCircle size={11} /> Sem E-mail
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editSenha}
                            onChange={(e) => setEditSenha(e.target.value)}
                            placeholder="Nova senha (mín 6)"
                            className="px-2.5 py-1 text-xs rounded border border-primary bg-app-bg text-app-text focus:outline-none w-32"
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            {passwordLength > 0 ? (
                              <span className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded ${
                                passwordLength >= 6 
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              }`}>
                                <Lock size={10} />
                                {passwordLength >= 6 ? `${passwordLength} dígitos` : `${passwordLength} dig (será ajustada)`}
                              </span>
                            ) : (
                              <span className="text-[11px] text-app-text-muted italic">
                                Usará padrão ({defaultPassword})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        {currentStatus?.status === 'loading' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            <Loader2 size={12} className="animate-spin" /> Provisionando...
                          </span>
                        )}
                        {currentStatus?.status === 'success' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={12} /> {currentStatus.message || 'Sincronizado'}
                          </span>
                        )}
                        {currentStatus?.status === 'already_registered' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <ShieldCheck size={12} /> Já Cadastrado no Auth
                          </span>
                        )}
                        {currentStatus?.status === 'error' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-600 border border-red-500/20" title={currentStatus.message}>
                            <AlertCircle size={12} /> {currentStatus.message || 'Falha'}
                          </span>
                        )}
                        {!currentStatus && (
                          <span className="text-app-text-muted text-[11px]">
                            {hasValidEmail ? 'Pronto para importar' : 'Aguardando e-mail'}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveQuickEdit(u)}
                              className="px-2.5 py-1 bg-primary text-white rounded text-xs font-bold hover:bg-primary/90"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="px-2 py-1 text-app-text-muted hover:text-app-text text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUserId(u.id);
                                setEditEmail(u.email || '');
                                setEditSenha(u.senha || '');
                              }}
                              className="px-2.5 py-1 rounded-lg border border-app-border text-[11px] font-medium text-app-text-muted hover:text-app-text hover:bg-app-secondary transition-all"
                              title="Ajustar e-mail ou senha deste usuário"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => handleImportSingle(u)}
                              disabled={currentStatus?.status === 'loading' || !hasValidEmail}
                              className="flex items-center gap-1 px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[11px] font-bold transition-all disabled:opacity-40"
                              title="Importar este usuário individualmente para o Supabase Auth"
                            >
                              {currentStatus?.status === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                              Importar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bloco de Instruções e Dúvidas */}
      <div className="bg-app-bg border border-app-border rounded-2xl p-5 text-xs text-app-text-muted space-y-2">
        <div className="flex items-center gap-2 font-bold text-app-text">
          <Info size={16} className="text-primary" />
          Como funciona a importação para o Supabase Auth:
        </div>
        <ul className="list-disc pl-5 space-y-1 leading-relaxed">
          <li><b>E-mail Obrigatório:</b> Cada conta no Supabase Auth requer um e-mail único e formatado. Caso algum usuário esteja sem e-mail, utilize o botão <b>Editar</b> na tabela acima para preencher.</li>
          <li><b>Regra de Senha (Mínimo 6 dígitos):</b> O Supabase exige ao menos 6 dígitos. Caso algum usuário possua senha menor (ex: <code>12345</code>), o módulo completa automaticamente com zeros à direita (<code>123450</code>) para nunca rejeitar a criação, e o login suportará ambas de forma transparente.</li>
          <li><b>Sem Senha:</b> Usuários que não possuem nenhuma senha registrada na planilha utilizarão a <b>Senha Padrão</b> configurada acima (padrão: <code>{defaultPassword}</code>). Eles poderão alterá-la posteriormente pelo botão "Esqueceu a senha?" na tela de Login.</li>
        </ul>
      </div>
    </div>
  );
};
