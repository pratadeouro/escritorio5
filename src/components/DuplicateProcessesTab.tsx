import React, { useMemo, useState, useEffect } from 'react';
import {
  GitMerge,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Building2,
  X
} from 'lucide-react';
import { DuplicateMergePlan, useAppContext } from '../context';
import { Processo } from '../types';

interface ProcessDependencyCounts {
  movimentos: number;
  tarefas: number;
  eventos: number;
  financeiro: number;
  documentos: number;
  recursos: number;
  envolvidos: number;
  total: number;
}

interface ProcessCandidateMeta {
  processo: Processo;
  deps: ProcessDependencyCounts;
  filledFields: number;
  escritorioNome: string;
  clienteNome: string;
  varaNome: string;
}

interface DuplicateGroup {
  groupKey: string;
  displayNumero: string;
  normalizedNumero: string;
  isCrossOffice: boolean;
  escritorioLabel: string;
  candidates: ProcessCandidateMeta[];
  suggestedMasterId: string;
  totalDepsInGroup: number;
  totalDepsToTransferIfSuggested: number;
}

const MERGEABLE_FIELDS: Array<{ key: keyof Processo; label: string }> = [
  { key: 'varaId', label: 'Vara' },
  { key: 'tribunalId', label: 'Tribunal (ID)' },
  { key: 'tribunal', label: 'Tribunal' },
  { key: 'forumId', label: 'Fórum' },
  { key: 'upjId', label: 'UPJ' },
  { key: 'servidorId', label: 'Servidor' },
  { key: 'advogadoId', label: 'Advogado' },
  { key: 'clienteId', label: 'Cliente' },
  { key: 'parteContraria', label: 'Parte Contrária' },
  { key: 'titulo', label: 'Título' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'instancia', label: 'Instância' },
  { key: 'classe', label: 'Classe' },
  { key: 'assunto', label: 'Assunto' },
  { key: 'dataDistribuicao', label: 'Data Distribuição' },
  { key: 'valorCausa', label: 'Valor da Causa' },
  { key: 'resultado', label: 'Resultado' },
  { key: 'link', label: 'Link' },
  { key: 'pasta', label: 'Pasta' },
  { key: 'disponibilizacao', label: 'Disponibilização' },
  { key: 'publicacao', label: 'Publicação' },
  { key: 'inicioPrazo', label: 'Início do Prazo' },
];

const GROUPS_PER_PAGE = 15;

export const normalizeProcessMergeKey = (numero?: string): string => {
  const raw = String(numero || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10) return digits;
  const clean = raw.toUpperCase();
  return clean.length >= 5 ? clean : '';
};

const isEmptyFieldVal = (val: any): boolean => {
  if (val === null || val === undefined) return true;
  if (typeof val === 'number') return val === 0;
  if (Array.isArray(val)) return val.length === 0;
  const str = String(val).trim();
  return str === '' || str === 'N/D' || str === 'Não Informado';
};

const countFilledFields = (p: Processo): number => {
  let count = 0;
  for (const f of MERGEABLE_FIELDS) {
    if (!isEmptyFieldVal(p[f.key])) count += 1;
  }
  if (!isEmptyFieldVal(p.tags)) count += 1;
  if (Array.isArray(p.envolvidosIds) && p.envolvidosIds.length > 0) count += 1;
  return count;
};

