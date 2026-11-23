import React, { useMemo, useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Archive,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trash2,
  Unlink,
  UserX,
  X
} from 'lucide-react';
import { OrphanBatchTarget, useAppContext } from '../context';
import { Processo, Usuario } from '../types';

type DeleteStrategyProcess = 'transfer' | 'unlink_and_clean' | 'archive';
type DeleteStrategyUser = 'inactivate' | 'transfer' | 'unlink_and_delete';

interface SafeDeleteEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'processo' | 'usuario';
  processo?: Processo | null;
  usuario?: Usuario | null;
  onCompleted?: (message: string) => void;
}

interface DependencyGroup {
  label: string;
  count: number;
  optional: boolean;
}

export const SafeDeleteEntityModal: React.FC<SafeDeleteEntityModalProps> = ({
  isOpen,
  onClose,
  entityType,
  processo,
  usuario,
  onCompleted,
}) => {
  const {
    state,
    applyOrphanCleanupBatch,
    deleteProcesso,
    updateProcesso,
    deleteUsuario,
    toggleUsuarioStatus,
    dataSource,
  } = useAppContext();

  const [processStrategy, setProcessStrategy] = useState<DeleteStrategyProcess>('unlink_and_clean');
  const [userStrategy, setUserStrategy] = useState<DeleteStrategyUser>('inactivate');
  const [targetId, setTargetId] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Coleta todos os vínculos que ficariam órfãos caso o registro fosse excluído diretamente
  const analysis = useMemo(() => {
    const allTargets: OrphanBatchTarget[] = [];
    const optionalTargets: OrphanBatchTarget[] = [];
    const strictTargets: OrphanBatchTarget[] = [];
    const groups: DependencyGroup[] = [];

    if (entityType === 'processo' && processo) {
      const keys = new Set<string>();
      if (processo.id) keys.add(String(processo.id).trim().toUpperCase());
      if (processo.idProc) keys.add(String(processo.idProc).trim().toUpperCase());

      const matchesProc = (raw?: string) => {
        const clean = String(raw || '').trim().toUpperCase();
        return !!clean && keys.has(clean);
      };

      const pushGroup = (
        label: string,
        module: OrphanBatchTarget['module'],
        field: OrphanBatchTarget['field'],
        ids: string[],
        optional: boolean
      ) => {
        if (ids.length === 0) return;
        groups.push({ label, count: ids.length, optional });
        ids.forEach(recordId => {
          const t: OrphanBatchTarget = { module, recordId, field };
          allTargets.push(t);
          if (optional) optionalTargets.push(t);
          else strictTargets.push(t);
        });
      };

      pushGroup(
        'Movimentos',
        'movimentos',
        'processoId',
        (state.movimentos || []).filter(m => matchesProc(m.processoId)).map(m => m.id),
        false
      );
      pushGroup(
        'Tarefas',
        'tarefas',
        'processoId',
        (state.tarefas || [])
          .filter(t => matchesProc(t.PROCESSO_ID || t.ID_PROC))
          .map(t => String(t.ID_TAREFA || t.id || '')),
        true
      );
      pushGroup(
        'Eventos / Agenda',
        'eventos',
        'processoId',
        (state.eventos || []).filter(e => matchesProc(e.processoId)).map(e => e.id),
        true
      );
      pushGroup(
        'Financeiro',
        'financeiro',
        'processoId',
        (state.financeiro || []).filter(f => matchesProc(f.processoId)).map(f => f.id),
        true
      );
      pushGroup(
        'Documentos',
        'documentos',
        'processoId',
        (state.documentos || []).filter(d => matchesProc(d.processoId)).map(d => d.id),
        true
      );
      pushGroup(
        'Recursos',
        'recursos',
        'processoOriginarioId',
        (state.recursos || []).filter(r => matchesProc(r.processoOriginarioId)).map(r => r.id),
        false
      );
      pushGroup(
        'Envolvidos',
        'envolvidos',
        'processoId',
        (state.envolvidos || []).filter(ev => matchesProc(ev.processoId)).map(ev => ev.id),
        false
      );
    } else if (entityType === 'usuario' && usuario) {
      const targetUserKey = String(usuario.id || '').trim().toLowerCase();
      const matchesUser = (raw?: string) => {
        const clean = String(raw || '').trim().toLowerCase();
        return !!clean && clean === targetUserKey;
      };

      const pushUserGroup = (
        label: string,
        module: OrphanBatchTarget['module'],
        field: OrphanBatchTarget['field'],
        ids: string[]
      ) => {
        if (ids.length === 0) return;
        groups.push({ label, count: ids.length, optional: true });
        ids.forEach(recordId => {
          const t: OrphanBatchTarget = { module, recordId, field };
          allTargets.push(t);
          optionalTargets.push(t);
        });
      };

      pushUserGroup(
        'Tarefas (Responsável)',
        'tarefas',
        'responsavelId',
        (state.tarefas || [])
          .filter(t => matchesUser(t.RESPONSAVEL_ID || t.ID_USER))
          .map(t => String(t.ID_TAREFA || t.id || ''))
      );
      pushUserGroup(
        'Tarefas (Atribuído por)',
        'tarefas',
        'atribuidoId',
        (state.tarefas || [])
          .filter(t => matchesUser(t.ATRIBUIDO_ID))
          .map(t => String(t.ID_TAREFA || t.id || ''))
      );
      pushUserGroup(
        'Eventos / Agenda',
        'eventos',
        'usuarioId',
        (state.eventos || []).filter(e => matchesUser(e.usuarioId)).map(e => e.id)
      );
      pushUserGroup(
        'Movimentos',
        'movimentos',
        'usuarioId',
        (state.movimentos || []).filter(m => matchesUser(m.usuarioId)).map(m => m.id)
      );
      pushUserGroup(
        'Financeiro',
        'financeiro',
        'usuarioId',
        (state.financeiro || []).filter(f => matchesUser(f.usuarioId)).map(f => f.id)
      );
      pushUserGroup(
        'Processos (Advogado)',
        'processos',
        'advogadoId',
        (state.processos || []).filter(p => matchesUser(p.advogadoId)).map(p => p.id)
      );
    }

    return {
      total: allTargets.length,
      optionalCount: optionalTargets.length,
      strictCount: strictTargets.length,
      allTargets,
      optionalTargets,
      strictTargets,
      groups,
    };
  }, [
    entityType,
    processo,
    usuario,
    state.movimentos,
    state.tarefas,
    state.eventos,
    state.financeiro,
    state.documentos,
    state.recursos,
    state.envolvidos,
    state.processos,
  ]);

  // Reinicia opções ao abrir para um novo registro
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setTargetId('');
    setTargetSearch('');
    setProcessStrategy(analysis.strictCount > 0 ? 'transfer' : 'unlink_and_clean');
    setUserStrategy('inactivate');
  }, [isOpen, processo?.id, usuario?.id, analysis.strictCount]);

  // Lista de destinos possíveis (excluindo o próprio registro em exclusão)
  const processCandidates = useMemo(() => {
    if (entityType !== 'processo' || !processo) return [];
    const q = targetSearch.trim().toLowerCase();
    const prefOffice = String(processo.escritorioId || '').trim().toUpperCase();

    return (state.processos || [])
      .filter(p => p.id !== processo.id)
      .filter(p => {
        if (!q) return true;
        const hay = `${p.numero || ''} ${p.titulo || ''} ${p.parteContraria || ''} ${p.id || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        if (prefOffice) {
          const aMatch = (a.escritorioId || '').toUpperCase() === prefOffice ? 0 : 1;
          const bMatch = (b.escritorioId || '').toUpperCase() === prefOffice ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
        }
        return (a.numero || a.id).localeCompare(b.numero || b.id);
      })
      .slice(0, 150);
  }, [entityType, processo, state.processos, targetSearch]);

  const userCandidates = useMemo(() => {
    if (entityType !== 'usuario' || !usuario) return [];
    const q = targetSearch.trim().toLowerCase();
    const prefOffices = new Set((usuario.escritoriosIds || []).map(e => e.toUpperCase()));

    return (state.usuarios || [])
      .filter(u => u.id !== usuario.id)
      .filter(u => {
        if (!q) return true;
        const hay = `${u.nome || ''} ${u.email || ''} ${u.cargo || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        if (prefOffices.size > 0) {
          const aMatch = (a.escritoriosIds || []).some(e => prefOffices.has(e.toUpperCase())) ? 0 : 1;
          const bMatch = (b.escritoriosIds || []).some(e => prefOffices.has(e.toUpperCase())) ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
        }
        return (a.nome || a.email).localeCompare(b.nome || b.email);
      });
  }, [entityType, usuario, state.usuarios, targetSearch]);

  if (!isOpen) return null;
  if (entityType === 'processo' && !processo) return null;
  if (entityType === 'usuario' && !usuario) return null;

  const isAlreadyInactiveUser =
    entityType === 'usuario' &&
    String(usuario?.status || 'Ativo').trim().toLowerCase() === 'inativo';

  const handleConfirm = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (entityType === 'processo' && processo) {
        if (analysis.total === 0) {
          deleteProcesso(processo.id);
          onCompleted?.('Processo excluído sem vínculos órfãos.');
          onClose();
          return;
        }

        if (processStrategy === 'archive') {
          updateProcesso({
            ...processo,
            status: 'Inativo',
            ativo: 'Inativo',
          });
          onCompleted?.('Processo inativado com segurança. Todos os vínculos históricos foram preservados.');
          onClose();
          return;
        }

        if (processStrategy === 'transfer') {
          if (!targetId) {
            setErrorMsg('Selecione o processo de destino para transferir os vínculos.');
            setIsSubmitting(false);
            return;
          }
          const res = await applyOrphanCleanupBatch(analysis.allTargets, 'assign', targetId);
          if (res.errorCount > 0 && res.successCount === 0) {
            setErrorMsg('Não foi possível transferir os vínculos antes da exclusão.');
            setIsSubmitting(false);
            return;
          }
          deleteProcesso(processo.id);
          onCompleted?.(`${res.successCount} vínculo(s) transferido(s) e processo excluído com segurança.`);
          onClose();
          return;
        }

        // unlink_and_clean
        if (analysis.optionalTargets.length > 0) {
          const unlinkRes = await applyOrphanCleanupBatch(analysis.optionalTargets, 'unlink');
          if (unlinkRes.errorCount > 0 && unlinkRes.successCount === 0) {
            setErrorMsg('Falha ao desvincular os registros opcionais.');
            setIsSubmitting(false);
            return;
          }
        }
        if (analysis.strictTargets.length > 0) {
          const delRes = await applyOrphanCleanupBatch(analysis.strictTargets, 'delete');
          if (delRes.errorCount > 0 && delRes.successCount === 0) {
            setErrorMsg('Falha ao limpar registros dependentes estritos.');
            setIsSubmitting(false);
            return;
          }
        }
        deleteProcesso(processo.id);
        onCompleted?.(
          `Processo excluído sem gerar órfãos (${analysis.optionalCount} preservado(s) como avulso(s), ${analysis.strictCount} dependente(s) removido(s)).`
        );
        onClose();
        return;
      }

      if (entityType === 'usuario' && usuario) {
        if (userStrategy === 'inactivate' && analysis.total > 0) {
          const res = await toggleUsuarioStatus(usuario.id, 'Inativo');
          if (res && !res.success) {
            setErrorMsg(res.error || 'Falha ao inativar usuário.');
            setIsSubmitting(false);
            return;
          }
          onCompleted?.(`Usuário "${usuario.nome}" inativado com segurança (vínculos preservados).`);
          onClose();
          return;
        }

        if (analysis.total > 0 && userStrategy === 'transfer') {
          if (!targetId) {
            setErrorMsg('Selecione o usuário de destino para transferir os vínculos.');
            setIsSubmitting(false);
            return;
          }
          const batchRes = await applyOrphanCleanupBatch(analysis.allTargets, 'assign', targetId);
          if (batchRes.errorCount > 0 && batchRes.successCount === 0) {
            setErrorMsg('Não foi possível transferir os vínculos para o usuário destino.');
            setIsSubmitting(false);
            return;
          }
        } else if (analysis.total > 0 && userStrategy === 'unlink_and_delete') {
          const batchRes = await applyOrphanCleanupBatch(analysis.allTargets, 'unlink');
          if (batchRes.errorCount > 0 && batchRes.successCount === 0) {
            setErrorMsg('Não foi possível desvincular as referências antes da exclusão.');
            setIsSubmitting(false);
            return;
          }
        }

        const delRes = await deleteUsuario(usuario.id);
        if (delRes && !delRes.success) {
          setErrorMsg(delRes.error || 'Falha ao excluir usuário.');
          setIsSubmitting(false);
          return;
        }
        onCompleted?.(
          analysis.total > 0
            ? `Usuário "${usuario.nome}" excluído sem gerar registros órfãos.`
            : `Usuário "${usuario.nome}" excluído.`
        );
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro inesperado durante a operação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-app-border flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                analysis.total > 0
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              }`}
            >
              {analysis.total > 0 ? <AlertTriangle size={20} /> : <Trash2 size={20} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-app-text">
                {entityType === 'processo'
                  ? `Excluir Processo ${processo?.numero || processo?.id}`
                  : `Excluir Usuário ${usuario?.nome || ''}`}
              </h3>
              <p className="text-xs text-app-text-muted mt-0.5">
                {analysis.total > 0
                  ? `Existem ${analysis.total.toLocaleString('pt-BR')} vínculo(s) ativo(s) apontando para este registro.`
                  : entityType === 'usuario' && dataSource === 'supabase'
                  ? 'Nenhum vínculo encontrado em tarefas, eventos, financeiro ou processos. A conta será removida do banco e do auth.users.'
                  : 'Nenhum vínculo dependente encontrado na base. Exclusão segura.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 text-app-text-muted hover:text-app-text rounded-lg"
            aria-label="Fechar janela"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {analysis.total > 0 && (
            <div className="bg-app-bg border border-app-border rounded-xl p-3.5 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
                Impacto Preventivo Detectado
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-app-text tabular-nums">
                {analysis.groups.map(g => (
                  <span key={g.label} className="inline-flex items-center gap-1.5">
                    <strong>{g.count.toLocaleString('pt-BR')}</strong>
                    <span className="text-app-text-muted">{g.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Opções para Processo com dependentes */}
          {entityType === 'processo' && analysis.total > 0 && (
            <div className="space-y-2.5">
              <label
                className={`block p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  processStrategy === 'transfer'
                    ? 'border-primary bg-primary/5'
                    : 'border-app-border bg-app-bg hover:border-primary/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="procStrategy"
                    checked={processStrategy === 'transfer'}
                    onChange={() => setProcessStrategy('transfer')}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="text-xs font-bold text-app-text flex items-center gap-1.5">
                      <ArrowRightLeft size={14} className="text-primary" />
                      Transferir todos os {analysis.total.toLocaleString('pt-BR')} vínculo(s) para outro Processo e Excluir
                    </div>
                    <p className="text-[11px] text-app-text-muted">
                      Move movimentações, tarefas, financeiro, documentos, eventos, recursos e envolvidos para outro processo ativo antes de apagar este.
                    </p>
                    {processStrategy === 'transfer' && (
                      <div className="space-y-1.5 pt-1">
                        <input
                          type="text"
                          value={targetSearch}
                          onChange={e => setTargetSearch(e.target.value)}
                          placeholder="Buscar processo destino por número ou parte..."
                          className="w-full px-3 py-1.5 bg-app-surface border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:border-primary"
                        />
                        <select
                          value={targetId}
                          onChange={e => setTargetId(e.target.value)}
                          className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:border-primary"
                        >
                          <option value="">Selecione o processo destino...</option>
                          {processCandidates.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.numero || p.id}{p.titulo ? ` — ${p.titulo.slice(0, 42)}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </label>

              <label
                className={`block p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  processStrategy === 'unlink_and_clean'
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-app-border bg-app-bg hover:border-emerald-500/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="procStrategy"
                    checked={processStrategy === 'unlink_and_clean'}
                    onChange={() => setProcessStrategy('unlink_and_clean')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-app-text flex items-center gap-1.5">
                      <Unlink size={14} className="text-emerald-600 dark:text-emerald-400" />
                      Preservar opcionais como avulsos e excluir processo
                    </div>
                    <p className="text-[11px] text-app-text-muted mt-0.5 tabular-nums">
                      {analysis.optionalCount > 0 && (
                        <>
                          Preserva <strong>{analysis.optionalCount}</strong> registro(s) sem vínculo (Financeiro, Documentos, Tarefas, Eventos).{' '}
                        </>
                      )}
                      {analysis.strictCount > 0 && (
                        <>
                          Remove <strong>{analysis.strictCount}</strong> dependente(s) estrito(s) (Movimentos, Recursos, Envolvidos).
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </label>

              <label
                className={`block p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  processStrategy === 'archive'
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-app-border bg-app-bg hover:border-blue-500/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="procStrategy"
                    checked={processStrategy === 'archive'}
                    onChange={() => setProcessStrategy('archive')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-600"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-app-text flex items-center gap-1.5">
                      <Archive size={14} className="text-blue-600 dark:text-blue-400" />
                      Apenas Inativar Processo (Recomendado p/ histórico)
                    </div>
                    <p className="text-[11px] text-app-text-muted mt-0.5">
                      Mantém todos os {analysis.total.toLocaleString('pt-BR')} vínculo(s) intactos e marca o processo como Inativo.
                    </p>
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* Opções para Usuário com dependentes */}
          {entityType === 'usuario' && analysis.total > 0 && (
            <div className="space-y-2.5">
              <label
                className={`block p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  userStrategy === 'inactivate'
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-app-border bg-app-bg hover:border-emerald-500/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="userStrategy"
                    checked={userStrategy === 'inactivate'}
                    onChange={() => setUserStrategy('inactivate')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-app-text flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                      {isAlreadyInactiveUser ? 'Manter Usuário Inativo (sem excluir histórico)' : 'Inativar Acesso em vez de Excluir (Recomendado)'}
                    </div>
                    <p className="text-[11px] text-app-text-muted mt-0.5">
                      Bloqueia imediatamente o login do usuário sem quebrar a autoria de movimentações, tarefas, financeiro e processos vinculados.
                    </p>
                  </div>
                </div>
              </label>

              <label
                className={`block p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  userStrategy === 'transfer'
                    ? 'border-primary bg-primary/5'
                    : 'border-app-border bg-app-bg hover:border-primary/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="userStrategy"
                    checked={userStrategy === 'transfer'}
                    onChange={() => setUserStrategy('transfer')}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="text-xs font-bold text-app-text flex items-center gap-1.5">
                      <ArrowRightLeft size={14} className="text-primary" />
                      Transferir todos os {analysis.total.toLocaleString('pt-BR')} vínculo(s) para outro Usuário e Excluir
                    </div>
                    {userStrategy === 'transfer' && (
                      <select
                        value={targetId}
                        onChange={e => setTargetId(e.target.value)}
                        className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:border-primary"
                      >
                        <option value="">Selecione o usuário substituto...</option>
                        {userCandidates.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.nome} ({u.email})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </label>

              <label
                className={`block p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  userStrategy === 'unlink_and_delete'
                    ? 'border-red-500 bg-red-500/5'
                    : 'border-app-border bg-app-bg hover:border-red-500/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="userStrategy"
                    checked={userStrategy === 'unlink_and_delete'}
                    onChange={() => setUserStrategy('unlink_and_delete')}
                    className="mt-0.5 text-red-600 focus:ring-red-600"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-app-text flex items-center gap-1.5">
                      <UserX size={14} className="text-red-600 dark:text-red-400" />
                      Desvincular referências e Excluir Usuário definitivamente
                    </div>
                    <p className="text-[11px] text-app-text-muted mt-0.5">
                      Limpa o campo de usuário nos {analysis.total.toLocaleString('pt-BR')} registro(s) e remove a conta permanentemente sem deixar órfãos.
                    </p>
                  </div>
                </div>
              </label>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl border border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-app-border flex items-center justify-end gap-2.5 bg-app-bg/40">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 bg-app-surface border border-app-border text-app-text rounded-xl text-xs font-bold hover:border-app-text-muted whitespace-nowrap shrink-0"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={
              isSubmitting ||
              (analysis.total > 0 &&
                ((entityType === 'processo' && processStrategy === 'transfer' && !targetId) ||
                  (entityType === 'usuario' && userStrategy === 'transfer' && !targetId)))
            }
            onClick={handleConfirm}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-50 ${
              analysis.total > 0 && entityType === 'processo' && processStrategy === 'archive'
                ? 'bg-blue-600 hover:bg-blue-700'
                : analysis.total > 0 && entityType === 'usuario' && userStrategy === 'inactivate'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {analysis.total === 0
              ? 'Confirmar Exclusão'
              : entityType === 'processo'
              ? processStrategy === 'archive'
                ? 'Inativar Processo'
                : processStrategy === 'transfer'
                ? 'Transferir e Excluir'
                : 'Desvincular e Excluir'
              : userStrategy === 'inactivate'
              ? 'Inativar Usuário'
              : userStrategy === 'transfer'
              ? 'Transferir e Excluir'
              : 'Desvincular e Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
};
