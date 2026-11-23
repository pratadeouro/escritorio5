import React, { useMemo, useState, useEffect } from 'react';
import {
  Unlink,
  Search,
  RefreshCw,
  Trash2,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Briefcase,
  UserX,
  ShieldCheck,
  X
} from 'lucide-react';
import { useAppContext, OrphanBatchMode, OrphanBatchTarget } from '../context';

type OrphanKind = 'processo' | 'usuario';
type OrphanModule = OrphanBatchTarget['module'];
type OrphanField = OrphanBatchTarget['field'];

interface OrphanRecordItem {
  key: string;
  module: OrphanModule;
  moduleLabel: string;
  field: OrphanField;
  fieldLabel: string;
  recordId: string;
  orphanKind: OrphanKind;
  missingId: string;
  canUnlink: boolean;
  canDeleteRecord: boolean;
  title: string;
  subtitle?: string;
  dateLabel?: string;
  amountLabel?: string;
  escritorioId?: string;
  escritorioNome: string;
}

const MODULE_LABELS: Record<OrphanModule, string> = {
  tarefas: 'Tarefas',
  eventos: 'Eventos / Agenda',
  movimentos: 'Movimentos',
  financeiro: 'Financeiro',
  documentos: 'Documentos',
  recursos: 'Recursos',
  envolvidos: 'Envolvidos',
  processos: 'Processos',
};

const PAGE_SIZE = 25;

const formatShortDate = (raw?: string): string => {
  if (!raw) return '—';
  const clean = String(raw).trim();
  if (!clean) return '—';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(clean)) return clean.slice(0, 10);
  const parsed = new Date(clean);
  if (isNaN(parsed.getTime())) return clean.slice(0, 10);
  return parsed.toLocaleDateString('pt-BR');
};

const formatBRL = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