const buildMergedMaster = (
  master: Processo,
  duplicates: Processo[]
): { mergedMaster: Processo; enrichedLabels: string[] } => {
  const merged: Processo = { ...master };
  const enrichedLabels: string[] = [];

  for (const f of MERGEABLE_FIELDS) {
    if (isEmptyFieldVal(merged[f.key])) {
      for (const dup of duplicates) {
        const candidateVal = dup[f.key];
        if (!isEmptyFieldVal(candidateVal)) {
          (merged as any)[f.key] = candidateVal;
          enrichedLabels.push(f.label);
          break;
        }
      }
    }
  }

  // Consolida tags únicas
  const tagSet = new Set<string>();
  const addTags = (raw?: string) => {
    String(raw || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(t => tagSet.add(t));
  };
  const masterTagsBefore = new Set<string>();
  String(master.tags || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(t => {
      masterTagsBefore.add(t);
      tagSet.add(t);
    });
  duplicates.forEach(d => addTags(d.tags));
  if (tagSet.size > masterTagsBefore.size) {
    merged.tags = Array.from(tagSet).join(', ');
    enrichedLabels.push('Etiquetas');
  }

  // Consolida envolvidosIds únicos
  const envSet = new Set<string>(Array.isArray(master.envolvidosIds) ? master.envolvidosIds : []);
  const envBefore = envSet.size;
  duplicates.forEach(d => {
    if (Array.isArray(d.envolvidosIds)) {
      d.envolvidosIds.forEach(id => {
        if (id) envSet.add(id);
      });
    }
  });
  if (envSet.size > envBefore) {
    merged.envolvidosIds = Array.from(envSet);
    enrichedLabels.push('Envolvidos');
  }

  return { mergedMaster: merged, enrichedLabels };
};

export const DuplicateProcessesTab: React.FC = () => {
  const { state, forceLoad, mergeDuplicateProcessesBatch } = useAppContext();

  const [includeCrossOffice, setIncludeCrossOffice] = useState(false);
  const [officeFilter, setOfficeFilter] = useState<string>('all');
  const [depsFilter, setDepsFilter] = useState<'all' | 'with_deps' | 'no_deps'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [masterOverrides, setMasterOverrides] = useState<Record<string, string>>({});
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [confirmGroups, setConfirmGroups] = useState<DuplicateGroup[] | null>(null);

  const officeMap = useMemo(() => {
    const map = new Map<string, string>();
    (state.escritorios || []).forEach(e => {
      if (e.id) map.set(String(e.id).trim().toUpperCase(), e.nome || e.id);
    });
    return map;
  }, [state.escritorios]);

  const contatoMap = useMemo(() => {
    const map = new Map<string, string>();
    (state.contatos || []).forEach(c => {
      if (c.id) map.set(String(c.id).trim().toUpperCase(), c.nome || c.id);
    });
    return map;
  }, [state.contatos]);

  const varaMap = useMemo(() => {
    const map = new Map<string, string>();
    (state.varas || []).forEach(v => {
      if (v.id) map.set(String(v.id).trim().toUpperCase(), v.nome || v.id);
    });
    return map;
  }, [state.varas]);

  // Indexa contagem de dependentes por chave de processo em O(N)
  const depsIndex = useMemo(() => {
    const makeEmpty = (): ProcessDependencyCounts => ({
      movimentos: 0,
      tarefas: 0,
      eventos: 0,
      financeiro: 0,
      documentos: 0,
      recursos: 0,
      envolvidos: 0,
      total: 0,
    });
    const map = new Map<string, ProcessDependencyCounts>();
    const bump = (rawKey: string | undefined, field: keyof Omit<ProcessDependencyCounts, 'total'>) => {
      const k = String(rawKey || '').trim().toUpperCase();
      if (!k) return;
      const curr = map.get(k) || makeEmpty();
      curr[field] += 1;
      curr.total += 1;
      map.set(k, curr);
    };

    (state.movimentos || []).forEach(m => bump(m.processoId, 'movimentos'));
    (state.tarefas || []).forEach(t => bump(t.PROCESSO_ID || t.ID_PROC, 'tarefas'));
    (state.eventos || []).forEach(e => bump(e.processoId, 'eventos'));
    (state.financeiro || []).forEach(f => bump(f.processoId, 'financeiro'));
    (state.documentos || []).forEach(d => bump(d.processoId, 'documentos'));
    (state.recursos || []).forEach(r => bump(r.processoOriginarioId, 'recursos'));
    (state.envolvidos || []).forEach(ev => bump(ev.processoId, 'envolvidos'));

    return map;
  }, [
    state.movimentos,
    state.tarefas,
    state.eventos,
    state.financeiro,
    state.documentos,
    state.recursos,
    state.envolvidos,
  ]);

  const getProcessDeps = (p: Processo): ProcessDependencyCounts => {
    const k1 = String(p.id || '').trim().toUpperCase();
    const k2 = String(p.idProc || '').trim().toUpperCase();
    const d1 = k1 ? depsIndex.get(k1) : undefined;
    const d2 = k2 && k2 !== k1 ? depsIndex.get(k2) : undefined;
    if (!d1 && !d2) {
      return { movimentos: 0, tarefas: 0, eventos: 0, financeiro: 0, documentos: 0, recursos: 0, envolvidos: 0, total: 0 };
    }
    if (d1 && !d2) return d1;
    if (!d1 && d2) return d2;
    return {
      movimentos: (d1?.movimentos || 0) + (d2?.movimentos || 0),
      tarefas: (d1?.tarefas || 0) + (d2?.tarefas || 0),
      eventos: (d1?.eventos || 0) + (d2?.eventos || 0),
      financeiro: (d1?.financeiro || 0) + (d2?.financeiro || 0),
      documentos: (d1?.documentos || 0) + (d2?.documentos || 0),
      recursos: (d1?.recursos || 0) + (d2?.recursos || 0),
      envolvidos: (d1?.envolvidos || 0) + (d2?.envolvidos || 0),
      total: (d1?.total || 0) + (d2?.total || 0),
    };
  };

  // Detecta grupos duplicados (mesmo escritório e cross-office separadamente)
  const { sameOfficeGroups, crossOfficeGroups } = useMemo(() => {
    const byOfficeAndNum = new Map<string, Processo[]>();
    const byNumOnly = new Map<string, Processo[]>();

    (state.processos || []).forEach(p => {
      const norm = normalizeProcessMergeKey(p.numero);
      if (!norm) return;
      const esc = String(p.escritorioId || '').trim().toUpperCase() || 'SEM_ESCRITORIO';
      const officeKey = `${esc}::${norm}`;
      if (!byOfficeAndNum.has(officeKey)) byOfficeAndNum.set(officeKey, []);
      byOfficeAndNum.get(officeKey)!.push(p);

      if (!byNumOnly.has(norm)) byNumOnly.set(norm, []);
      byNumOnly.get(norm)!.push(p);
    });

    const buildGroup = (groupKey: string, normNum: string, list: Processo[], isCrossOffice: boolean): DuplicateGroup => {
      const candidates: ProcessCandidateMeta[] = list.map(p => {
        const escId = String(p.escritorioId || '').trim().toUpperCase();
        const cliId = String(p.clienteId || '').trim().toUpperCase();
        const varId = String(p.varaId || '').trim().toUpperCase();
        return {
          processo: p,
          deps: getProcessDeps(p),
          filledFields: countFilledFields(p),
          escritorioNome: escId ? (officeMap.get(escId) || escId) : 'Sem escritório',
          clienteNome: cliId ? (contatoMap.get(cliId) || cliId) : '—',
          varaNome: varId ? (varaMap.get(varId) || p.varaId || '—') : '—',
        };
      });

      // Ordena candidatos: mais vínculos -> status Ativo -> mais campos preenchidos -> ID com prefixo PROC_
      candidates.sort((a, b) => {
        if (b.deps.total !== a.deps.total) return b.deps.total - a.deps.total;
        const aActive = a.processo.status === 'Ativo' ? 1 : 0;
        const bActive = b.processo.status === 'Ativo' ? 1 : 0;
        if (bActive !== aActive) return bActive - aActive;
        if (b.filledFields !== a.filledFields) return b.filledFields - a.filledFields;
        const aProc = String(a.processo.id || '').startsWith('PROC_') ? 1 : 0;
        const bProc = String(b.processo.id || '').startsWith('PROC_') ? 1 : 0;
        if (bProc !== aProc) return bProc - aProc;
        return String(a.processo.id).localeCompare(String(b.processo.id));
      });

      const suggestedMasterId = candidates[0].processo.id;
      const totalDepsInGroup = candidates.reduce((acc, c) => acc + c.deps.total, 0);
      const totalDepsToTransferIfSuggested = candidates.slice(1).reduce((acc, c) => acc + c.deps.total, 0);
      const officeNames = Array.from(new Set(candidates.map(c => c.escritorioNome)));

      return {
        groupKey,
        displayNumero: candidates[0].processo.numero || normNum,
        normalizedNumero: normNum,
        isCrossOffice,
        escritorioLabel: officeNames.join(' / '),
        candidates,
        suggestedMasterId,
        totalDepsInGroup,
        totalDepsToTransferIfSuggested,
      };
    };

    const same: DuplicateGroup[] = [];
    byOfficeAndNum.forEach((list, k) => {
      if (list.length > 1) {
        const norm = k.split('::')[1];
        same.push(buildGroup(k, norm, list, false));
      }
    });

    const cross: DuplicateGroup[] = [];
    byNumOnly.forEach((list, norm) => {
      const offices = new Set(list.map(p => String(p.escritorioId || '').trim().toUpperCase() || 'SEM_ESCRITORIO'));
      if (offices.size > 1) {
        cross.push(buildGroup(`CROSS::${norm}`, norm, list, true));
      }
    });

    same.sort((a, b) => b.totalDepsInGroup - a.totalDepsInGroup || a.displayNumero.localeCompare(b.displayNumero));
    cross.sort((a, b) => b.candidates.length - a.candidates.length || a.displayNumero.localeCompare(b.displayNumero));

    return { sameOfficeGroups: same, crossOfficeGroups: cross };
  }, [state.processos, depsIndex, officeMap, contatoMap, varaMap]);

  const activeGroups = useMemo(() => {
    return includeCrossOffice ? [...sameOfficeGroups, ...crossOfficeGroups] : sameOfficeGroups;
  }, [includeCrossOffice, sameOfficeGroups, crossOfficeGroups]);

  // Estatísticas resumidas (baseadas sempre nos duplicados seguros do mesmo escritório + alerta cross-office)
  const stats = useMemo(() => {
    const extraCopies = sameOfficeGroups.reduce((acc, g) => acc + (g.candidates.length - 1), 0);
    const withDeps = sameOfficeGroups.filter(g => g.totalDepsInGroup > 0).length;
    const withEnrichments = sameOfficeGroups.filter(g => {
      const masterId = masterOverrides[g.groupKey] || g.suggestedMasterId;
      const master = g.candidates.find(c => c.processo.id === masterId)?.processo || g.candidates[0].processo;
      const dups = g.candidates.filter(c => c.processo.id !== master.id).map(c => c.processo);
      return buildMergedMaster(master, dups).enrichedLabels.length > 0;
    }).length;
    return {
      groupCount: sameOfficeGroups.length,
      extraCopies,
      withDeps,
      withEnrichments,
      crossOfficeCount: crossOfficeGroups.length,
    };
  }, [sameOfficeGroups, crossOfficeGroups, masterOverrides]);

  const filteredGroups = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return activeGroups.filter(g => {
      if (officeFilter !== 'all') {
        const matchesOffice = g.candidates.some(
          c => String(c.processo.escritorioId || '').trim().toUpperCase() === officeFilter.toUpperCase()
        );
        if (!matchesOffice) return false;
      }
      if (depsFilter === 'with_deps' && g.totalDepsInGroup === 0) return false;
      if (depsFilter === 'no_deps' && g.totalDepsInGroup > 0) return false;
      if (q) {
        const hay = [
          g.displayNumero,
          g.normalizedNumero,
          g.escritorioLabel,
          ...g.candidates.map(c => `${c.processo.id} ${c.processo.idProc || ''} ${c.clienteNome} ${c.varaNome} ${c.processo.titulo || ''}`)
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeGroups, officeFilter, depsFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [includeCrossOffice, officeFilter, depsFilter, searchTerm]);

  useEffect(() => {
    const validKeys = new Set(activeGroups.map(g => g.groupKey));
    setSelectedGroupKeys(prev => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach(k => {
        if (validKeys.has(k)) next.add(k);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [activeGroups]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / GROUPS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageGroups = useMemo(() => {
    const start = (safePage - 1) * GROUPS_PER_PAGE;
    return filteredGroups.slice(start, start + GROUPS_PER_PAGE);
  }, [filteredGroups, safePage]);

  const buildPlanForGroup = (group: DuplicateGroup): DuplicateMergePlan => {
    const masterId = masterOverrides[group.groupKey] || group.suggestedMasterId;
    const master = group.candidates.find(c => c.processo.id === masterId)?.processo || group.candidates[0].processo;
    const dups = group.candidates.filter(c => c.processo.id !== master.id).map(c => c.processo);
    const { mergedMaster } = buildMergedMaster(master, dups);
    return {
      masterId: master.id,
      duplicateIds: dups.map(d => d.id),
      mergedMaster,
    };
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setFeedback(null);
    try {
      await forceLoad();
      setFeedback({ type: 'info', message: 'Base recarregada e análise de duplicidades atualizada.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao recarregar dados.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const executeMerge = async (groupsToMerge: DuplicateGroup[]) => {
    if (groupsToMerge.length === 0) return;
    setIsMerging(true);
    setFeedback(null);
    try {
      const plans = groupsToMerge.map(buildPlanForGroup);
      const res = await mergeDuplicateProcessesBatch(plans);

      setSelectedGroupKeys(prev => {
        const next = new Set(prev);
        groupsToMerge.forEach(g => next.delete(g.groupKey));
        return next;
      });

      if (res.errorCount > 0 && res.mergedGroups === 0) {
        setFeedback({
          type: 'error',
          message: `Falha ao mesclar os grupos selecionados (${res.errorCount} erro(s)).`,
        });
      } else if (res.errorCount > 0) {
        setFeedback({
          type: 'info',
          message: `${res.mergedGroups} grupo(s) mesclado(s), ${res.removedProcesses} cópia(s) removida(s), ${res.transferredLinks} vínculo(s) transferido(s); ${res.errorCount} aviso(s).`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Mesclagem concluída: ${res.mergedGroups} grupo(s) consolidado(s), ${res.removedProcesses} cópia(s) removida(s), ${res.transferredLinks} vínculo(s) transferido(s)${res.deduplicatedParties > 0 ? ` e ${res.deduplicatedParties} envolvido(s) repetido(s) unificado(s)` : ''}.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro inesperado ao mesclar processos.',
      });
    } finally {
      setIsMerging(false);
      setConfirmGroups(null);
    }
  };

  const selectedGroups = useMemo(
    () => filteredGroups.filter(g => selectedGroupKeys.has(g.groupKey)),
    [filteredGroups, selectedGroupKeys]
  );

  // Na seleção em lote rápida ("Selecionar todos"), priorizamos apenas grupos seguros do mesmo escritório
  const selectAllSameOfficeFiltered = () => {
    setSelectedGroupKeys(
      new Set(filteredGroups.filter(g => !g.isCrossOffice).map(g => g.groupKey))
    );
  };

  const toggleGroupSelection = (key: string) => {
    setSelectedGroupKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatDepsText = (d: ProcessDependencyCounts): string => {
    if (d.total === 0) return 'Sem vínculos';
    const parts: string[] = [];
    if (d.movimentos) parts.push(`${d.movimentos} Mov`);
    if (d.tarefas) parts.push(`${d.tarefas} Tar`);
    if (d.financeiro) parts.push(`${d.financeiro} Fin`);
    if (d.documentos) parts.push(`${d.documentos} Doc`);
    if (d.eventos) parts.push(`${d.eventos} Eve`);
    if (d.recursos) parts.push(`${d.recursos} Rec`);
    if (d.envolvidos) parts.push(`${d.envolvidos} Env`);
    return parts.join(' · ');
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho e KPIs */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
              <GitMerge size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-app-text tracking-tight">
                Mesclagem Segura de Processos Duplicados
              </h2>
              <p className="text-xs text-app-text-muted mt-1 leading-relaxed max-w-2xl">
                Identifica processos com o mesmo número CNJ dentro do mesmo escritório, consolida campos vazios no registro principal (Mestre), transfere todos os dependentes e remove as cópias excedentes sem gerar órfãos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isMerging}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-app-bg hover:bg-primary/10 border border-app-border hover:border-primary/40 text-app-text rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Recarregando base...' : 'Reanalisar Base'}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-app-border">
          <div className="bg-app-bg border border-app-border rounded-xl p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-app-text-muted">
              Grupos Duplicados
            </div>
            <div className="mt-1 text-2xl font-black text-app-text tabular-nums">
              {stats.groupCount.toLocaleString('pt-BR')}
            </div>
            <div className="text-[11px] text-app-text-muted tabular-nums mt-0.5">
              {stats.extraCopies.toLocaleString('pt-BR')} cópia(s) excedente(s) no mesmo escritório
            </div>
          </div>

          <div className="bg-app-bg border border-app-border rounded-xl p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-app-text-muted">
              Com Vínculos Ativos
            </div>
            <div className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {stats.withDeps.toLocaleString('pt-BR')}
            </div>
            <div className="text-[11px] text-app-text-muted mt-0.5">
              Movimentos, tarefas, financeiro ou partes
            </div>
          </div>

          <div className="bg-app-bg border border-app-border rounded-xl p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-app-text-muted">
              Com Dados Recuperáveis
            </div>
            <div className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {stats.withEnrichments.toLocaleString('pt-BR')}
            </div>
            <div className="text-[11px] text-app-text-muted mt-0.5">
              Cópias preenchem campos vazios no Mestre
            </div>
          </div>

          <div className="bg-app-bg border border-app-border rounded-xl p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-app-text-muted">
              Entre Escritórios Distintos
            </div>
            <div className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {stats.crossOfficeCount.toLocaleString('pt-BR')}
            </div>
            <div className="text-[11px] text-app-text-muted mt-0.5">
              Separados por segurança (revisão manual)
            </div>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-red-500/10 border-red-500/25 text-red-700 dark:text-red-300'
              : 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertTriangle size={16} className="shrink-0" />
            ) : (
              <Info size={16} className="shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 opacity-70 hover:opacity-100"
            aria-label="Fechar aviso"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filtros e Ação em Lote */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar nº processo, ID, cliente, vara..."
                className="w-full pl-8 pr-3 py-2 bg-app-bg border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:border-primary"
              />
            </div>

            <select
              value={officeFilter}
              onChange={e => setOfficeFilter(e.target.value)}
              className="px-3 py-2 bg-app-bg border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:border-primary"
              aria-label="Filtrar por escritório"
            >
              <option value="all">Todos os Escritórios</option>
              {(state.escritorios || []).map(esc => (
                <option key={esc.id} value={esc.id}>
                  {esc.nome}
                </option>
              ))}
            </select>

            <select
              value={depsFilter}
              onChange={e => setDepsFilter(e.target.value as 'all' | 'with_deps' | 'no_deps')}
              className="px-3 py-2 bg-app-bg border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:border-primary"
              aria-label="Filtrar por vínculos"
            >
              <option value="all">Todos os Grupos</option>
              <option value="with_deps">Com Vínculos Ativos</option>
              <option value="no_deps">Sem Vínculos (Apenas Cadastro)</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-app-text cursor-pointer select-none whitespace-nowrap shrink-0">
            <input
              type="checkbox"
              checked={includeCrossOffice}
              onChange={e => setIncludeCrossOffice(e.target.checked)}
              className="rounded border-app-border text-primary focus:ring-primary"
            />
            <span>Incluir CNJs repetidos entre escritórios ({stats.crossOfficeCount})</span>
          </label>
        </div>

        {filteredGroups.length > 0 && (
          <div className="pt-3 border-t border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="font-bold text-app-text tabular-nums">
                {selectedGroups.length > 0
                  ? `${selectedGroups.length.toLocaleString('pt-BR')} grupo(s) selecionado(s)`
                  : `${filteredGroups.length.toLocaleString('pt-BR')} grupo(s) encontrado(s)`}
              </span>
              {sameOfficeGroups.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllSameOfficeFiltered}
                  className="font-semibold text-primary hover:underline whitespace-nowrap shrink-0"
                >
                  Selecionar todos do mesmo escritório ({filteredGroups.filter(g => !g.isCrossOffice).length})
                </button>
              )}
              {selectedGroupKeys.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedGroupKeys(new Set())}
                  className="font-semibold text-app-text-muted hover:text-app-text whitespace-nowrap shrink-0"
                >
                  Limpar seleção
                </button>
              )}
            </div>

            {selectedGroups.length > 0 && (
              <button
                type="button"
                disabled={isMerging}
                onClick={() => setConfirmGroups(selectedGroups)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <GitMerge size={14} />
                Mesclar Selecionados ({selectedGroups.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista de Grupos Duplicados ou Estado Vazio */}
      {activeGroups.length === 0 ? (
        <div className="bg-app-surface border border-app-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-base font-bold text-app-text">Nenhum processo duplicado encontrado</h3>
          <p className="text-xs text-app-text-muted mt-1 max-w-md mx-auto">
            Todos os números de processo dentro de cada escritório são únicos.
          </p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-app-surface border border-app-border rounded-2xl p-10 text-center">
          <p className="text-sm font-bold text-app-text">Nenhum grupo duplicado corresponde aos filtros atuais.</p>
          <button
            type="button"
            onClick={() => {
              setOfficeFilter('all');
              setDepsFilter('all');
              setSearchTerm('');
            }}
            className="mt-3 text-xs font-bold text-primary hover:underline"
          >
            Restaurar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {pageGroups.map(group => {
            const isSelected = selectedGroupKeys.has(group.groupKey);
            const chosenMasterId = masterOverrides[group.groupKey] || group.suggestedMasterId;
            const masterMeta = group.candidates.find(c => c.processo.id === chosenMasterId) || group.candidates[0];
            const dupMetas = group.candidates.filter(c => c.processo.id !== masterMeta.processo.id);
            const { enrichedLabels } = buildMergedMaster(
              masterMeta.processo,
              dupMetas.map(d => d.processo)
            );
            const linksToMove = dupMetas.reduce((acc, d) => acc + d.deps.total, 0);

            return (
              <div
                key={group.groupKey}
                className={`bg-app-surface border rounded-2xl overflow-hidden transition-colors ${
                  isSelected ? 'border-primary' : 'border-app-border'
                }`}
              >
                {/* Cabeçalho do Grupo */}
                <div className="px-5 py-3.5 bg-app-bg/60 border-b border-app-border flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleGroupSelection(group.groupKey)}
                      aria-label={`Selecionar grupo ${group.displayNumero}`}
                      className="mt-1 rounded border-app-border text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-black text-app-text tabular-nums">
                          {group.displayNumero}
                        </span>
                        <span className="text-xs text-app-text-muted tabular-nums">
                          · {group.candidates.length} cópias
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-app-text-muted">
                          · <Building2 size={12} /> {group.escritorioLabel}
                        </span>
                        {group.isCrossOffice && (
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            · Atenção: escritórios diferentes
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-app-text-muted">
                        {enrichedLabels.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                            <Sparkles size={12} />
                            Enriquecerá no Mestre: {enrichedLabels.slice(0, 6).join(', ')}
                            {enrichedLabels.length > 6 ? ` (+${enrichedLabels.length - 6})` : ''}
                          </span>
                        ) : (
                          <span>Sem campos adicionais vazios para preencher no Mestre</span>
                        )}
                        {linksToMove > 0 && (
                          <span className="text-primary font-semibold tabular-nums">
                            · Transferirá {linksToMove.toLocaleString('pt-BR')} vínculo(s) ao Mestre
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isMerging}
                    onClick={() => setConfirmGroups([group])}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <GitMerge size={14} />
                    Mesclar Grupo
                  </button>
                </div>

                {/* Tabela comparativa das cópias */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-app-border text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
                        <th className="py-2.5 pl-5 pr-2 w-28">Papel</th>
                        <th className="py-2.5 px-3">ID / ID Legado</th>
                        <th className="py-2.5 px-3">Cliente & Vara</th>
                        <th className="py-2.5 px-3">Escritório & Status</th>
                        <th className="py-2.5 px-3 text-right">Campos</th>
                        <th className="py-2.5 pl-3 pr-5 text-right">Vínculos Filhos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border">
                      {group.candidates.map(c => {
                        const isMaster = c.processo.id === masterMeta.processo.id;
                        return (
                          <tr
                            key={c.processo.id}
                            onClick={() => setMasterOverrides(prev => ({ ...prev, [group.groupKey]: c.processo.id }))}
                            className={`cursor-pointer transition-colors ${
                              isMaster ? 'bg-primary/5' : 'hover:bg-app-bg/40'
                            }`}
                          >
                            <td className="py-2.5 pl-5 pr-2 whitespace-nowrap">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`master_${group.groupKey}`}
                                  checked={isMaster}
                                  onChange={() =>
                                    setMasterOverrides(prev => ({ ...prev, [group.groupKey]: c.processo.id }))
                                  }
                                  className="text-primary focus:ring-primary"
                                />
                                <span className={`font-bold ${isMaster ? 'text-primary' : 'text-app-text-muted'}`}>
                                  {isMaster ? 'Mestre' : 'Cópia'}
                                </span>
                              </label>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-mono font-bold text-app-text">{c.processo.id}</div>
                              {c.processo.idProc && c.processo.idProc !== c.processo.id && (
                                <div className="font-mono text-[11px] text-app-text-muted">
                                  id_proc: {c.processo.idProc}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 max-w-xs">
                              <div className="font-medium text-app-text truncate">{c.clienteNome}</div>
                              <div className="text-[11px] text-app-text-muted truncate">{c.varaNome}</div>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="text-app-text">{c.escritorioNome}</div>
                              <div className={`text-[11px] font-semibold ${c.processo.status === 'Ativo' ? 'text-emerald-600 dark:text-emerald-400' : 'text-app-text-muted'}`}>
                                {c.processo.status}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-app-text">
                              {c.filledFields} preenchido(s)
                            </td>

                            <td className="py-2.5 pl-3 pr-5 text-right tabular-nums whitespace-nowrap">
                              <span className={c.deps.total > 0 ? 'font-bold text-app-text' : 'text-app-text-muted'}>
                                {formatDepsText(c.deps)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="bg-app-surface border border-app-border rounded-2xl px-4 py-3 flex items-center justify-between text-xs">
              <span className="text-app-text-muted tabular-nums">
                Página <strong className="text-app-text">{safePage}</strong> de <strong className="text-app-text">{totalPages}</strong> ·{' '}
                {filteredGroups.length.toLocaleString('pt-BR')} grupo(s)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-app-bg border border-app-border rounded-lg text-xs font-semibold text-app-text hover:border-primary/40 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <ChevronLeft size={14} />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-app-bg border border-app-border rounded-lg text-xs font-semibold text-app-text hover:border-primary/40 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  Próxima
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Confirmação de Mesclagem */}
      {confirmGroups && confirmGroups.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                <GitMerge size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-app-text">
                  Confirmar mesclagem de processos
                </h3>
                <p className="text-xs text-app-text-muted mt-1 leading-relaxed">
                  {confirmGroups.length === 1 ? (
                    <>
                      O processo <strong className="font-mono text-app-text">{confirmGroups[0].displayNumero}</strong> terá{' '}
                      <strong className="text-app-text tabular-nums">{confirmGroups[0].candidates.length - 1}</strong> cópia(s) consolidada(s) no Mestre{' '}
                      <strong className="font-mono text-app-text">
                        {masterOverrides[confirmGroups[0].groupKey] || confirmGroups[0].suggestedMasterId}
                      </strong>.
                    </>
                  ) : (
                    <>
                      Serão consolidados{' '}
                      <strong className="text-app-text tabular-nums">{confirmGroups.length.toLocaleString('pt-BR')}</strong> grupos, removendo{' '}
                      <strong className="text-app-text tabular-nums">
                        {confirmGroups.reduce((acc, g) => acc + g.candidates.length - 1, 0).toLocaleString('pt-BR')}
                      </strong>{' '}
                      cópia(s) excedente(s) após enriquecer campos vazios e transferir todos os vínculos.
                    </>
                  )}
                </p>
                {confirmGroups.some(g => g.isCrossOffice) && (
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-2">
                    Atenção: há grupo(s) envolvendo escritórios diferentes nesta seleção.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-app-border">
              <button
                type="button"
                disabled={isMerging}
                onClick={() => setConfirmGroups(null)}
                className="px-4 py-2 bg-app-bg border border-app-border text-app-text rounded-xl text-xs font-bold hover:border-app-text-muted whitespace-nowrap shrink-0"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isMerging}
                onClick={() => executeMerge(confirmGroups)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {isMerging && <Loader2 size={13} className="animate-spin" />}
                Confirmar Mesclagem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
