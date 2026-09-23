
import React, { useState } from 'react';
import { useAppContext } from '../context';
import { ListTodo, Calendar as CalendarIcon, Activity, Plus, Link as LinkIcon, AlertTriangle, Search, Building2 } from 'lucide-react';
import Modal from './Modal';
import ProcessoSelect from './ProcessoSelect';
import { calculateDeadline, getTribunalHolidays } from '../utils/date';

export function CreateTarefaModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { state, addTarefa, escritorioAtivoId, isAdmin } = useAppContext();
  const isGlobalAdmin = isAdmin() && (escritorioAtivoId === "" || !escritorioAtivoId);

  const [formData, setFormData] = useState({
    ID_PROC: '',
    'PROC.NOME': '',
    PROC_NOME: '',
    ID_VARA: '',
    'VARA.NOME': '',
    VARA_NOME: '',
    VARA_ID: '',
    PROCESSO_ID: '',
    UPJ_NOME: '',
    ID_USER: '',
    RESPONSAVEL_ID: '',
    TAREFA: '',
    TITULO: '',
    DESCRICAO: '',
    DATA_CRIACAO: new Date().toISOString().split('T')[0],
    PRAZO_IN: new Date().toISOString().split('T')[0],
    DATA_LIMITE: '',
    PRAZO_FIM: '',
    CONCLUSAO: '',
    PAGINA: '',
    STATUS: 'Pendente',
    PRIORIDADE: 'Média',
    LINK: '',
    prazo_tipo: 'Corridos',
    ID_ESCRITORIO: escritorioAtivoId || ''
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const titulo = formData.TITULO || formData.TAREFA;
    if (!titulo) return;
    
    const selectedProcesso = state.processos.find(p => p.id === formData.ID_PROC);
    const selectedVara = state.varas.find(v => v.id === formData.ID_VARA);
    const procRef = formData.PROCESSO_ID || formData.ID_PROC || selectedProcesso?.idProc || selectedProcesso?.id || '';
    const userId = formData.RESPONSAVEL_ID || formData.ID_USER || '';

    addTarefa({
      ...formData,
      ID_TAREFA: '', // Will be generated in context/service
      TITULO: titulo,
      TAREFA: titulo,
      PROCESSO_ID: procRef,
      ID_PROC: procRef,
      RESPONSAVEL_ID: userId,
      ID_USER: userId,
      ID_VARA: formData.ID_VARA || selectedVara?.id || '',
      VARA_ID: formData.ID_VARA || selectedVara?.id || '',
      'PROC.NOME': selectedProcesso?.numero || formData.PROC_NOME || '',
      PROC_NOME: selectedProcesso?.numero || formData.PROC_NOME || '',
      'VARA.NOME': selectedVara?.nome || formData.VARA_NOME || '',
      VARA_NOME: selectedVara?.nome || formData.VARA_NOME || '',
      DATA_CRIACAO: formData.DATA_CRIACAO || formData.PRAZO_IN || '',
      PRAZO_IN: formData.DATA_CRIACAO || formData.PRAZO_IN || '',
      DATA_LIMITE: formData.DATA_LIMITE || formData.PRAZO_FIM || '',
      PRAZO_FIM: formData.DATA_LIMITE || formData.PRAZO_FIM || '',
      ID_ESCRITORIO: formData.ID_ESCRITORIO || escritorioAtivoId || ''
    } as any);
    
    onClose();
    // Reset form
    setFormData({
      ID_PROC: '',
      'PROC.NOME': '',
      PROC_NOME: '',
      ID_VARA: '',
      'VARA.NOME': '',
      VARA_NOME: '',
      VARA_ID: '',
      PROCESSO_ID: '',
      UPJ_NOME: '',
      ID_USER: '',
      RESPONSAVEL_ID: '',
      TAREFA: '',
      TITULO: '',
      DESCRICAO: '',
      DATA_CRIACAO: new Date().toISOString().split('T')[0],
      PRAZO_IN: new Date().toISOString().split('T')[0],
      DATA_LIMITE: '',
      PRAZO_FIM: '',
      CONCLUSAO: '',
      PAGINA: '',
      STATUS: 'Pendente',
      PRIORIDADE: 'Média',
      LINK: '',
      prazo_tipo: 'Corridos',
      ID_ESCRITORIO: escritorioAtivoId || ''
    });
  };

  const handleCalculateDeadline = (days: number) => {
    if (!formData.PRAZO_IN) {
      alert('Selecione uma data de início primeiro');
      return;
    }

    const selectedProcesso = state.processos.find(p => p.id === formData.ID_PROC);
    const tribunal = selectedProcesso?.tribunal || 'TJ';
    const holidays = getTribunalHolidays(state.calendario, tribunal);
    
    const deadline = calculateDeadline(
      formData.PRAZO_IN,
      days,
      formData.prazo_tipo || 'Corridos',
      holidays
    );

    setFormData(prev => ({
      ...prev,
      PRAZO_FIM: deadline
    }));
  };

  const formatCNJ = (numero: string) => {
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Tarefa">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-app-text">Descrição da Tarefa *</label>
            <textarea 
              required
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              placeholder="Descreva a tarefa a ser realizada..."
              rows={3}
              value={formData.TAREFA}
              onChange={e => setFormData({...formData, TAREFA: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Processo *</label>
            <ProcessoSelect
              value={formData.ID_PROC}
              onChange={procId => {
                const proc = state.processos.find(p => p.id === procId);
                const vara = state.varas.find(v => v.id === proc?.varaId);
                const upj = state.upj.find(u => u.id === vara?.secretaria);
                setFormData({
                  ...formData, 
                  ID_PROC: procId,
                  ID_VARA: proc?.varaId || '',
                  'VARA.NOME': vara?.nome || '',
                  UPJ_NOME: upj?.nome || (vara as any)?.UPJ || (vara as any)?.UPJ_NOME || ''
                });
              }}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Prioridade</label>
            <select 
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={formData.PRIORIDADE}
              onChange={e => setFormData({...formData, PRIORIDADE: e.target.value})}
            >
              <option value="Baixa">Baixa</option>
              <option value="Média">Média</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Tipo de Prazo</label>
            <select 
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
              value={formData.prazo_tipo}
              onChange={e => setFormData({...formData, prazo_tipo: e.target.value})}
            >
              <option value="Corridos">Dias Corridos</option>
              <option value="Úteis">Dias Úteis</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Prazo Início</label>
            <input 
              type="date" 
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={formData.PRAZO_IN}
              onChange={e => setFormData({...formData, PRAZO_IN: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Prazo Fim</label>
            <div className="space-y-2">
              <input 
                type="date" 
                className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                value={formData.PRAZO_FIM}
                onChange={e => setFormData({...formData, PRAZO_FIM: e.target.value})}
              />
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {[5, 10, 15].map(days => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handleCalculateDeadline(days)}
                    className="flex-1 py-1.5 px-2 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap uppercase"
                    title={`Calcular ${days} ${formData.prazo_tipo?.toLowerCase() === 'úteis' ? 'dias úteis' : 'dias corridos'}`}
                  >
                    +{days} {formData.prazo_tipo?.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Responsável</label>
            <select 
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={formData.ID_USER}
              onChange={e => setFormData({...formData, ID_USER: e.target.value})}
            >
              <option value="">Selecione um responsável</option>
              {state.usuarios
                .filter(u => !escritorioAtivoId || (u.escritoriosIds || []).includes(escritorioAtivoId))
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
            </select>
          </div>
          {isGlobalAdmin && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Escritório</label>
              <select 
                className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                value={formData.ID_ESCRITORIO}
                onChange={e => setFormData({...formData, ID_ESCRITORIO: e.target.value})}
              >
                <option value="">Selecione um escritório</option>
                <option value="x">GLOBAL (Todos os Escritórios)</option>
                {state.escritorios.map(esc => (
                  <option key={esc.id} value={esc.id}>{esc.nome}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="pt-6 flex justify-end space-x-3 border-t border-app-border">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-app-secondary text-app-text rounded-lg hover:bg-app-bg transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors shadow-sm font-medium"
          >
            Adicionar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateEventoModal({ isOpen, onClose, initialData }: { isOpen: boolean, onClose: () => void, initialData?: any }) {
  const { state, addEvento, updateEvento, escritorioAtivoId, currentUser, isAdmin } = useAppContext();
  const isGlobalAdmin = isAdmin() && (escritorioAtivoId === "" || !escritorioAtivoId);

  const defaultDatetime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };

  const formatForDatetimeLocal = (dateStr: string | undefined | null): string => {
    if (!dateStr) {
      return defaultDatetime();
    }
    
    // If it already has "T" and has HH:MM
    if (dateStr.includes('T')) {
      const parts = dateStr.split('T');
      if (parts[1] && parts[1].length >= 5) {
        return dateStr.substring(0, 16);
      }
      return `${parts[0]}T12:00`;
    }

    // If it is YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return `${dateStr}T12:00`;
    }

    // If it contains space like "YYYY-MM-DD HH:MM"
    if (dateStr.includes(' ')) {
      const parts = dateStr.split(' ');
      if (parts[0] && parts[1]) {
        return `${parts[0]}T${parts[1].substring(0, 5)}`;
      }
    }

    return defaultDatetime();
  };

  const [formData, setFormData] = useState({
    titulo: initialData?.titulo || '',
    data: formatForDatetimeLocal(initialData?.data),
    tipo: initialData?.tipo || 'Outro' as any,
    processoId: initialData?.processoId || '',
    observacoes: initialData?.observacoes || '',
    concluido: initialData?.concluido || false,
    escritorioId: initialData?.escritorioId || escritorioAtivoId || '',
    link: initialData?.link || '',
    usuarioId: initialData?.usuarioId || currentUser?.id || ''
  });

  // Sync state with initialData when it changes
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        titulo: initialData?.titulo || '',
        data: formatForDatetimeLocal(initialData?.data),
        tipo: initialData?.tipo || 'Outro',
        processoId: initialData?.processoId || '',
        observacoes: initialData?.observacoes || '',
        concluido: initialData?.concluido || false,
        escritorioId: initialData?.escritorioId || escritorioAtivoId || '',
        link: initialData?.link || '',
        usuarioId: initialData?.usuarioId || currentUser?.id || ''
      });
    }
  }, [initialData, isOpen, escritorioAtivoId, currentUser]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.data) return;

    if (initialData?.id) {
      updateEvento({
        id: initialData.id,
        ...formData,
        usuarioId: formData.usuarioId || currentUser?.id || '',
        escritorioId: formData.escritorioId || escritorioAtivoId || ''
      });
    } else {
      addEvento({
        id: Math.random().toString(36).substr(2, 9),
        ...formData,
        usuarioId: formData.usuarioId || currentUser?.id || '',
        escritorioId: formData.escritorioId || escritorioAtivoId || ''
      });
    }
    
    onClose();
    setFormData({
      titulo: '',
      data: defaultDatetime(),
      tipo: 'Outro',
      processoId: '',
      observacoes: '',
      concluido: false,
      escritorioId: escritorioAtivoId || '',
      link: '',
      usuarioId: currentUser?.id || ''
    });
  };

  const formatCNJ = (numero: string) => {
    if (!numero) return '';
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Evento">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-app-text">Título do Evento</label>
          <input
            type="text"
            required
            value={formData.titulo}
            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
            placeholder="Ex: Audiência de Instrução"
            className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Data e Hora</label>
            <input
              type="datetime-local"
              required
              value={formData.data}
              onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
              className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Tipo</label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as any }))}
              className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="Prazo">Prazo</option>
              <option value="Audiência">Audiência</option>
              <option value="Reunião">Reunião</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-app-text">Processo Vinculado (Opcional)</label>
          <ProcessoSelect
            value={formData.processoId}
            onChange={(id) => setFormData(prev => ({ ...prev, processoId: id }))}
            placeholder="Nenhum processo"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-app-text">Usuário Responsável (Opcional)</label>
          <select
            className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
            value={formData.usuarioId}
            onChange={e => setFormData({ ...formData, usuarioId: e.target.value })}
          >
            <option value="">Nenhum responsável</option>
            {state.usuarios
              .filter(u => !escritorioAtivoId || (u.escritoriosIds || []).includes(escritorioAtivoId))
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map(u => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-app-text">Link do Evento (Opcional)</label>
          <input
            type="url"
            value={formData.link}
            onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
            placeholder="Ex: https://reuniao.zoom.us/j/123..."
            className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {isGlobalAdmin && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Escritório</label>
            <select 
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
              value={formData.escritorioId}
              onChange={e => setFormData({...formData, escritorioId: e.target.value})}
            >
              <option value="">Selecione um escritório</option>
              <option value="x">GLOBAL (Todos os Escritórios)</option>
              {state.escritorios.map(esc => (
                <option key={esc.id} value={esc.id}>{esc.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div className="pt-4 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-app-secondary text-app-text rounded-lg hover:bg-app-bg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors shadow-sm font-medium"
          >
            Adicionar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateMovimentoModal({ isOpen, onClose, initialData }: { isOpen: boolean, onClose: () => void, initialData?: any }) {
  const { state, addMovimento, escritorioAtivoId, currentUser, isAdmin } = useAppContext();
  const isGlobalAdmin = isAdmin() && (escritorioAtivoId === "" || !escritorioAtivoId);

  const [formData, setFormData] = useState({
    processoId: initialData?.processoId || '',
    data: initialData?.data || new Date().toISOString().split('T')[0],
    descricao: initialData?.descricao || '',
    pagina: initialData?.pagina || '',
    usuarioId: initialData?.usuarioId || currentUser?.id || '',
    escritorioId: initialData?.escritorioId || escritorioAtivoId || ''
  });

  // Sync state with initialData when it changes
  React.useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        processoId: initialData.processoId || prev.processoId,
        data: initialData.data || prev.data,
        descricao: initialData.descricao || prev.descricao,
        pagina: initialData.pagina || prev.pagina,
        escritorioId: initialData.escritorioId || prev.escritorioId
      }));
    }
  }, [initialData]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.processoId || !formData.descricao) return;

    addMovimento({
      id: Math.random().toString(36).substr(2, 9),
      ...formData,
      usuarioId: formData.usuarioId || currentUser?.id || '',
      escritorioId: formData.escritorioId || escritorioAtivoId || ''
    });
    
    onClose();
    setFormData({
      processoId: '',
      data: new Date().toISOString().split('T')[0],
      descricao: '',
      pagina: '',
      usuarioId: currentUser?.id || '',
      escritorioId: escritorioAtivoId || ''
    });
  };

  const formatCNJ = (numero: string) => {
    if (!numero) return '';
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Movimentação">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-app-text-muted uppercase">Processo *</label>
            <ProcessoSelect
              required
              value={formData.processoId}
              onChange={(id) => setFormData(prev => ({ ...prev, processoId: id }))}
              placeholder="Selecione um processo"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-app-text-muted uppercase">Data *</label>
            <input 
              type="date" 
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-app-surface text-app-text"
              value={formData.data}
              onChange={e => setFormData({...formData, data: e.target.value})}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-app-text-muted uppercase">Movimentação / Descrição *</label>
          <textarea 
            rows={5}
            required
            className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-app-surface text-app-text resize-none"
            placeholder="Descreva o andamento do processo..."
            value={formData.descricao}
            onChange={e => setFormData({...formData, descricao: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-app-text-muted uppercase">Responsável</label>
            <select 
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-app-surface text-app-text"
              value={formData.usuarioId}
              onChange={e => setFormData({...formData, usuarioId: e.target.value})}
            >
              <option value="">Selecione um Responsável</option>
              {state.usuarios
                .filter(u => !escritorioAtivoId || (u.escritoriosIds || []).includes(escritorioAtivoId))
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-app-text-muted uppercase">Página</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-app-surface text-app-text"
              value={formData.pagina}
              onChange={e => setFormData({...formData, pagina: e.target.value})}
              placeholder="Ex: 142"
            />
          </div>
          {isGlobalAdmin && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-app-text-muted uppercase">Escritório</label>
              <select 
                className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                value={formData.escritorioId}
                onChange={e => setFormData({...formData, escritorioId: e.target.value})}
              >
                <option value="">Selecione um escritório</option>
                <option value="x">GLOBAL (Todos os Escritórios)</option>
                {state.escritorios.map(esc => (
                  <option key={esc.id} value={esc.id}>{esc.nome}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-app-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-app-text-muted hover:text-app-text transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Adicionar
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateProcessoModal({ isOpen, onClose, initialData }: { isOpen: boolean, onClose: () => void, initialData?: any }) {
  const { state, addProcesso, escritorioAtivoId, isAdmin, currentUser, hasPermission } = useAppContext();
  const isGlobalAdmin = isAdmin() && (escritorioAtivoId === "" || !escritorioAtivoId);
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
  const [isNewVaraModalOpen, setIsNewVaraModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [varaSearch, setVaraSearch] = useState('');
  const [showVaraResults, setShowVaraResults] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);

  const canWriteVara = hasPermission('varas', 'write');

  const getImportedTitle = (data: any) => {
    if (!data) return '';
    if (data.partes && data.partes.length > 0) {
      const activeParty = data.partes.find((p: any) => p.tipoPolo === 'Ativo')?.nome;
      const passiveParty = data.partes.find((p: any) => p.tipoPolo === 'Passivo')?.nome;
      if (activeParty && passiveParty) {
        return `${activeParty} X ${passiveParty}`;
      } else if (activeParty) {
        return activeParty;
      }
    }
    return data.orgaoJulgador || '';
  };

  const [formData, setFormData] = useState({
    numero: initialData?.numeroProcesso || '',
    clienteId: '',
    parteContraria: initialData?.partes?.find((p: any) => p.tipoPolo === 'Passivo')?.nome || '',
    tribunal: initialData?.tribunal || '',
    status: 'Ativo' as const,
    dataDistribuicao: initialData?.dataAjuizamento ? initialData.dataAjuizamento.split('T')[0] : new Date().toISOString().split('T')[0],
    titulo: getImportedTitle(initialData),
    instancia: '1 grau',
    varaId: '',
    classe: initialData?.classe || '',
    assunto: initialData?.assuntos?.[0] || '',
    valorCausa: initialData?.valorCausa || 0,
    link: initialData?.link || '',
    tags: '',
    pasta: '',
    tipo: 'Judicial',
    idProc: '',
    disponibilizacao: initialData?.disponibilizacao || '',
    publicacao: initialData?.publicacao || '',
    inicioPrazo: initialData?.inicioPrazoISO || initialData?.inicioPrazo || '',
    escritorioId: initialData?.escritorioId || escritorioAtivoId || ''
  });

  const [showTagSelector, setShowTagSelector] = useState(false);

  const formatCNJ = (numero: string) => {
    if (!numero) return '';
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  // Reset search states when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setVaraSearch('');
      setShowVaraResults(false);
      setClientSearch('');
      setShowClientResults(false);
      setFormError(null);
    }
  }, [isOpen]);

  // Update form if initialData changes
  React.useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        numero: formatCNJ(initialData.numeroProcesso || ''),
        parteContraria: initialData.partes?.find((p: any) => p.tipoPolo === 'Passivo')?.nome || '',
        tribunal: initialData.tribunal || '',
        dataDistribuicao: initialData.dataAjuizamento ? initialData.dataAjuizamento.split('T')[0] : new Date().toISOString().split('T')[0],
        titulo: getImportedTitle(initialData),
        classe: initialData.classe || '',
        assunto: initialData.assuntos?.[0] || '',
        valorCausa: initialData.valorCausa || 0,
        link: initialData.link || '',
        idProc: `PROC${Date.now().toString().slice(-6)}`,
        disponibilizacao: initialData.disponibilizacao || '',
        publicacao: initialData.publicacao || '',
        inicioPrazo: initialData.inicioPrazoISO || initialData.inicioPrazo || '',
        escritorioId: initialData.escritorioId || prev.escritorioId || escritorioAtivoId || ''
      }));
    }
  }, [initialData]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validar Título
    if (!formData.titulo || !formData.titulo.trim()) {
      setFormError('O campo "Título" é obrigatório.');
      setTimeout(() => {
        const elem = document.getElementById('modal_titulo_input');
        if (elem) {
          elem.focus();
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    // Validar Número do Processo
    if (!formData.numero || !formData.numero.trim()) {
      setFormError('O campo "Número do Processo" é obrigatório.');
      setTimeout(() => {
        const elem = document.getElementById('modal_numero_input');
        if (elem) {
          elem.focus();
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    addProcesso({
      id: formData.idProc || `PROC${Date.now().toString().slice(-6)}`,
      ...formData,
      escritorioId: formData.escritorioId || escritorioAtivoId || '',
      envolvidosIds: []
    } as any);
    
    onClose();
  };

  const availableEtiquetas = state.etiquetas.filter(e => 
    e.escritorioId === escritorioAtivoId || 
    e.escritorioId?.toUpperCase() === 'X'
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  const tagsArray = (formData.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const unselectedTags = availableEtiquetas.filter(tag => !tagsArray.includes(String(tag.id)));

  const filteredClientsForPrimary = React.useMemo(() => {
    if (clientSearch.length < 3) return [];
    return state.contatos.filter(c => 
      c.tipo === 'Cliente' && 
      (c.escritorioId === (formData.escritorioId || escritorioAtivoId) || c.escritorioId === 'X' || c.escritorioId === 'x' || !c.escritorioId) &&
      (c.nome.toLowerCase().includes(clientSearch.toLowerCase()) || 
       c.cpfCnpj.includes(clientSearch))
    ).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [state.contatos, clientSearch, formData.escritorioId, escritorioAtivoId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Processo" maxWidth="max-w-5xl">
      <form onSubmit={handleSave} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 px-1">
        {formError && (
          <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">Erro de Preenchimento</p>
              <p className="mt-1 text-xs opacity-90">{formError}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Informações Básicas */}
          <div className="md:col-span-3">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider border-b border-primary/10 pb-2 mb-4">
              Informações Básicas
            </h3>
            {isGlobalAdmin && (
              <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <label className="text-xs font-bold text-primary uppercase block mb-2">Escritório Responsável</label>
                <select 
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                  value={formData.escritorioId}
                  onChange={e => setFormData({...formData, escritorioId: e.target.value})}
                >
                  <option value="">Selecione um escritório</option>
                  <option value="x">GLOBAL (Todos os Escritórios)</option>
                  {state.escritorios.map(esc => (
                    <option key={esc.id} value={esc.id}>{esc.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted uppercase">ID PROC</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  value={formData.idProc}
                  onChange={e => setFormData({...formData, idProc: e.target.value})}
                  placeholder="Gerado automaticamente"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted uppercase">Número do Processo *</label>
                <input 
                  id="modal_numero_input"
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                  placeholder="Ex: 0000000-00.0000.0.00.0000"
                  value={formData.numero}
                  onChange={e => setFormData({...formData, numero: e.target.value})}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-medium text-app-text-muted uppercase">Título *</label>
                <input 
                  id="modal_titulo_input"
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  value={formData.titulo}
                  onChange={e => setFormData({...formData, titulo: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted uppercase">Status</label>
                <select 
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Detalhes Jurídicos */}
          <div className="md:col-span-3">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider border-b border-primary/10 pb-2 mb-4">
              Detalhes Jurídicos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted uppercase">Cliente *</label>
                <div className="relative">
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    placeholder="Digite pelo menos 3 letras..."
                    value={formData.clienteId ? (state.contatos.find(c => c.id === formData.clienteId)?.nome || clientSearch) : clientSearch}
                    onChange={e => {
                      setClientSearch(e.target.value);
                      setShowClientResults(true);
                      if (formData.clienteId) {
                        setFormData({...formData, clienteId: ''});
                      }
                    }}
                    onFocus={() => setShowClientResults(true)}
                  />
                  {showClientResults && clientSearch.length >= 3 && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setShowClientResults(false)} />
                      <div className="absolute top-full left-0 right-0 z-[70] mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {filteredClientsForPrimary.length > 0 ? (
                          filteredClientsForPrimary.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setFormData({...formData, clienteId: c.id});
                                setClientSearch(c.nome);
                                setShowClientResults(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-primary/10 text-app-text border-b border-app-border last:border-0 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-medium">{c.nome}</div>
                                <div className="text-[10px] text-app-text-muted">{c.cpfCnpj}</div>
                              </div>
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Selecionar</span>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-sm text-app-text-muted italic">
                            Nenhum cliente encontrado.
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setIsNewContactModalOpen(true);
                            setShowClientResults(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-primary font-bold hover:bg-primary/5 flex items-center border-t border-app-border bg-app-surface sticky bottom-0"
                        >
                          <Plus size={16} className="mr-2" />
                          CADASTRAR NOVO CLIENTE
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted uppercase">TIPO</label>
                <select 
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  value={formData.tipo}
                  onChange={e => setFormData({...formData, tipo: e.target.value})}
                >
                  <option value="Judicial">Judicial</option>
                  <option value="Administrativo">Administrativo</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted uppercase">Instância</label>
                <select 
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  value={formData.instancia}
                  onChange={e => setFormData({...formData, instancia: e.target.value})}
                >
                  <option value="1 grau">1 grau</option>
                  <option value="2 grau">2 grau</option>
                  <option value="Instancia Superior">Instancia Superior</option>
                </select>
              </div>
              <div className="space-y-1 relative">
                <label className="text-xs font-medium text-app-text-muted uppercase">Vara</label>
                <div className="relative">
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    placeholder="Digite pelo menos 2 letras..."
                    value={formData.varaId ? (state.varas.find(v => v.id === formData.varaId)?.nome || varaSearch) : varaSearch}
                    onChange={e => {
                      setVaraSearch(e.target.value);
                      setShowVaraResults(true);
                      if (formData.varaId) {
                        setFormData({...formData, varaId: '', tribunal: ''});
                      }
                    }}
                    onFocus={() => setShowVaraResults(true)}
                  />
                  {showVaraResults && varaSearch.length >= 2 && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setShowVaraResults(false)} />
                      <div className="absolute top-full left-0 right-0 z-[70] mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {canWriteVara && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsNewVaraModalOpen(true);
                              setShowVaraResults(false);
                            }}
                            className="w-full text-left px-3 py-2 text-primary font-bold hover:bg-app-secondary border-b border-app-border text-sm"
                          >
                            ++ CADASTRAR NOVO ++
                          </button>
                        )}
                        {state.varas
                          .filter(v => v.nome.toLowerCase().includes(varaSearch.toLowerCase()))
                          .map(v => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setFormData({...formData, varaId: v.id, tribunal: v.id});
                                setVaraSearch(v.nome);
                                setShowVaraResults(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-app-secondary text-sm text-app-text"
                            >
                              {v.nome}
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted uppercase">Classe</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  value={formData.classe}
                  onChange={e => setFormData({...formData, classe: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted uppercase">Assunto</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  value={formData.assunto}
                  onChange={e => setFormData({...formData, assunto: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* Dados Adicionais */}
          <div className="md:col-span-3">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider border-b border-primary/10 pb-2 mb-4">
              Financeiro e Datas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted uppercase">Valor da Causa</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-app-text-muted text-sm">R$</span>
                  <input 
                    type="number" 
                    className="w-full pl-9 pr-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    value={formData.valorCausa}
                    onChange={e => setFormData({...formData, valorCausa: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted uppercase">Data de Distribuição</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  value={formData.dataDistribuicao}
                  onChange={e => setFormData({...formData, dataDistribuicao: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted uppercase">Link</label>
                <input 
                  type="url" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  value={formData.link}
                  onChange={e => setFormData({...formData, link: e.target.value})}
                />
              </div>
              <div className="space-y-1 md:col-span-3">
                <label className="text-xs font-medium text-app-text-muted uppercase mb-1 block">Marcadores / Etiquetas</label>
                <div className="flex flex-wrap gap-2 p-3 bg-app-surface border border-app-border rounded-xl min-h-[52px] relative items-center">
                  {tagsArray.map(tagId => {
                    const tag = availableEtiquetas.find(t => String(t.id) === String(tagId));
                    if (!tag) return null;
                    return (
                      <div 
                        key={tag.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm"
                        style={{ backgroundColor: tag.cor || 'var(--primary)', color: '#fff' }}
                      >
                        {tag.nome.toUpperCase()}
                        <button 
                          type="button" 
                          onClick={() => {
                            const newTags = tagsArray.filter(id => id !== tagId);
                            setFormData({ ...formData, tags: newTags.join(',') });
                          }}
                          className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
                        >
                          <Plus size={14} className="rotate-45" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTagSelector(!showTagSelector)}
                      className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:opacity-90 transition-all shadow-md"
                    >
                      <Plus size={20} />
                    </button>
                    {showTagSelector && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setShowTagSelector(false)} />
                        <div className="absolute top-10 left-0 z-[70] w-56 bg-app-surface border border-app-border rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto">
                          <div className="text-[10px] font-extrabold text-app-text-muted uppercase px-2 py-1 border-b border-app-border mb-1">
                            Selecionar Marcador
                          </div>
                          <div className="space-y-1">
                            {unselectedTags.map(tag => (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => {
                                  const newTags = [...tagsArray, String(tag.id)];
                                  setFormData({ ...formData, tags: newTags.join(',') });
                                  setShowTagSelector(false);
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-app-secondary transition-colors text-xs font-bold flex items-center gap-2"
                              >
                                <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: tag.cor || 'var(--primary)' }} />
                                <span className="text-app-text">{tag.nome}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-app-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-app-text-muted hover:text-app-text transition-colors bg-app-secondary rounded-lg border border-app-border"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-all font-medium"
          >
            Adicionar aos Meus Processos
          </button>
        </div>
      </form>
      {isNewContactModalOpen && (
        <CreateContatoModal 
          isOpen={isNewContactModalOpen} 
          onClose={() => setIsNewContactModalOpen(false)} 
        />
      )}
      {isNewVaraModalOpen && (
        <CreateVaraModal 
          isOpen={isNewVaraModalOpen} 
          onClose={() => setIsNewVaraModalOpen(false)} 
        />
      )}
    </Modal>
  );
}

export function CreateContatoModal({ isOpen, onClose, initialData }: { isOpen: boolean, onClose: () => void, initialData?: any }) {
  const { state, addContato, escritorioAtivoId, isAdmin, currentUser } = useAppContext();
  const isGlobalAdmin = isAdmin() && (escritorioAtivoId === "" || !escritorioAtivoId);

  const userOfficeIds = (currentUser?.escritoriosIds || []).map(id => id.toString().trim().toUpperCase());
  const availableOffices = state.escritorios.filter(esc => 
    isAdmin() || userOfficeIds.includes(esc.id.toString().trim().toUpperCase())
  );
  const [formData, setFormData] = useState({
    nome: initialData?.nome || '',
    tipo: 'Cliente' as any,
    status: 'Ativo' as any,
    statusCivil: '',
    email: '',
    telefone: '',
    cpfCnpj: '',
    apelido: '',
    profissao: '',
    rg: '',
    endereco: '',
    cep: '',
    municipio: '',
    estado: '',
    dadosPagamento: initialData?.dadosPagamento || '',
    observacoes: initialData?.observacoes || '',
    escritorioId: escritorioAtivoId || ''
  });

  // Update form if initialData changes
  React.useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        nome: initialData.nome || '',
        tipo: initialData.tipo || 'Cliente',
        dadosPagamento: initialData.dadosPagamento || '',
        observacoes: initialData.observacoes || ''
      }));
    }
  }, [initialData]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return;
    
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const hr = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    const formattedDateTime = `${d}/${m}/${y} ${hr}:${min}:${sec}`;

    addContato({
      id: Math.random().toString(36).substr(2, 9),
      ...formData,
      dataCadastro: formattedDateTime
    });
    
    onClose();
    // Reset form
    setFormData({
      nome: '',
      tipo: 'Cliente',
      status: 'Ativo',
      statusCivil: '',
      email: '',
      telefone: '',
      cpfCnpj: '',
      apelido: '',
      profissao: '',
      rg: '',
      endereco: '',
      cep: '',
      municipio: '',
      estado: '',
      dadosPagamento: '',
      observacoes: '',
      escritorioId: escritorioAtivoId || ''
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Contato">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Nome *</label>
            <input 
              type="text" 
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.nome}
              onChange={e => setFormData({...formData, nome: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Tipo *</label>
            <select 
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.tipo}
              onChange={e => setFormData({...formData, tipo: e.target.value as any})}
            >
              <option value="Cliente">Cliente</option>
              <option value="Contato">Contato</option>
              <option value="Lead">Lead</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Apelido</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.apelido}
              onChange={e => setFormData({...formData, apelido: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Estado Civil</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.statusCivil}
              onChange={e => setFormData({...formData, statusCivil: e.target.value})}
              placeholder="Ex: Solteiro, Casado..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Status *</label>
            <select 
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value as any})}
            >
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Profissão</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.profissao}
              onChange={e => setFormData({...formData, profissao: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Email</label>
            <input 
              type="email" 
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Telefone</label>
            <input 
              type="tel" 
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.telefone}
              onChange={e => setFormData({...formData, telefone: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">CPF/CNPJ</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.cpfCnpj}
              onChange={e => setFormData({...formData, cpfCnpj: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">RG</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.rg}
              onChange={e => setFormData({...formData, rg: e.target.value})}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-app-text">Endereço</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.endereco}
              onChange={e => setFormData({...formData, endereco: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">CEP</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.cep}
              onChange={e => setFormData({...formData, cep: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Município</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.municipio || ''}
              onChange={e => setFormData({...formData, municipio: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Estado</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.estado || ''}
              onChange={e => setFormData({...formData, estado: e.target.value})}
              placeholder="Ex: AM, SP..."
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-app-text">Dados de Pagamento (Pix, Conta Bancária, etc.)</label>
            <textarea 
              rows={2}
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.dadosPagamento || ''}
              onChange={e => setFormData({...formData, dadosPagamento: e.target.value})}
              placeholder="Ex: Chave PIX: pix@email.com, Banco: Nubank, Conta: ..."
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-app-text">Observações</label>
            <textarea 
              rows={3}
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              value={formData.observacoes || ''}
              onChange={e => setFormData({...formData, observacoes: e.target.value})}
              placeholder="Observações adicionais ou resumo dos fatos..."
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-app-text flex items-center gap-1.5">
              <Building2 size={16} className="text-primary" />
              Escritório Responsável *
            </label>
            <select 
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
              value={formData.escritorioId || ''}
              onChange={e => setFormData({...formData, escritorioId: e.target.value})}
            >
              <option value="">Selecione um escritório</option>
              {(isAdmin() || isGlobalAdmin) && (
                <option value="x">GLOBAL (Todos os Escritórios)</option>
              )}
              {availableOffices.map(esc => (
                <option key={esc.id} value={esc.id}>{esc.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-app-text bg-app-secondary border border-app-border rounded-lg hover:bg-app-bg transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            className="px-4 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm"
          >
            Salvar Contato
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateVaraModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { state, addVara, escritorioAtivoId } = useAppContext();
  const [formData, setFormData] = useState({
    id: '',
    nome: '',
    forum: '',
    localizacao: '',
    telefone: '',
    email: '',
    balcaoVirtual: '',
    juiz: '',
    juiz_2: '',
    id_servidores: [] as string[],
    idTj: ''
  });

  const [forumSearch, setForumSearch] = useState('');
  const [showForumResults, setShowForumResults] = useState(false);

  // Pre-populate with a temporary random ID when modal opens, but allow the user to modify it.
  React.useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        id: 'VARA_' + Math.random().toString(36).substr(2, 5).toUpperCase()
      }));
    }
  }, [isOpen]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.id) return;
    
    addVara({
      ...formData,
      id: formData.id.trim().toUpperCase(),
      escritorioId: escritorioAtivoId || ''
    });
    
    onClose();
    // Reset form
    setFormData({
      id: '',
      nome: '',
      forum: '',
      localizacao: '',
      telefone: '',
      email: '',
      balcaoVirtual: '',
      juiz: '',
      juiz_2: '',
      id_servidores: [],
      idTj: ''
    });
    setForumSearch('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Vara" maxWidth="max-w-2xl">
      <form onSubmit={handleSave} className="space-y-4 text-left">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">ID da Vara (ID_VARA) *</label>
            <input 
              type="text" 
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
              placeholder="Ex: VARA_01"
              value={formData.id}
              onChange={e => setFormData({...formData, id: e.target.value.toUpperCase()})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Nome da Vara (VARA_NOME) *</label>
            <input 
              type="text" 
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
              placeholder="Ex: 1ª Vara Cível"
              value={formData.nome}
              onChange={e => setFormData({...formData, nome: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Tribunal Vinculado (ID_TJ)</label>
            <select
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm h-[40px]"
              value={formData.idTj}
              onChange={e => setFormData({...formData, idTj: e.target.value})}
            >
              <option value="">Selecione um tribunal...</option>
              {state.tribunais.map(t => (
                <option key={t.id} value={t.id}>{t.sigla || t.id} - {t.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 relative">
            <label className="text-sm font-medium text-app-text">ID do Fórum (ID_FORUM)</label>
            <div className="relative">
              <input 
                type="text" 
                className="w-full px-3 py-2 pl-10 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
                placeholder="Digite para buscar..."
                value={forumSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setForumSearch(val);
                  setShowForumResults(val.length >= 2);
                  if (!val) {
                    setFormData({...formData, forum: ''});
                  } else {
                    const currentForum = state.forums.find(f => f.id === formData.forum);
                    if (!currentForum || val !== currentForum.nome) {
                      setFormData({...formData, forum: val});
                    }
                  }
                }}
                onFocus={() => forumSearch.length >= 2 && setShowForumResults(true)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
              
              {showForumResults && forumSearch.length >= 2 && (
                <div className="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {state.forums
                    .filter(f => {
                      const normName = (f.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                      const normId = (f.id || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                      const normSearch = (forumSearch || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                      return normName.includes(normSearch) || normId.includes(normSearch);
                    })
                    .slice(0, 10)
                    .map(f => (
                      <button
                        key={f.id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-app-secondary/50 text-sm border-b border-app-border last:border-0 flex flex-col"
                        onClick={() => {
                          setFormData({ ...formData, forum: f.id });
                          setForumSearch(f.nome);
                          setShowForumResults(false);
                        }}
                      >
                        <span className="font-medium text-app-text">{f.nome}</span>
                        <span className="text-[10px] text-app-text-muted">ID: {f.id}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Localização (LOCALIZACAO)</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
              placeholder="Ex: 5º andar, sala 501"
              value={formData.localizacao}
              onChange={e => setFormData({...formData, localizacao: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Telefone (TEL01)</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
              placeholder="Ex: (11) 99999-9999"
              value={formData.telefone}
              onChange={e => setFormData({...formData, telefone: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">E-mail (EMAIL01)</label>
            <input 
              type="email" 
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
              placeholder="Ex: vara@tjam.jus.br"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Balcão Virtual (BALCAO01)</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
              placeholder="Link do Balcão Virtual"
              value={formData.balcaoVirtual}
              onChange={e => setFormData({...formData, balcaoVirtual: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Juiz Titular (JUIZ)</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
              placeholder="Nome do Juiz"
              value={formData.juiz}
              onChange={e => setFormData({...formData, juiz: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Juiz Auxiliar (JUIZ_2)</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
              placeholder="Nome do Juiz Auxiliar"
              value={formData.juiz_2}
              onChange={e => setFormData({...formData, juiz_2: e.target.value})}
            />
          </div>
          <div className="space-y-3 md:col-span-2">
            <label className="text-sm font-medium text-app-text">Servidores (ID_SERVIDORES)</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text text-sm"
              placeholder="IDs dos servidores (separados por vírgula)"
              value={formData.id_servidores?.join(', ')}
              onChange={e => setFormData({...formData, id_servidores: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)})}
            />
          </div>
        </div>
        <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-app-text bg-app-secondary border border-app-border rounded-lg hover:bg-app-bg transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            className="px-4 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm"
          >
            Salvar Vara
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateTribunalModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { addTribunal } = useAppContext();
  const [formData, setFormData] = useState({
    nome: '',
    endereco: '',
    tribunal: ''
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.tribunal) return;
    
    const sigla = formData.tribunal.trim().toUpperCase();
    
    addTribunal({
      nome: formData.nome,
      id: sigla,
      sigla: sigla
    });
    
    onClose();
    setFormData({ nome: '', endereco: '', tribunal: '' });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Tribunal (ID_TJ / NOME)">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-app-text">Sigla do Tribunal (ID_TJ) *</label>
          <input 
            type="text" 
            required
            className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            placeholder="Ex: TJAM, TRF1"
            value={formData.tribunal}
            onChange={e => setFormData({...formData, tribunal: e.target.value})}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-app-text">Nome do Tribunal (NOME) *</label>
          <input 
            type="text" 
            required
            className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            placeholder="Ex: Tribunal de Justiça do Amazonas"
            value={formData.nome}
            onChange={e => setFormData({...formData, nome: e.target.value})}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-app-text">Endereço</label>
          <input 
            type="text" 
            className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            value={formData.endereco}
            onChange={e => setFormData({...formData, endereco: e.target.value})}
          />
        </div>
        <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-app-text bg-app-secondary border border-app-border rounded-lg hover:bg-app-bg transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            className="px-4 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm"
          >
            Salvar Tribunal
          </button>
        </div>
      </form>
    </Modal>
  );
}