export const OrphanRecordsTab: React.FC = () => {
  const { state, forceLoad, applyOrphanCleanupBatch } = useAppContext();

  // Filtros e estado da interface
  const [kindFilter, setKindFilter] = useState<'all' | OrphanKind>('all');
  const [moduleFilter, setModuleFilter] = useState<'all' | OrphanModule>('all');
  const [officeFilter, setOfficeFilter] = useState<string>('all');
  const [missingIdFilter, setMissingIdFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showBestPractices, setShowBestPractices] = useState(true);

  // Seleção e ações
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [rowTargets, setRowTargets] = useState<Record<string, string>>({});
  const [batchTargetId, setBatchTargetId] = useState('');
  const [batchTargetSearch, setBatchTargetSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Modal de confirmação in-app (sem window.confirm/window.alert)
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    mode: OrphanBatchMode;
    items: OrphanRecordItem[];
    targetId?: string;
    targetLabel?: string;
  } | null>(null);

  // Mapas de lookup para escritórios, processos e usuários válidos
  const escritorioMap = useMemo(() => {
    const map = new Map<string, string>();
    (state.escritorios || []).forEach(e => {
      if (e.id) map.set(String(e.id).trim().toUpperCase(), e.nome || e.id);
    });
    return map;
  }, [state.escritorios]);

  const getOfficeName = (escId?: string): string => {
    const clean = String(escId || '').trim().toUpperCase();
    if (!clean) return 'Sem escritório';
    return escritorioMap.get(clean) || clean;
  };

  const validProcessKeys = useMemo(() => {
    const set = new Set<string>();
    (state.processos || []).forEach(p => {
      if (p.id) set.add(String(p.id).trim().toUpperCase());
      if (p.idProc) set.add(String(p.idProc).trim().toUpperCase());
    });
    return set;
  }, [state.processos]);

  const validUserKeys = useMemo(() => {
    const set = new Set<string>();
    (state.usuarios || []).forEach(u => {
      if (u.id) set.add(String(u.id).trim().toLowerCase());
    });
    return set;
  }, [state.usuarios]);

  const contatoMap = useMemo(() => {
    const map = new Map<string, string>();
    (state.contatos || []).forEach(c => {
      if (c.id) map.set(String(c.id).trim().toUpperCase(), c.nome || c.id);
    });
    return map;
  }, [state.contatos]);

  // Varredura determinística de todos os vínculos órfãos na base carregada
  const allOrphans = useMemo<OrphanRecordItem[]>(() => {
    const items: OrphanRecordItem[] = [];

    const hasValidProcess = (rawId?: string) => {
      const clean = String(rawId || '').trim().toUpperCase();
      if (!clean) return true;
      return validProcessKeys.has(clean);
    };

    const hasValidUser = (rawId?: string) => {
      const clean = String(rawId || '').trim().toLowerCase();
      if (!clean) return true;
      return validUserKeys.has(clean);
    };

    // 1. Tarefas (PROCESSO_ID/ID_PROC, RESPONSAVEL_ID/ID_USER, ATRIBUIDO_ID)
    (state.tarefas || []).forEach(t => {
      const recordId = String(t.ID_TAREFA || t.id || '').trim();
      if (!recordId) return;
      const title = String(t.TITULO || t.TAREFA || 'Tarefa sem título').trim();
      const escId = String(t.ID_ESCRITORIO || '').trim();
      const procRef = String(t.PROCESSO_ID || t.ID_PROC || '').trim();
      const respRef = String(t.RESPONSAVEL_ID || t.ID_USER || '').trim();
      const atribRef = String(t.ATRIBUIDO_ID || '').trim();

      if (procRef && !hasValidProcess(procRef)) {
        items.push({
          key: `tarefas:processoId:${recordId}`,
          module: 'tarefas',
          moduleLabel: MODULE_LABELS.tarefas,
          field: 'processoId',
          fieldLabel: 'Processo vinculado',
          recordId,
          orphanKind: 'processo',
          missingId: procRef,
          canUnlink: true,
          canDeleteRecord: true,
          title,
          subtitle: t.PROC_NOME ? `Ref. antiga: ${t.PROC_NOME}` : `Status: ${t.STATUS || 'Pendente'}`,
          dateLabel: formatShortDate(t.DATA_LIMITE || t.DATA_CRIACAO),
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }

      if (respRef && !hasValidUser(respRef)) {
        items.push({
          key: `tarefas:responsavelId:${recordId}`,
          module: 'tarefas',
          moduleLabel: MODULE_LABELS.tarefas,
          field: 'responsavelId',
          fieldLabel: 'Responsável',
          recordId,
          orphanKind: 'usuario',
          missingId: respRef,
          canUnlink: true,
          canDeleteRecord: true,
          title,
          subtitle: `Status: ${t.STATUS || 'Pendente'}`,
          dateLabel: formatShortDate(t.DATA_LIMITE || t.DATA_CRIACAO),
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }

      if (atribRef && !hasValidUser(atribRef)) {
        items.push({
          key: `tarefas:atribuidoId:${recordId}`,
          module: 'tarefas',
          moduleLabel: MODULE_LABELS.tarefas,
          field: 'atribuidoId',
          fieldLabel: 'Atribuído por',
          recordId,
          orphanKind: 'usuario',
          missingId: atribRef,
          canUnlink: true,
          canDeleteRecord: true,
          title,
          subtitle: `Status: ${t.STATUS || 'Pendente'}`,
          dateLabel: formatShortDate(t.DATA_LIMITE || t.DATA_CRIACAO),
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }
    });

    // 2. Eventos / Agenda (processoId, usuarioId)
    (state.eventos || []).forEach(e => {
      if (!e.id) return;
      const procRef = String(e.processoId || '').trim();
      const userRef = String(e.usuarioId || '').trim();
      const escId = String(e.escritorioId || '').trim();

      if (procRef && !hasValidProcess(procRef)) {
        items.push({
          key: `eventos:processoId:${e.id}`,
          module: 'eventos',
          moduleLabel: MODULE_LABELS.eventos,
          field: 'processoId',
          fieldLabel: 'Processo vinculado',
          recordId: e.id,
          orphanKind: 'processo',
          missingId: procRef,
          canUnlink: true,
          canDeleteRecord: true,
          title: e.titulo || 'Evento sem título',
          subtitle: `Tipo: ${e.tipo || 'Prazo'}`,
          dateLabel: formatShortDate(e.data),
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }

      if (userRef && !hasValidUser(userRef)) {
        items.push({
          key: `eventos:usuarioId:${e.id}`,
          module: 'eventos',
          moduleLabel: MODULE_LABELS.eventos,
          field: 'usuarioId',
          fieldLabel: 'Usuário responsável',
          recordId: e.id,
          orphanKind: 'usuario',
          missingId: userRef,
          canUnlink: true,
          canDeleteRecord: true,
          title: e.titulo || 'Evento sem título',
          subtitle: `Tipo: ${e.tipo || 'Prazo'}`,
          dateLabel: formatShortDate(e.data),
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }
    });

    // 3. Movimentos (processoId obrigatório, usuarioId opcional)
    (state.movimentos || []).forEach(m => {
      if (!m.id) return;
      const procRef = String(m.processoId || '').trim();
      const userRef = String(m.usuarioId || '').trim();
      const escId = String(m.escritorioId || '').trim();
      const desc = String(m.descricao || 'Movimentação processual').trim();
      const shortDesc = desc.length > 110 ? `${desc.slice(0, 110)}…` : desc;

      if (procRef && !hasValidProcess(procRef)) {
        items.push({
          key: `movimentos:processoId:${m.id}`,
          module: 'movimentos',
          moduleLabel: MODULE_LABELS.movimentos,
          field: 'processoId',
          fieldLabel: 'Processo (obrigatório)',
          recordId: m.id,
          orphanKind: 'processo',
          missingId: procRef,
          canUnlink: false,
          canDeleteRecord: true,
          title: shortDesc,
          subtitle: m.pagina ? `Página/Obs: ${m.pagina}` : 'Movimentação sem processo ativo',
          dateLabel: formatShortDate(m.data),
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }

      if (userRef && !hasValidUser(userRef)) {
        items.push({
          key: `movimentos:usuarioId:${m.id}`,
          module: 'movimentos',
          moduleLabel: MODULE_LABELS.movimentos,
          field: 'usuarioId',
          fieldLabel: 'Usuário autor',
          recordId: m.id,
          orphanKind: 'usuario',
          missingId: userRef,
          canUnlink: true,
          canDeleteRecord: true,
          title: shortDesc,
          subtitle: hasValidProcess(procRef) ? `Processo: ${procRef}` : 'Processo também ausente',
          dateLabel: formatShortDate(m.data),
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }
    });

    // 4. Financeiro (processoId opcional, usuarioId opcional)
    (state.financeiro || []).forEach(f => {
      if (!f.id) return;
      const procRef = String(f.processoId || '').trim();
      const userRef = String(f.usuarioId || '').trim();
      const escId = String(f.escritorioId || '').trim();
      const amountLabel = `${f.tipo === 'Receita' ? '+' : '-'} ${formatBRL(Number(f.valor) || 0)}`;

      if (procRef && !hasValidProcess(procRef)) {
        items.push({
          key: `financeiro:processoId:${f.id}`,
          module: 'financeiro',
          moduleLabel: MODULE_LABELS.financeiro,
          field: 'processoId',
          fieldLabel: 'Processo vinculado',
          recordId: f.id,
          orphanKind: 'processo',
          missingId: procRef,
          canUnlink: true,
          canDeleteRecord: true,
          title: f.descricao || 'Lançamento financeiro',
          subtitle: `${f.tipo} · ${f.status || (f.pago ? 'Pago' : 'Pendente')}`,
          dateLabel: formatShortDate(f.data),
          amountLabel,
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }

      if (userRef && !hasValidUser(userRef)) {
        items.push({
          key: `financeiro:usuarioId:${f.id}`,
          module: 'financeiro',
          moduleLabel: MODULE_LABELS.financeiro,
          field: 'usuarioId',
          fieldLabel: 'Usuário criador',
          recordId: f.id,
          orphanKind: 'usuario',
          missingId: userRef,
          canUnlink: true,
          canDeleteRecord: true,
          title: f.descricao || 'Lançamento financeiro',
          subtitle: `${f.tipo} · ${f.status || (f.pago ? 'Pago' : 'Pendente')}`,
          dateLabel: formatShortDate(f.data),
          amountLabel,
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }
    });

    // 5. Documentos (processoId opcional)
    (state.documentos || []).forEach(d => {
      if (!d.id) return;
      const procRef = String(d.processoId || '').trim();
      const escId = String(d.escritorioId || '').trim();

      if (procRef && !hasValidProcess(procRef)) {
        items.push({
          key: `documentos:processoId:${d.id}`,
          module: 'documentos',
          moduleLabel: MODULE_LABELS.documentos,
          field: 'processoId',
          fieldLabel: 'Processo vinculado',
          recordId: d.id,
          orphanKind: 'processo',
          missingId: procRef,
          canUnlink: true,
          canDeleteRecord: true,
          title: d.titulo || 'Documento sem título',
          subtitle: `Tipo: ${d.tipo || 'Outro'}`,
          dateLabel: formatShortDate(d.dataCriacao),
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }
    });

    // 6. Recursos (processoOriginarioId obrigatório)
    (state.recursos || []).forEach(r => {
      if (!r.id) return;
      const procRef = String(r.processoOriginarioId || '').trim();
      const escId = String(r.escritorioId || '').trim();

      if (procRef && !hasValidProcess(procRef)) {
        items.push({
          key: `recursos:processoOriginarioId:${r.id}`,
          module: 'recursos',
          moduleLabel: MODULE_LABELS.recursos,
          field: 'processoOriginarioId',
          fieldLabel: 'Processo originário (obrigatório)',
          recordId: r.id,
          orphanKind: 'processo',
          missingId: procRef,
          canUnlink: false,
          canDeleteRecord: true,
          title: `${r.classe || 'Recurso'}${r.assunto ? ` — ${r.assunto}` : ''}`,
          subtitle: r.secao || `Status: ${r.status || 'Ativo'}`,
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }
    });

    // 7. Envolvidos (processoId quando preenchido)
    (state.envolvidos || []).forEach(ev => {
      if (!ev.id) return;
      const procRef = String(ev.processoId || '').trim();
      const escId = String(ev.escritorioId || '').trim();

      if (procRef && !hasValidProcess(procRef)) {
        const contactName = contatoMap.get(String(ev.contatoId || '').trim().toUpperCase()) || ev.contatoId || 'Contato';
        items.push({
          key: `envolvidos:processoId:${ev.id}`,
          module: 'envolvidos',
          moduleLabel: MODULE_LABELS.envolvidos,
          field: 'processoId',
          fieldLabel: 'Processo vinculado (obrigatório)',
          recordId: ev.id,
          orphanKind: 'processo',
          missingId: procRef,
          canUnlink: false,
          canDeleteRecord: true,
          title: `${contactName}${ev.tipoEnvolvimento ? ` (${ev.tipoEnvolvimento})` : ''}`,
          subtitle: 'Vínculo de parte/envolvido com processo removido',
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }
    });

    // 8. Processos com advogadoId apontando para usuário apagado (nunca apagar o processo daqui, apenas reatribuir/desvincular o advogado)
    (state.processos || []).forEach(p => {
      if (!p.id) return;
      const advRef = String(p.advogadoId || '').trim();
      const escId = String(p.escritorioId || '').trim();
      if (advRef && !hasValidUser(advRef)) {
        items.push({
          key: `processos:advogadoId:${p.id}`,
          module: 'processos',
          moduleLabel: MODULE_LABELS.processos,
          field: 'advogadoId',
          fieldLabel: 'Advogado responsável',
          recordId: p.id,
          orphanKind: 'usuario',
          missingId: advRef,
          canUnlink: true,
          canDeleteRecord: false,
          title: p.numero || p.titulo || p.id,
          subtitle: p.parteContraria ? `Parte contrária: ${p.parteContraria}` : 'Processo ativo com usuário responsável removido',
          dateLabel: formatShortDate(p.dataDistribuicao),
          escritorioId: escId || undefined,
          escritorioNome: getOfficeName(escId),
        });
      }
    });

    return items;
  }, [
    state.tarefas,
    state.eventos,
    state.movimentos,
    state.financeiro,
    state.documentos,
    state.recursos,
    state.envolvidos,
    state.processos,
    validProcessKeys,
    validUserKeys,
    escritorioMap,
    contatoMap,
  ]);

  // Estatísticas globais dos órfãos
  const stats = useMemo(() => {
    const procCount = allOrphans.filter(i => i.orphanKind === 'processo').length;
    const userCount = allOrphans.filter(i => i.orphanKind === 'usuario').length;
    const unlinkableCount = allOrphans.filter(i => i.canUnlink).length;
    const uniqueRecords = new Set(allOrphans.map(i => `${i.module}:${i.recordId}`)).size;

    const topMissingMap = new Map<string, { missingId: string; orphanKind: OrphanKind; count: number }>();
    allOrphans.forEach(item => {
      const k = `${item.orphanKind}:${item.missingId.toUpperCase()}`;
      const curr = topMissingMap.get(k) || { missingId: item.missingId, orphanKind: item.orphanKind, count: 0 };
      curr.count += 1;
      topMissingMap.set(k, curr);
    });
    const topMissingIds = Array.from(topMissingMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      total: allOrphans.length,
      uniqueRecords,
      procCount,
      userCount,
      unlinkableCount,
      topMissingIds,
    };
  }, [allOrphans]);

  // Lista filtrada
  const filteredOrphans = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allOrphans.filter(item => {
      if (kindFilter !== 'all' && item.orphanKind !== kindFilter) return false;
      if (moduleFilter !== 'all' && item.module !== moduleFilter) return false;
      if (officeFilter !== 'all' && (item.escritorioId || '').toUpperCase() !== officeFilter.toUpperCase()) return false;
      if (missingIdFilter && item.missingId.toUpperCase() !== missingIdFilter.toUpperCase()) return false;
      if (q) {
        const hay = `${item.title} ${item.subtitle || ''} ${item.missingId} ${item.recordId} ${item.moduleLabel} ${item.escritorioNome}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allOrphans, kindFilter, moduleFilter, officeFilter, missingIdFilter, searchTerm]);

  // Reset página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [kindFilter, moduleFilter, officeFilter, missingIdFilter, searchTerm]);

  // Limpa seleções que não existem mais após atualização
  useEffect(() => {
    const validKeys = new Set(allOrphans.map(o => o.key));
    setSelectedKeys(prev => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach(k => {
        if (validKeys.has(k)) next.add(k);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [allOrphans]);

  const totalPages = Math.max(1, Math.ceil(filteredOrphans.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredOrphans.slice(start, start + PAGE_SIZE);
  }, [filteredOrphans, safePage]);

  const selectedItems = useMemo(
    () => allOrphans.filter(i => selectedKeys.has(i.key)),
    [allOrphans, selectedKeys]
  );

  // Analisa compatibilidade dos itens selecionados para ações em lote
  const selectionMeta = useMemo(() => {
    const kinds = new Set(selectedItems.map(i => i.orphanKind));
    const singleKind: OrphanKind | null = kinds.size === 1 ? Array.from(kinds)[0] : null;
    const unlinkable = selectedItems.filter(i => i.canUnlink);
    const deletable = selectedItems.filter(i => i.canDeleteRecord);
    const officeIds = new Set(selectedItems.map(i => (i.escritorioId || '').toUpperCase()).filter(Boolean));
    const commonOfficeId = officeIds.size === 1 ? Array.from(officeIds)[0] : undefined;
    return {
      count: selectedItems.length,
      singleKind,
      unlinkableCount: unlinkable.length,
      deletableCount: deletable.length,
      commonOfficeId,
    };
  }, [selectedItems]);

  // Opções ordenadas para destino (Processos ou Usuários)
  const getProcessOptions = (preferOfficeId?: string, textFilter = '') => {
    const q = textFilter.trim().toLowerCase();
    const list = (state.processos || []).filter(p => {
      if (!q) return true;
      const clientName = contatoMap.get(String(p.clienteId || '').trim().toUpperCase()) || '';
      const hay = `${p.numero || ''} ${p.titulo || ''} ${p.id || ''} ${clientName} ${p.parteContraria || ''}`.toLowerCase();
      return hay.includes(q);
    });

    const pref = (preferOfficeId || '').toUpperCase();
    return [...list].sort((a, b) => {
      if (pref) {
        const aMatch = (a.escritorioId || '').toUpperCase() === pref ? 0 : 1;
        const bMatch = (b.escritorioId || '').toUpperCase() === pref ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return (a.numero || a.id).localeCompare(b.numero || b.id);
    });
  };

  const getUserOptions = (preferOfficeId?: string, textFilter = '') => {
    const q = textFilter.trim().toLowerCase();
    const list = (state.usuarios || []).filter(u => {
      if (!q) return true;
      const hay = `${u.nome || ''} ${u.email || ''} ${u.cargo || ''}`.toLowerCase();
      return hay.includes(q);
    });

    const pref = (preferOfficeId || '').toUpperCase();
    return [...list].sort((a, b) => {
      if (pref) {
        const aMatch = (a.escritoriosIds || []).some(e => e.toUpperCase() === pref) ? 0 : 1;
        const bMatch = (b.escritoriosIds || []).some(e => e.toUpperCase() === pref) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return (a.nome || a.email).localeCompare(b.nome || b.email);
    });
  };

  const batchProcessOptions = useMemo(() => {
    if (selectionMeta.singleKind !== 'processo') return [];
    return getProcessOptions(selectionMeta.commonOfficeId, batchTargetSearch).slice(0, 200);
  }, [state.processos, selectionMeta.singleKind, selectionMeta.commonOfficeId, batchTargetSearch, contatoMap]);

  const batchUserOptions = useMemo(() => {
    if (selectionMeta.singleKind !== 'usuario') return [];
    return getUserOptions(selectionMeta.commonOfficeId, batchTargetSearch);
  }, [state.usuarios, selectionMeta.singleKind, selectionMeta.commonOfficeId, batchTargetSearch]);

  const formatTargetLabel = (kind: OrphanKind, targetId?: string): string => {
    if (!targetId) return '';
    if (kind === 'processo') {
      const p = state.processos.find(x => x.id === targetId || x.idProc === targetId);
      return p ? `${p.numero || p.id}${p.titulo ? ` (${p.titulo})` : ''}` : targetId;
    }
    const u = state.usuarios.find(x => x.id === targetId);
    return u ? `${u.nome} (${u.email})` : targetId;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setFeedback(null);
    try {
      await forceLoad();
      setFeedback({ type: 'info', message: 'Base recarregada e análise de registros órfãos atualizada.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Não foi possível recarregar os dados.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const executeCleanup = async (
    items: OrphanRecordItem[],
    mode: OrphanBatchMode,
    targetId?: string
  ) => {
    if (items.length === 0) return;
    setIsProcessing(true);
    setFeedback(null);
    try {
      const eligible =
        mode === 'unlink'
          ? items.filter(i => i.canUnlink)
          : mode === 'delete'
          ? items.filter(i => i.canDeleteRecord)
          : items;

      const targets: OrphanBatchTarget[] = eligible.map(i => ({
        module: i.module,
        recordId: i.recordId,
        field: i.field,
      }));

      const res = await applyOrphanCleanupBatch(targets, mode, targetId);

      setSelectedKeys(prev => {
        const next = new Set(prev);
        eligible.forEach(i => next.delete(i.key));
        return next;
      });
      if (mode === 'assign' && items.length > 1) {
        setBatchTargetId('');
      }

      const verb =
        mode === 'delete'
          ? 'excluído(s)'
          : mode === 'unlink'
          ? 'desvinculado(s) com segurança'
          : 'reatribuído(s)';

      if (res.errorCount > 0 && res.successCount === 0) {
        setFeedback({
          type: 'error',
          message: `Falha ao processar os ${res.errorCount} registro(s). Verifique sua conexão e tente novamente.`,
        });
      } else if (res.errorCount > 0) {
        setFeedback({
          type: 'info',
          message: `${res.successCount} vínculo(s) ${verb}; ${res.errorCount} não puderam ser processados.`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: `${res.successCount} vínculo(s) ${verb} com sucesso.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro inesperado durante a higienização dos registros.',
      });
    } finally {
      setIsProcessing(false);
      setConfirmState(null);
    }
  };

  const requestAction = (items: OrphanRecordItem[], mode: OrphanBatchMode, targetId?: string) => {
    if (items.length === 0) return;
    if (mode === 'assign' && !targetId) {
      setFeedback({ type: 'error', message: 'Selecione o processo ou usuário de destino antes de atribuir.' });
      return;
    }

    // Sempre pede confirmação in-app ao apagar, ou em lotes acima de 15 registros
    if (mode === 'delete' || items.length > 15) {
      const sampleKind = items[0].orphanKind;
      setConfirmState({
        open: true,
        mode,
        items,
        targetId,
        targetLabel: mode === 'assign' && targetId ? formatTargetLabel(sampleKind, targetId) : undefined,
      });
      return;
    }

    void executeCleanup(items, mode, targetId);
  };

  const toggleSelectItem = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allPageSelected = pageItems.length > 0 && pageItems.every(i => selectedKeys.has(i.key));
  const toggleSelectPage = () => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageItems.forEach(i => next.delete(i.key));
      } else {
        pageItems.forEach(i => next.add(i.key));
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedKeys(new Set(filteredOrphans.map(i => i.key)));
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Ação de Varredura */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
              <Unlink size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-app-text tracking-tight">
                Saneamento de Registros Órfãos
              </h2>
              <p className="text-xs text-app-text-muted mt-1 leading-relaxed max-w-2xl">
                Localiza tarefas, movimentações, eventos, lançamentos financeiros, documentos, recursos e envolvidos que ainda apontam para processos ou usuários excluídos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isProcessing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-app-bg hover:bg-primary/10 border border-app-border hover:border-primary/40 text-app-text rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Recarregando base...' : 'Reanalisar Base'}
          </button>
        </div>

        {/* Cartões de Resumo (KPIs) — Tabular Nums, single elevation */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-app-border">
          <div className="bg-app-bg border border-app-border rounded-xl p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-app-text-muted">
              Vínculos Órfãos
            </div>
            <div className="mt-1 text-2xl font-black text-app-text tabular-nums">
              {stats.total.toLocaleString('pt-BR')}
            </div>
            <div className="text-[11px] text-app-text-muted tabular-nums mt-0.5">
              Em {stats.uniqueRecords.toLocaleString('pt-BR')} registro(s) único(s)
            </div>
          </div>

          <div className="bg-app-bg border border-app-border rounded-xl p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-app-text-muted">
              Processo Apagado
            </div>
            <div className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {stats.procCount.toLocaleString('pt-BR')}
            </div>
            <div className="text-[11px] text-app-text-muted mt-0.5">
              Movimentos, tarefas, recursos e anexos
            </div>
          </div>

          <div className="bg-app-bg border border-app-border rounded-xl p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-app-text-muted">
              Usuário Apagado
            </div>
            <div className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {stats.userCount.toLocaleString('pt-BR')}
            </div>
            <div className="text-[11px] text-app-text-muted mt-0.5">
              Responsáveis, autores e advogados
            </div>
          </div>

          <div className="bg-app-bg border border-app-border rounded-xl p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-app-text-muted">
              Preserváveis (Desvínculo)
            </div>
            <div className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {stats.unlinkableCount.toLocaleString('pt-BR')}
            </div>
            <div className="text-[11px] text-app-text-muted mt-0.5">
              Podem virar avulsos sem apagar dados
            </div>
          </div>
        </div>
      </div>

      {/* Sugestão de Melhor Estratégia / Arquitetura */}
      <div className="bg-app-surface border border-app-border rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBestPractices(v => !v)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-app-bg/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={17} className="text-primary shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-app-text">
              Sugestão de Estratégia Segura — Quando Reatribuir, Desvincular ou Apagar
            </span>
          </div>
          {showBestPractices ? <ChevronUp size={16} className="text-app-text-muted" /> : <ChevronDown size={16} className="text-app-text-muted" />}
        </button>

        {showBestPractices && (
          <div className="px-5 pb-4 pt-1 border-t border-app-border grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1 pt-2">
              <div className="font-bold text-emerald-600 dark:text-emerald-400">
                1. Desvincular (Recomendado p/ opcionais)
              </div>
              <p className="text-app-text-muted leading-relaxed">
                Em <strong>Financeiro</strong>, <strong>Documentos</strong>, <strong>Eventos</strong> e <strong>Tarefas</strong>, o vínculo é opcional. Desvincular limpa apenas a referência quebrada (<code className="font-mono">NULL</code>) e preserva o histórico contábil e documental como avulso, sem apagar registros úteis.
              </p>
            </div>
            <div className="space-y-1 pt-2">
              <div className="font-bold text-primary">
                2. Reatribuir em Lote (Transferência)
              </div>
              <p className="text-app-text-muted leading-relaxed">
                Quando um usuário saiu do escritório (ex.: ID legado <code className="font-mono">3</code>) ou o processo foi recadastrado com novo ID, filtre pelo ID ausente abaixo e transfira todos os vínculos de uma só vez para o usuário ou processo ativo correspondente.
              </p>
            </div>
            <div className="space-y-1 pt-2">
              <div className="font-bold text-red-600 dark:text-red-400">
                3. Apagar (Somente descartáveis)
              </div>
              <p className="text-app-text-muted leading-relaxed">
                Indicada para <strong>Movimentos</strong>, <strong>Recursos</strong> ou <strong>Envolvidos</strong> cujo processo original foi excluído definitivamente e não possui substituto ativo — pois esses itens dependem obrigatoriamente de um processo.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Feedback de Execução */}
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

      {/* Principais IDs Ausentes (Atalho de Filtragem Rápida) */}
      {stats.topMissingIds.length > 0 && (
        <div className="bg-app-surface border border-app-border rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
              IDs Apagados com Mais Vínculos (clique para filtrar e tratar em lote)
            </span>
            {missingIdFilter && (
              <button
                type="button"
                onClick={() => setMissingIdFilter('')}
                className="text-[11px] font-bold text-primary hover:underline whitespace-nowrap shrink-0"
              >
                Limpar filtro de ID
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.topMissingIds.map(entry => {
              const active = missingIdFilter.toUpperCase() === entry.missingId.toUpperCase();
              return (
                <button
                  key={`${entry.orphanKind}:${entry.missingId}`}
                  type="button"
                  onClick={() => {
                    if (active) {
                      setMissingIdFilter('');
                    } else {
                      setMissingIdFilter(entry.missingId);
                      setKindFilter(entry.orphanKind);
                    }
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-primary text-white border-primary'
                      : 'bg-app-bg border-app-border text-app-text hover:border-primary/50'
                  }`}
                >
                  {entry.orphanKind === 'processo' ? <Briefcase size={12} /> : <UserX size={12} />}
                  <span className="font-mono font-bold">{entry.missingId}</span>
                  <span className={`tabular-nums text-[11px] ${active ? 'text-white/85' : 'text-app-text-muted'}`}>
                    · {entry.count.toLocaleString('pt-BR')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Segmentação por Tipo de Origem */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setKindFilter('all')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                kindFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-app-bg text-app-text-muted hover:text-app-text border border-app-border'
              }`}
            >
              Todos ({stats.total.toLocaleString('pt-BR')})
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('processo')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                kindFilter === 'processo'
                  ? 'bg-primary text-white'
                  : 'bg-app-bg text-app-text-muted hover:text-app-text border border-app-border'
              }`}
            >
              Processo Apagado ({stats.procCount.toLocaleString('pt-BR')})
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('usuario')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                kindFilter === 'usuario'
                  ? 'bg-primary text-white'
                  : 'bg-app-bg text-app-text-muted hover:text-app-text border border-app-border'
              }`}
            >
              Usuário Apagado ({stats.userCount.toLocaleString('pt-BR')})
            </button>
          </div>

          {/* Busca e Seletores Secundários */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[210px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar título, ID ausente, escritório..."
                className="w-full pl-8 pr-3 py-2 bg-app-bg border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:border-primary"
              />
            </div>

            <select
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value as 'all' | OrphanModule)}
              className="px-3 py-2 bg-app-bg border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:border-primary"
              aria-label="Filtrar por módulo"
            >
              <option value="all">Todos os Módulos</option>
              {(Object.keys(MODULE_LABELS) as OrphanModule[]).map(mod => (
                <option key={mod} value={mod}>
                  {MODULE_LABELS[mod]}
                </option>
              ))}
            </select>

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
          </div>
        </div>

        {/* Barra de Seleção & Ações em Lote */}
        {filteredOrphans.length > 0 && (
          <div className="pt-3 border-t border-app-border flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="font-bold text-app-text tabular-nums">
                {selectedKeys.size > 0
                  ? `${selectedKeys.size.toLocaleString('pt-BR')} selecionado(s)`
                  : `${filteredOrphans.length.toLocaleString('pt-BR')} encontrado(s) no filtro`}
              </span>
              {selectedKeys.size < filteredOrphans.length && (
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="font-semibold text-primary hover:underline whitespace-nowrap shrink-0"
                >
                  Selecionar todos os {filteredOrphans.length.toLocaleString('pt-BR')} filtrados
                </button>
              )}
              {selectedKeys.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="font-semibold text-app-text-muted hover:text-app-text whitespace-nowrap shrink-0"
                >
                  Limpar seleção
                </button>
              )}
            </div>

            {selectionMeta.count > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {selectionMeta.singleKind ? (
                  <>
                    {selectionMeta.singleKind === 'processo' && (
                      <input
                        type="text"
                        value={batchTargetSearch}
                        onChange={e => setBatchTargetSearch(e.target.value)}
                        placeholder="Filtrar processo destino..."
                        className="px-2.5 py-1.5 bg-app-bg border border-app-border rounded-lg text-xs text-app-text w-44 focus:outline-none focus:border-primary"
                      />
                    )}
                    <select
                      value={batchTargetId}
                      onChange={e => setBatchTargetId(e.target.value)}
                      className="px-2.5 py-1.5 bg-app-bg border border-app-border rounded-lg text-xs text-app-text max-w-[260px] focus:outline-none focus:border-primary"
                      aria-label="Selecionar destino para atribuição em lote"
                    >
                      <option value="">
                        {selectionMeta.singleKind === 'processo'
                          ? 'Escolher processo de destino...'
                          : 'Escolher usuário de destino...'}
                      </option>
                      {selectionMeta.singleKind === 'processo'
                        ? batchProcessOptions.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.numero || p.id} {p.titulo ? `— ${p.titulo.slice(0, 35)}` : ''}
                            </option>
                          ))
                        : batchUserOptions.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.nome} ({u.email})
                            </option>
                          ))}
                    </select>
                    <button
                      type="button"
                      disabled={!batchTargetId || isProcessing}
                      onClick={() => requestAction(selectedItems, 'assign', batchTargetId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <ArrowRightLeft size={13} />
                      Atribuir ({selectionMeta.count})
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-app-text-muted">
                    Filtre por &ldquo;Processo Apagado&rdquo; ou &ldquo;Usuário Apagado&rdquo; para atribuir em lote.
                  </span>
                )}

                {selectionMeta.unlinkableCount > 0 && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => requestAction(selectedItems, 'unlink')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Unlink size={13} />
                    Desvincular ({selectionMeta.unlinkableCount})
                  </button>
                )}

                {selectionMeta.deletableCount > 0 && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => requestAction(selectedItems, 'delete')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    Apagar ({selectionMeta.deletableCount})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabela de Registros Órfãos ou Estado Vazio */}
      {allOrphans.length === 0 ? (
        <div className="bg-app-surface border border-app-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-base font-bold text-app-text">Base íntegra — nenhum registro órfão encontrado</h3>
          <p className="text-xs text-app-text-muted mt-1 max-w-md mx-auto">
            Todas as tarefas, eventos, movimentações, lançamentos financeiros, documentos, recursos e envolvidos apontam para processos e usuários ativos.
          </p>
        </div>
      ) : filteredOrphans.length === 0 ? (
        <div className="bg-app-surface border border-app-border rounded-2xl p-10 text-center">
          <p className="text-sm font-bold text-app-text">Nenhum registro órfão corresponde aos filtros atuais.</p>
          <button
            type="button"
            onClick={() => {
              setKindFilter('all');
              setModuleFilter('all');
              setOfficeFilter('all');
              setMissingIdFilter('');
              setSearchTerm('');
            }}
            className="mt-3 text-xs font-bold text-primary hover:underline"
          >
            Restaurar filtros
          </button>
        </div>
      ) : (
        <div className="bg-app-surface border border-app-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-app-border bg-app-bg/70 text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
                  <th className="py-3 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectPage}
                      aria-label="Selecionar todos desta página"
                      className="rounded border-app-border text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="py-3 px-3">Módulo & Campo</th>
                  <th className="py-3 px-3">Registro Afetado</th>
                  <th className="py-3 px-3">Referência Ausente & Escritório</th>
                  <th className="py-3 pl-3 pr-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border text-xs">
                {pageItems.map(item => {
                  const isSelected = selectedKeys.has(item.key);
                  const currentTarget = rowTargets[item.key] || '';
                  const candidates =
                    item.orphanKind === 'processo'
                      ? getProcessOptions(item.escritorioId).slice(0, 120)
                      : getUserOptions(item.escritorioId);

                  return (
                    <tr
                      key={item.key}
                      className={`transition-colors ${
                        isSelected ? 'bg-primary/5' : 'hover:bg-app-bg/40'
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2 align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(item.key)}
                          aria-label={`Selecionar ${item.title}`}
                          className="mt-0.5 rounded border-app-border text-primary focus:ring-primary"
                        />
                      </td>

                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div className="font-bold text-app-text">{item.moduleLabel}</div>
                        <div className="text-[11px] text-app-text-muted mt-0.5">
                          {item.fieldLabel}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top max-w-md">
                        <div className="font-semibold text-app-text line-clamp-2" title={item.title}>
                          {item.title}
                        </div>
                        <div className="text-[11px] text-app-text-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                          {item.subtitle && <span>{item.subtitle}</span>}
                          {item.dateLabel && item.dateLabel !== '—' && <span>· {item.dateLabel}</span>}
                          {item.amountLabel && <span className="font-semibold text-app-text">· {item.amountLabel}</span>}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={item.orphanKind === 'processo' ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-blue-600 dark:text-blue-400 font-semibold'}>
                            {item.orphanKind === 'processo' ? 'Processo' : 'Usuário'}
                          </span>
                          <span className="text-app-text-muted">·</span>
                          <code className="font-mono text-[11px] font-bold text-app-text">
                            {item.missingId}
                          </code>
                        </div>
                        <div className="text-[11px] text-app-text-muted mt-0.5">
                          {item.escritorioNome}
                        </div>
                      </td>

                      <td className="py-3 pl-3 pr-4 align-top">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                          <select
                            value={currentTarget}
                            onChange={e => setRowTargets(prev => ({ ...prev, [item.key]: e.target.value }))}
                            disabled={isProcessing}
                            className="px-2 py-1.5 bg-app-bg border border-app-border rounded-lg text-[11px] text-app-text max-w-[190px] focus:outline-none focus:border-primary"
                            aria-label={`Destino para ${item.title}`}
                          >
                            <option value="">
                              {item.orphanKind === 'processo' ? 'Atribuir processo...' : 'Atribuir usuário...'}
                            </option>
                            {item.orphanKind === 'processo'
                              ? (candidates as typeof state.processos).map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.numero || p.id}{p.titulo ? ` — ${p.titulo.slice(0, 28)}` : ''}
                                  </option>
                                ))
                              : (candidates as typeof state.usuarios).map(u => (
                                  <option key={u.id} value={u.id}>
                                    {u.nome}
                                  </option>
                                ))}
                          </select>

                          <button
                            type="button"
                            disabled={!currentTarget || isProcessing}
                            onClick={() => requestAction([item], 'assign', currentTarget)}
                            title="Atribuir registro ao destino selecionado"
                            className="px-2.5 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 disabled:opacity-40"
                          >
                            Atribuir
                          </button>

                          {item.canUnlink && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => requestAction([item], 'unlink')}
                              title="Remover vínculo quebrado preservando o registro"
                              className="px-2.5 py-1.5 bg-app-bg hover:bg-emerald-500/10 border border-app-border hover:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 disabled:opacity-40"
                            >
                              Desvincular
                            </button>
                          )}

                          {item.canDeleteRecord && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => requestAction([item], 'delete')}
                              title="Excluir registro definitivamente"
                              className="p-1.5 bg-app-bg hover:bg-red-500/10 border border-app-border hover:border-red-500/40 text-red-600 dark:text-red-400 rounded-lg shrink-0 disabled:opacity-40"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-app-border flex items-center justify-between text-xs">
              <span className="text-app-text-muted tabular-nums">
                Página <strong className="text-app-text">{safePage}</strong> de <strong className="text-app-text">{totalPages}</strong> ·{' '}
                {filteredOrphans.length.toLocaleString('pt-BR')} vínculo(s)
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

      {/* Modal In-App de Confirmação */}
      {confirmState?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  confirmState.mode === 'delete'
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {confirmState.mode === 'delete' ? <Trash2 size={20} /> : <ArrowRightLeft size={20} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-app-text">
                  {confirmState.mode === 'delete'
                    ? 'Confirmar exclusão definitiva'
                    : confirmState.mode === 'unlink'
                    ? 'Confirmar desvínculo em lote'
                    : 'Confirmar reatribuição em lote'}
                </h3>
                <p className="text-xs text-app-text-muted mt-1 leading-relaxed">
                  {confirmState.mode === 'delete' ? (
                    <>
                      Você está prestes a excluir permanentemente{' '}
                      <strong className="text-app-text tabular-nums">{confirmState.items.length.toLocaleString('pt-BR')}</strong>{' '}
                      registro(s) selecionado(s). Esta ação não pode ser desfeita.
                    </>
                  ) : confirmState.mode === 'unlink' ? (
                    <>
                      Serão removidas apenas as referências ausentes de{' '}
                      <strong className="text-app-text tabular-nums">
                        {confirmState.items.filter(i => i.canUnlink).length.toLocaleString('pt-BR')}
                      </strong>{' '}
                      registro(s), preservando o conteúdo histórico de todos eles.
                    </>
                  ) : (
                    <>
                      Você está prestes a atribuir{' '}
                      <strong className="text-app-text tabular-nums">{confirmState.items.length.toLocaleString('pt-BR')}</strong>{' '}
                      vínculo(s) para <strong className="text-app-text">{confirmState.targetLabel}</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-app-border">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setConfirmState(null)}
                className="px-4 py-2 bg-app-bg border border-app-border text-app-text rounded-xl text-xs font-bold hover:border-app-text-muted whitespace-nowrap shrink-0"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => executeCleanup(confirmState.items, confirmState.mode, confirmState.targetId)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-bold whitespace-nowrap shrink-0 disabled:opacity-50 ${
                  confirmState.mode === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : confirmState.mode === 'unlink'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {isProcessing && <Loader2 size={13} className="animate-spin" />}
                {confirmState.mode === 'delete'
                  ? 'Confirmar Exclusão'
                  : confirmState.mode === 'unlink'
                  ? 'Confirmar Desvínculo'
                  : 'Confirmar Atribuição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
