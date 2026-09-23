import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context';
import { Scale, Users, Calendar as CalendarIcon, FileText, Activity, AlertCircle, Settings as SettingsIcon, TrendingUp, Clock, Plus, Search, Sparkles, RefreshCw, CheckCircle2, MapPin, Tag, Info, User, Copy, Link as LinkIcon, Building, Edit2, Trash2, ExternalLink, CalendarPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { searchDatajud } from '../services/djenService';
import { formatDate, formatDateTime } from '../utils/date';
import CalendarComponent from '../components/Calendar';
import Modal from '../components/Modal';

export default function Dashboard() {
  const { state, addMovimento, deleteEvento, setSelectedProcessId, hasPermission, escritorioAtivoId, isAdmin, currentUser, activeOfficeName, setViewParams } = useAppContext();
  const [isUpdating, setIsUpdating] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [publicacoesHoje, setPublicacoesHoje] = useState<number>(0);

  // States for View Modal
  const [selectedViewItem, setSelectedViewItem] = useState<{
    id: string;
    title: string;
    date: string;
    endDate?: string;
    type: string;
    description?: string;
    location?: string;
    status?: string;
    processoId?: string;
    processoNumero?: string;
    processoTitulo?: string;
    link?: string;
    escritorioId?: string;
    usuarioId?: string;
  } | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const getGoogleCalendarUrl = (item: any) => {
    if (!item) return '#';
    const title = `${item.type ? `[${item.type}] ` : ''}${item.title}`;
    
    const descriptionParts = [];
    if (item.processoNumero) {
      descriptionParts.push(`Processo: ${item.processoNumero} - ${item.processoTitulo || ''}`);
    }
    if (item.link) {
      descriptionParts.push(`Link do Evento: ${item.link}`);
    }
    if (item.description) {
      descriptionParts.push(`Observações:\n${item.description}`);
    }
    const details = descriptionParts.join('\n\n');
    
    let dates = '';
    const dateStr = item.date;
    if (dateStr) {
      if (dateStr.includes('T')) {
        const cleanStart = dateStr.replace(/[-:]/g, '') + '00';
        const startDate = new Date(dateStr);
        if (!isNaN(startDate.getTime())) {
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          const endYear = endDate.getFullYear();
          const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
          const endDay = String(endDate.getDate()).padStart(2, '0');
          const endHours = String(endDate.getHours()).padStart(2, '0');
          const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
          const cleanEnd = `${endYear}${endMonth}${endDay}T${endHours}${endMinutes}00`;
          dates = `${cleanStart}/${cleanEnd}`;
        } else {
          dates = `${cleanStart}/${cleanStart}`;
        }
      } else {
        const cleanStart = dateStr.replace(/-/g, '');
        const startDate = new Date(dateStr + 'T00:00:00');
        if (!isNaN(startDate.getTime())) {
          const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          const endYear = endDate.getFullYear();
          const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
          const endDay = String(endDate.getDate()).padStart(2, '0');
          const cleanEnd = `${endYear}${endMonth}${endDay}`;
          dates = `${cleanStart}/${cleanEnd}`;
        } else {
          dates = `${cleanStart}/${cleanStart}`;
        }
      }
    }
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dates}&details=${encodeURIComponent(details)}${item.location ? `&location=${encodeURIComponent(item.location)}` : ''}`;
  };

  useEffect(() => {
    const fetchPublicacoesHoje = async () => {
      if (!currentUser && !escritorioAtivoId) return;

      const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
      const responsavel = activeOffice?.responsavel || currentUser?.nome || '';
      
      if (!responsavel) return;

      const today = new Date().toISOString().split('T')[0];
      const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?pagina=1&itensPorPagina=1&dataDisponibilizacaoInicio=${today}&dataDisponibilizacaoFim=${today}&nomeAdvogado=${encodeURIComponent(responsavel)}`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setPublicacoesHoje(data.count || 0);
        }
      } catch (e) {
        console.error('Erro ao buscar publicações do dia:', e);
      }
    };

    fetchPublicacoesHoje();
  }, [escritorioAtivoId, state.escritorios, currentUser]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  const handleUpdateMovements = async () => {
    if (cooldown > 0 || isUpdating) return;
    
    setIsUpdating(true);
    let newMovementsCount = 0;
    
    try {
      const activeProcessos = state.processos.filter(p => {
        if (escritorioAtivoId && p.escritorioId !== escritorioAtivoId) return false;
        if (!isAdmin() && !(currentUser?.escritoriosIds || []).includes(p.escritorioId)) return false;
        return p.status === 'Ativo';
      });
      
      for (const proc of activeProcessos) {
        const numeroLimpo = proc.numero.replace(/\D/g, '');
        if (numeroLimpo.length < 20) continue;
        
        try {
          const tribunalsToTry = ['tjam', 'tjpa', 'trf1'];
          let foundMovements = [];
          
          for (const trib of tribunalsToTry) {
            const result = await searchDatajud(numeroLimpo, trib);
            const hits = result.hits?.hits || [];
            if (hits.length > 0) {
              const source = hits[0]._source;
              foundMovements = source.movimentos || [];
              break;
            }
          }
          
          if (foundMovements.length > 0) {
            const existingMovements = state.movimentos.filter(m => m.processoId === proc.id);
            
            foundMovements.forEach((mov: any) => {
              const dataHora = mov.dataHora || mov.data;
              const descricao = mov.nome || mov.descricao;
              
              const alreadyExists = existingMovements.some(m => 
                m.data === dataHora && m.descricao === descricao
              );
              
              if (!alreadyExists) {
                addMovimento({
                  id: Math.random().toString(36).substr(2, 9),
                  processoId: proc.id,
                  data: dataHora,
                  descricao: descricao
                });
                newMovementsCount++;
              }
            });
          }
        } catch (e) {
          console.error(`Erro ao atualizar processo ${proc.numero}:`, e);
        }
      }
      
      setCooldown(60);
    } catch (error) {
      console.error('Erro geral na atualização:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatCNJ = (numero: string) => {
    if (!numero) return '';
    const clean = numero.replace(/\D/g, '');
    if (clean.length !== 20) return numero;
    return `${clean.substring(0, 7)}-${clean.substring(7, 9)}.${clean.substring(9, 13)}.${clean.substring(13, 14)}.${clean.substring(14, 16)}.${clean.substring(16, 20)}`;
  };

  const activeProcessos = state.processos.filter(p => {
    const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
    const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
    const isGlobal = pEscId === 'X';
    
    if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
    return p.status === 'Ativo';
  });

  const totalProcessos = activeProcessos.length;
  const totalClientes = state.contatos.filter(c => {
    const pEscId = (c.escritorioId || '').toString().trim().toUpperCase();
    const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
    const isGlobal = pEscId === 'X';
    
    if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
    return c.tipo === 'Cliente';
  }).length;
  
  const tarefasPendentesCount = state.tarefas.filter(t => {
    const pEscId = (t.ID_ESCRITORIO || '').toString().trim().toUpperCase();
    const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
    
    if (activeEscId && pEscId !== activeEscId) return false;
    if (!isAdmin() && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
    return t.STATUS?.toLowerCase() !== 'concluída' && t.STATUS?.toLowerCase() !== 'concluida';
  }).length;

  const processosPendentesCount = state.processos.filter(p => {
    const pEscId = (p.escritorioId || '').toString().trim().toUpperCase();
    const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
    const isGlobal = pEscId === 'X';
    
    if (activeEscId && pEscId !== activeEscId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
    
    if (p.status !== 'Ativo') return false;
    const pTags = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    return state.etiquetas.some(e => {
      const tagName = e.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return pTags.includes(String(e.id)) && tagName.includes('pendencia');
    });
  }).length;

  const diasMorosidade = state.settings.diasMorosidade || 30;
  const hoje = new Date();
  
  const processosMorosos = activeProcessos.filter(p => {
    // Pegar a última movimentação deste processo usando múltiplos IDs possíveis
    const movimentosProc = state.movimentos.filter(m => 
      String(m.processoId) === String(p.id) || 
      String(m.processoId) === String(p.idProc) || 
      String(m.processoId) === String(p.numero)
    );
    if (movimentosProc.length === 0) {
      // Se não tem movimentação, verificar a data de distribuição
      if (!p.dataDistribuicao) return false;
      const dataDist = new Date(p.dataDistribuicao);
      const diffTime = Math.abs(hoje.getTime() - dataDist.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > diasMorosidade;
    }
    
    const ultimaMov = movimentosProc.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
    const dataMov = new Date(ultimaMov.data);
    const diffTime = Math.abs(hoje.getTime() - dataMov.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > diasMorosidade;
  });

  const proximosEventos = [...state.eventos]
    .filter(e => {
      const isGlobal = e.escritorioId?.toLowerCase() === 'x';
      if (escritorioAtivoId && e.escritorioId !== escritorioAtivoId && !isGlobal) return false;
      if (!isAdmin() && e.escritorioId && !isGlobal && !(currentUser?.escritoriosIds || []).includes(e.escritorioId)) return false;
      return !e.concluido;
    })
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .slice(0, 5);

  const sortedMovimentos = [...state.movimentos]
    .filter(m => {
      const p = activeProcessos.find(proc => proc.id === m.processoId);
      return !!p;
    })
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const ultimosMovimentos = sortedMovimentos.slice(0, 5);

  const isConfigured = !!state.settings.scriptUrl && state.settings.scriptUrl.includes('/exec');

  const calendarEvents = state.eventos
    .filter(e => {
      const isGlobal = e.escritorioId?.toLowerCase() === 'x';
      if (escritorioAtivoId && e.escritorioId !== escritorioAtivoId && !isGlobal) return false;
      if (!isAdmin() && e.escritorioId && !isGlobal && !(currentUser?.escritoriosIds || []).includes(e.escritorioId)) return false;
      return true;
    })
    .map(e => ({
      id: e.id,
      date: e.data,
      title: e.titulo,
      type: e.tipo,
      color: e.concluido ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-primary/10 text-primary border-primary/20'
    }));

  const calendarTasks = state.tarefas
    .filter(t => {
      const pEscId = (t.ID_ESCRITORIO || '').toString().trim().toUpperCase();
      const activeEscId = (escritorioAtivoId || '').toString().trim().toUpperCase();
      
      if (activeEscId && pEscId !== activeEscId) return false;
      if (!isAdmin() && pEscId && !(currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase()).includes(pEscId)) return false;
      return true;
    })
    .map(t => ({
      id: t.ID_TAREFA,
      startDate: t.DATA_CRIACAO || t.PRAZO_IN,
      endDate: t.DATA_LIMITE || t.PRAZO_FIM,
      title: t.TITULO || t.TAREFA || 'Sem Título',
      type: 'Tarefa',
      color: (t.STATUS === 'Concluída' || t.STATUS === 'concluida') 
        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
        : t.PRIORIDADE === 'Urgente' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    }));

  return (
    <div className="p-4 md:p-6 w-full max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-app-text tracking-tight">
            Olá{currentUser?.nome ? `, ${currentUser.nome.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-app-text-muted text-sm font-medium">
            Bem-vindo ao painel do <span className="text-primary font-bold">{activeOfficeName}</span>
          </p>
        </div>
        {!isConfigured && (
          <div className="flex items-center px-4 py-2 bg-amber-500/10 dark:bg-amber-900/20 border border-amber-500/20 dark:border-amber-500/30 rounded-lg text-amber-600 dark:text-amber-400 text-sm animate-pulse">
            <AlertCircle size={18} className="mr-2" />
            <span>Configuração de salvamento pendente</span>
          </div>
        )}
      </div>

      {!isConfigured && (
        <div className="bg-amber-500/10 dark:bg-amber-900/20 border border-amber-500/20 dark:border-amber-500/30 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start">
            <div className="p-3 bg-amber-500/20 dark:bg-amber-500/30 text-amber-600 dark:text-amber-400 rounded-full mr-4">
              <SettingsIcon size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-300">Sincronização Desativada</h3>
              <p className="text-amber-600 dark:text-amber-400 text-sm max-w-2xl">
                As alterações estão sendo salvas apenas localmente no seu navegador. 
                Para gravar os dados permanentemente na sua planilha do Google, você precisa configurar a <b>URL do Script</b> nas configurações.
              </p>
            </div>
          </div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'settings' }))}
            className="whitespace-nowrap bg-amber-600 hover:opacity-90 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Configurar Agora
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 md:gap-6">
        {[
          { 
            label: 'Processos Ativos', 
            value: totalProcessos, 
            icon: <Scale size={24} />, 
            color: 'text-primary', 
            bg: 'bg-primary/10',
            onClick: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }))
          },
          { 
            label: 'Clientes', 
            value: totalClientes, 
            icon: <Users size={24} />, 
            color: 'text-primary', 
            bg: 'bg-primary/10',
            onClick: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'contatos' }))
          },
          { 
            label: 'Eventos Pendentes', 
            value: state.eventos.filter(e => {
              const isGlobal = e.escritorioId?.toLowerCase() === 'x';
              if (escritorioAtivoId && e.escritorioId !== escritorioAtivoId && !isGlobal) return false;
              if (!isAdmin() && e.escritorioId && !isGlobal && !(currentUser?.escritoriosIds || []).includes(e.escritorioId)) return false;
              return !e.concluido;
            }).length, 
            icon: <CalendarIcon size={24} />, 
            color: 'text-amber-600 dark:text-amber-400', 
            bg: 'bg-amber-500/10 dark:bg-amber-500/20',
            onClick: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'eventos' }))
          },
          { 
            label: 'Tarefas Pendentes', 
            value: tarefasPendentesCount, 
            icon: <CheckCircle2 size={24} />, 
            color: 'text-rose-600 dark:text-rose-400', 
            bg: 'bg-rose-500/10 dark:bg-rose-500/20',
            onClick: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'tarefas' }))
          },
          { 
            label: 'Processos Pendentes', 
            value: processosPendentesCount, 
            icon: <AlertCircle size={24} />, 
            color: 'text-orange-600 dark:text-orange-400', 
            bg: 'bg-orange-500/10 dark:bg-orange-500/20',
            onClick: () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'pendencias' }))
          },
          { label: 'Alerta Morosidade', value: processosMorosos.length, icon: <Clock size={24} />, color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-500/10 dark:bg-rose-500/20', 
            onClick: () => {
              setViewParams({ activeTab: 'morosidade' });
              window.dispatchEvent(new CustomEvent('navigate', { detail: 'pendencias' }));
            }
          },
          { 
            label: 'Novas Publicações (Hoje)', 
            value: publicacoesHoje, 
            icon: <FileText size={24} />, 
            color: 'text-blue-600 dark:text-blue-400', 
            bg: 'bg-blue-500/10 dark:bg-blue-500/20',
            onClick: () => {
              setViewParams({ tab: 'nome' });
              window.dispatchEvent(new CustomEvent('navigate', { detail: 'api_diario' }));
            }
          },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={stat.onClick}
            className={`bg-app-surface p-5 rounded-2xl shadow-sm border border-app-border flex flex-col items-center text-center space-y-3 hover:border-primary/30 transition-all group ${stat.onClick ? 'cursor-pointer hover:bg-app-bg' : ''}`}
          >
            <div className={`p-2.5 ${stat.bg} ${stat.color} rounded-xl group-hover:scale-110 transition-transform shrink-0`}>
              {stat.icon}
            </div>
            <div className="min-w-0 w-full">
              <p className="text-[9px] md:text-xs text-app-text-muted font-bold uppercase tracking-wider leading-tight mb-0.5">{stat.label}</p>
              <p className="text-sm md:text-lg font-black text-app-text leading-tight break-words">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-app-text flex items-center">
              <CalendarIcon className="mr-2 text-primary" size={20} />
              Calendário de Eventos
            </h2>
          </div>
          <CalendarComponent 
            events={calendarEvents} 
            rowHeight="80px"
            onEventClick={(id) => {
              const event = state.eventos.find(e => e.id === id);
              if (event) {
                const processo = state.processos.find(p => p.id === event.processoId);
                setSelectedViewItem({
                  id: event.id,
                  title: event.titulo,
                  date: event.data,
                  type: event.tipo,
                  description: event.observacoes,
                  location: '', // Evento doesn't have local anymore or it's in observacoes
                  status: event.concluido ? 'Concluído' : 'Pendente',
                  processoId: event.processoId,
                  processoNumero: processo?.numero,
                  processoTitulo: processo?.titulo || processo?.parteContraria,
                  link: event.link,
                  escritorioId: event.escritorioId,
                  usuarioId: event.usuarioId
                });
                setIsViewModalOpen(true);
              }
            }} 
          />
        </div>

        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-app-text flex items-center">
              <CheckCircle2 className="mr-2 text-emerald-500" size={20} />
              Calendário de Tarefas
            </h2>
          </div>
          <CalendarComponent 
            events={calendarTasks} 
            rowHeight="80px"
            onEventClick={(id) => {
              const task = state.tarefas.find(t => t.ID_TAREFA === id);
              if (task) {
                const procId = task.PROCESSO_ID || task.ID_PROC;
                const processo = state.processos.find(p => p.id === procId);
                setSelectedViewItem({
                  id: task.ID_TAREFA,
                  title: task.TITULO || task.TAREFA || 'Sem Título',
                  date: task.DATA_CRIACAO || task.PRAZO_IN || '',
                  endDate: task.DATA_LIMITE || task.PRAZO_FIM || '',
                  type: 'Tarefa',
                  description: task.DESCRICAO || '',
                  status: task.STATUS,
                  processoId: processo?.id,
                  processoNumero: processo?.numero || task.PROC_NOME || task['PROC.NOME']
                });
                setIsViewModalOpen(true);
              }
            }} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-app-text flex items-center">
              <CalendarIcon className="mr-2 text-app-text-muted" size={20} />
              Próximos Prazos e Audiências
            </h2>
          </div>
          <div className="space-y-4">
            {proximosEventos.length === 0 ? (
              <p className="text-app-text-muted text-sm">Nenhum evento pendente.</p>
            ) : (
              proximosEventos.map((evento, index) => {
                const processo = state.processos.find(p => p.id === evento.processoId);
                return (
                  <div 
                    key={`${evento.id}-${index}`} 
                    className="flex items-start p-3 hover:bg-app-secondary rounded-lg transition-colors border border-app-border cursor-pointer group"
                    onClick={() => {
                      setSelectedViewItem({
                        id: evento.id,
                        title: evento.titulo,
                        date: evento.data,
                        type: evento.tipo,
                        description: evento.observacoes,
                        status: evento.concluido ? 'Concluído' : 'Pendente',
                        processoId: evento.processoId,
                        processoNumero: processo?.numero,
                        processoTitulo: processo?.titulo || processo?.parteContraria,
                        link: evento.link,
                        escritorioId: evento.escritorioId,
                        usuarioId: evento.usuarioId
                      });
                      setIsViewModalOpen(true);
                    }}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-app-text group-hover:text-primary transition-colors">{evento.titulo}</p>
                      <p className="text-sm text-app-text-muted">
                        {formatDateTime(evento.data)} • {evento.tipo}
                      </p>
                      {processo && (
                        <div 
                          className="flex items-center mt-1 cursor-pointer group/proc"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProcessId(processo.id);
                            window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                          }}
                        >
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-mono font-bold group-hover/proc:underline">{formatCNJ(processo.numero)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-app-text flex items-center">
              <Activity className="mr-2 text-app-text-muted" size={20} />
              Últimos Movimentos
            </h2>
            {hasPermission('processos', 'write') && (
              <button
                onClick={handleUpdateMovements}
                disabled={isUpdating || cooldown > 0}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isUpdating || cooldown > 0
                    ? 'bg-app-secondary text-app-text-muted cursor-not-allowed'
                    : 'bg-primary/10 text-primary hover:bg-primary/20 active:scale-95'
                }`}
                title={cooldown > 0 ? `Aguarde ${cooldown}s para atualizar novamente` : 'Atualizar movimentações dos processos ativos'}
              >
                <RefreshCw size={14} className={isUpdating ? 'animate-spin' : ''} />
                {isUpdating ? 'Atualizando...' : cooldown > 0 ? `Aguarde ${cooldown}s` : 'Atualizar'}
              </button>
            )}
          </div>
          <div className="space-y-4">
            {ultimosMovimentos.length === 0 ? (
              <p className="text-app-text-muted text-sm">Nenhum movimento recente.</p>
            ) : (
              <>
                {ultimosMovimentos.map((mov, index) => {
                  const processo = state.processos.find(p => p.id === mov.processoId);
                  return (
                    <div key={`${mov.id}-${index}`} className="flex items-start p-4 hover:bg-app-secondary rounded-lg transition-colors border border-app-border">
                      <div className="flex-1">
                        <p className="text-base font-bold text-app-text line-clamp-2">{mov.descricao}</p>
                        <p className="text-xs text-app-text-muted mt-1">
                          {formatDate(mov.data)}
                        </p>
                        {processo && (
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <p 
                                className="text-xs text-amber-600 dark:text-amber-400 font-mono font-bold cursor-pointer hover:underline"
                                onClick={() => {
                                  setSelectedProcessId(processo.id);
                                  window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                                }}
                              >
                                {formatCNJ(processo.numero)}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(processo.numero);
                                }}
                                className="p-1 hover:bg-amber-500/10 rounded transition-colors text-amber-600/60 hover:text-amber-600 dark:text-amber-400/60 dark:hover:text-amber-400"
                                title="Copiar número"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedViewItem({
                                  id: mov.id,
                                  title: mov.descricao,
                                  date: mov.data,
                                  type: 'Movimentação',
                                  status: 'Processado',
                                  processoId: processo.id,
                                  processoNumero: processo.numero
                                });
                                setIsViewModalOpen(true);
                              }}
                              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-bold uppercase tracking-wider"
                            >
                              Ver Movimento
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {sortedMovimentos.length > 5 && (
                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'movimentos' }))}
                    className="w-full text-center py-2 text-[10px] font-bold text-primary hover:underline border-t border-app-border mt-2"
                  >
                    Ver todos os {sortedMovimentos.length} movimentos
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-app-text flex items-center">
              <Clock className="mr-2 text-rose-500" size={20} />
              Processos Parados (+{diasMorosidade} d)
            </h2>
          </div>
          <div className="space-y-4">
            {processosMorosos.length === 0 ? (
              <p className="text-app-text-muted text-sm">Nenhum processo em morosidade.</p>
            ) : (
              processosMorosos.slice(0, 5).map((proc, index) => {
                const movimentosProc = state.movimentos.filter(m => 
                  String(m.processoId) === String(proc.id) || 
                  String(m.processoId) === String(proc.idProc) || 
                  String(m.processoId) === String(proc.numero)
                );
                const ultimaMov = movimentosProc.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
                const dataBase = ultimaMov ? new Date(ultimaMov.data) : (proc.dataDistribuicao ? new Date(proc.dataDistribuicao) : new Date());
                const dias = Math.ceil(Math.abs(new Date().getTime() - dataBase.getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={`${proc.id}-${index}`} className="flex items-start p-3 hover:bg-rose-500/5 rounded-lg transition-colors border border-app-border hover:border-rose-500/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-app-text truncate text-sm">{proc.titulo || 'Processo sem título'}</p>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 uppercase tracking-tighter shrink-0 ml-2">
                          {dias} dias
                        </span>
                      </div>
                      <div 
                        className="cursor-pointer group/proc inline-block"
                        onClick={() => {
                          setSelectedProcessId(proc.id);
                          window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                        }}
                      >
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold mt-0.5 group-hover/proc:underline">{formatCNJ(proc.numero)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {processosMorosos.length > 5 && (
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }))}
                className="w-full text-center py-2 text-[10px] font-bold text-primary hover:underline border-t border-app-border mt-2"
              >
                Ver todos os {processosMorosos.length} processos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View Detail Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={selectedViewItem?.type || 'Detalhes'}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl ${
              selectedViewItem?.type === 'Tarefa' 
                ? 'bg-amber-500/10 text-amber-600' 
                : 'bg-primary/10 text-primary'
            }`}>
              {selectedViewItem?.type === 'Tarefa' ? <CheckCircle2 size={24} /> : <CalendarIcon size={24} />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-app-text">{selectedViewItem?.title}</h3>
              <p className="text-sm text-app-text-muted flex items-center mt-1">
                <Clock size={14} className="mr-1.5" />
                {selectedViewItem?.date ? formatDateTime(selectedViewItem.date) : ''}
                {selectedViewItem?.endDate && ` até ${formatDateTime(selectedViewItem.endDate)}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-app-bg border border-app-border rounded-xl">
              <p className="text-[10px] font-bold text-app-text-muted uppercase mb-2">Status</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  (selectedViewItem?.status?.toLowerCase() === 'concluído' || selectedViewItem?.status?.toLowerCase() === 'concluida')
                    ? 'bg-emerald-500' 
                    : 'bg-amber-500'
                }`} />
                <span className="text-sm font-medium text-app-text">{selectedViewItem?.status}</span>
              </div>
            </div>

            {selectedViewItem?.processoNumero && (() => {
              const proc = state.processos.find(p => p.id === selectedViewItem.processoId || p.numero === selectedViewItem.processoNumero);
              const procTitulo = proc?.titulo || proc?.parteContraria || selectedViewItem.processoTitulo;
              return (
                <div 
                  className={`p-4 bg-app-bg border border-app-border rounded-xl ${selectedViewItem.processoId ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}`}
                  onClick={() => {
                    if (selectedViewItem.processoId) {
                      setSelectedProcessId(selectedViewItem.processoId);
                      window.dispatchEvent(new CustomEvent('navigate', { detail: 'processosAtivos' }));
                      setIsViewModalOpen(false);
                    }
                  }}
                >
                  <p className="text-[10px] font-bold text-app-text-muted uppercase mb-2">Processo</p>
                  <p className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400">{formatCNJ(selectedViewItem.processoNumero)}</p>
                  {procTitulo && (
                    <p className="text-xs text-app-text-muted mt-1 font-semibold">{procTitulo}</p>
                  )}
                </div>
              );
            })()}

            {selectedViewItem?.type !== 'Tarefa' && selectedViewItem?.escritorioId && (
              <div className="p-4 bg-app-bg border border-app-border rounded-xl">
                <p className="text-[10px] font-bold text-app-text-muted uppercase mb-2 flex items-center gap-1">
                  <Building size={14} /> Escritório Responsável
                </p>
                <p className="text-sm font-semibold text-app-text">
                  {state.escritorios.find(e => e.id === selectedViewItem.escritorioId)?.nome || 'Todos os Escritórios'}
                </p>
              </div>
            )}

            {selectedViewItem?.type !== 'Tarefa' && selectedViewItem?.usuarioId && (
              <div className="p-4 bg-app-bg border border-app-border rounded-xl">
                <p className="text-[10px] font-bold text-app-text-muted uppercase mb-2 flex items-center gap-1">
                  <User size={14} /> Usuário Responsável
                </p>
                <p className="text-sm font-semibold text-app-text">
                  {state.usuarios?.find(u => u.id === selectedViewItem.usuarioId)?.nome || 'N/A'}
                </p>
              </div>
            )}
          </div>

          {selectedViewItem?.location && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-app-text-muted uppercase flex items-center gap-2">
                <MapPin size={14} />
                Localização
              </p>
              <p className="text-sm text-app-text bg-app-bg p-3 rounded-xl border border-app-border">
                {selectedViewItem.location}
              </p>
            </div>
          )}

          {selectedViewItem?.link && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-app-text-muted uppercase flex items-center gap-2">
                <LinkIcon size={14} className="text-primary" />
                Link do Evento
              </p>
              <a 
                href={selectedViewItem.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline bg-app-bg p-3 rounded-xl border border-app-border flex items-center gap-2 font-medium"
              >
                <LinkIcon size={16} />
                Acessar Link do Evento
              </a>
            </div>
          )}

          {selectedViewItem?.description && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-app-text-muted uppercase flex items-center gap-2">
                <Info size={14} />
                Observações
              </p>
              <div className="text-sm text-app-text-muted bg-app-bg p-4 rounded-xl border border-app-border leading-relaxed whitespace-pre-wrap">
                {selectedViewItem.description}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-app-border gap-2">
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="px-6 py-2 bg-app-surface border border-app-border text-app-text rounded-xl font-bold hover:bg-app-bg transition-all"
            >
              Fechar
            </button>

            {selectedViewItem?.type !== 'Tarefa' && (
              <a
                href={getGoogleCalendarUrl(selectedViewItem)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <CalendarPlus size={16} /> Google Agenda
              </a>
            )}

            {selectedViewItem?.type !== 'Tarefa' && hasPermission('eventos', 'delete') && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Tem certeza que deseja excluir este evento?')) {
                    deleteEvento(selectedViewItem.id);
                    setIsViewModalOpen(false);
                  }
                }}
                className="px-4 py-2 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all flex items-center gap-1.5"
              >
                <Trash2 size={16} /> Excluir
              </button>
            )}

            {selectedViewItem?.type !== 'Tarefa' && hasPermission('eventos', 'write') && (
              <button
                type="button"
                onClick={() => {
                  setViewParams({ editEventoId: selectedViewItem.id });
                  window.dispatchEvent(new CustomEvent('navigate', { detail: 'eventos' }));
                  setIsViewModalOpen(false);
                }}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all flex items-center gap-1.5 shadow-sm animate-pulse"
              >
                <Edit2 size={16} /> Editar
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
