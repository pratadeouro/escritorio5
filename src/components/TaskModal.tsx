
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context';
import { Link as LinkIcon, AlertCircle, Plus, Calendar } from 'lucide-react';
import Modal from './Modal';
import ProcessoSelect from './ProcessoSelect';
import { Tarefa } from '../types';
import { calculateDeadline, getTribunalHolidays } from '../utils/date';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit' | 'view';
  tarefa?: Tarefa | null;
  initialData?: Partial<Tarefa>;
}

export default function TaskModal({ isOpen, onClose, mode, tarefa, initialData }: TaskModalProps) {
  const { state, addTarefa, updateTarefa, escritorioAtivoId, isAdmin, currentUser } = useAppContext();
  
  const isGlobalAdmin = isAdmin() && (escritorioAtivoId === "" || !escritorioAtivoId);
  const canEdit = isAdmin() || (currentUser?.id && tarefa?.ID_USER === currentUser.id);

  const [formData, setFormData] = useState({
    PROCESSO_ID: '',
    PROC_NOME: '',
    VARA_ID: '',
    VARA_NOME: '',
    UPJ_NOME: '',
    RESPONSAVEL_ID: '',
    TITULO: '',
    DESCRICAO: '',
    DATA_CRIACAO: '',
    DATA_LIMITE: '',
    CONCLUSAO: '',
    PAGINA: '',
    STATUS: 'Pendente',
    PRIORIDADE: 'Média',
    LINK: '',
    prazo_tipo: 'Corridos',
    ID_ESCRITORIO: escritorioAtivoId || '',
    ATRIBUIDO_ID: '',
    // Deprecated fields kept in form state for compatibility during migration
    ID_PROC: '',
    'PROC.NOME': '',
    ID_VARA: '',
    'VARA.NOME': '',
    ID_USER: '',
    TAREFA: '',
    PRAZO_IN: '',
    PRAZO_FIM: ''
  });

  const [currentMode, setCurrentMode] = useState(mode);

  useEffect(() => {
    if (tarefa) {
      setFormData({
        PROCESSO_ID: tarefa.PROCESSO_ID || tarefa.ID_PROC || '',
        PROC_NOME: tarefa.PROC_NOME || tarefa['PROC.NOME'] || '',
        VARA_ID: tarefa.VARA_ID || tarefa.ID_VARA || '',
        VARA_NOME: tarefa.VARA_NOME || tarefa['VARA.NOME'] || '',
        UPJ_NOME: tarefa.UPJ_NOME || '',
        RESPONSAVEL_ID: tarefa.RESPONSAVEL_ID || tarefa.ID_USER || '',
        TITULO: tarefa.TITULO || tarefa.TAREFA || '',
        DESCRICAO: tarefa.DESCRICAO || '',
        DATA_CRIACAO: tarefa.DATA_CRIACAO || tarefa.PRAZO_IN || '',
        DATA_LIMITE: tarefa.DATA_LIMITE || tarefa.PRAZO_FIM || '',
        CONCLUSAO: tarefa.CONCLUSAO || '',
        PAGINA: tarefa.PAGINA || '',
        STATUS: tarefa.STATUS || 'Pendente',
        PRIORIDADE: tarefa.PRIORIDADE || 'Média',
        LINK: tarefa.LINK || '',
        prazo_tipo: tarefa.prazo_tipo || 'Corridos',
        ID_ESCRITORIO: tarefa.ID_ESCRITORIO || escritorioAtivoId || '',
        ATRIBUIDO_ID: tarefa.ATRIBUIDO_ID || '',
        // Old fields
        ID_PROC: tarefa.ID_PROC || tarefa.PROCESSO_ID || '',
        'PROC.NOME': tarefa['PROC.NOME'] || tarefa.PROC_NOME || '',
        ID_VARA: tarefa.ID_VARA || tarefa.VARA_ID || '',
        'VARA.NOME': tarefa['VARA.NOME'] || tarefa.VARA_NOME || '',
        ID_USER: tarefa.ID_USER || tarefa.RESPONSAVEL_ID || '',
        TAREFA: tarefa.TAREFA || tarefa.TITULO || '',
        PRAZO_IN: tarefa.PRAZO_IN || tarefa.DATA_CRIACAO || '',
        PRAZO_FIM: tarefa.PRAZO_FIM || tarefa.DATA_LIMITE || ''
      });
    } else if (initialData) {
      const baseData = {
        PROCESSO_ID: '',
        PROC_NOME: '',
        VARA_ID: '',
        VARA_NOME: '',
        UPJ_NOME: '',
        RESPONSAVEL_ID: '',
        TITULO: '',
        DESCRICAO: '',
        DATA_CRIACAO: '',
        DATA_LIMITE: '',
        CONCLUSAO: '',
        PAGINA: '',
        STATUS: 'Pendente',
        PRIORIDADE: 'Média',
        LINK: '',
        prazo_tipo: 'Corridos',
        ID_ESCRITORIO: escritorioAtivoId || '',
        ATRIBUIDO_ID: initialData.ATRIBUIDO_ID || currentUser?.id || '',
        ID_PROC: '',
        'PROC.NOME': '',
        ID_VARA: '',
        'VARA.NOME': '',
        ID_USER: '',
        TAREFA: '',
        PRAZO_IN: '',
        PRAZO_FIM: '',
        ...initialData
      };

      // Compatibility mapping
      if (initialData.ID_PROC && !initialData.PROCESSO_ID) baseData.PROCESSO_ID = initialData.ID_PROC;
      if (initialData.TAREFA && !initialData.TITULO) baseData.TITULO = initialData.TAREFA;
      if (initialData.PRAZO_FIM && !initialData.DATA_LIMITE) baseData.DATA_LIMITE = initialData.PRAZO_FIM;
      if (initialData.PRAZO_IN && !initialData.DATA_CRIACAO) baseData.DATA_CRIACAO = initialData.PRAZO_IN;

      // If initialData has PROCESSO_ID or ID_PROC, auto-fill related fields
      const procId = baseData.PROCESSO_ID || baseData.ID_PROC;
      if (procId) {
        const proc = state.processos.find(p => p.id === procId);
        if (proc) {
          const vara = state.varas.find(v => v.id === proc.varaId);
          const upj = state.upj.find(u => u.id === vara?.secretaria);
          baseData.VARA_ID = proc.varaId || '';
          baseData.VARA_NOME = vara?.nome || '';
          baseData.PROC_NOME = proc.numero || '';
          baseData.UPJ_NOME = upj?.nome || (vara as any)?.UPJ || (vara as any)?.UPJ_NOME || '';
          
          // Old fields too
          baseData.ID_VARA = baseData.VARA_ID;
          baseData['VARA.NOME'] = baseData.VARA_NOME;
          baseData['PROC.NOME'] = baseData.PROC_NOME;
        }
      }
      setFormData(baseData);
    } else {
      setFormData({
        PROCESSO_ID: '',
        PROC_NOME: '',
        VARA_ID: '',
        VARA_NOME: '',
        UPJ_NOME: '',
        RESPONSAVEL_ID: '',
        TITULO: '',
        DESCRICAO: '',
        DATA_CRIACAO: '',
        DATA_LIMITE: '',
        CONCLUSAO: '',
        PAGINA: '',
        STATUS: 'Pendente',
        PRIORIDADE: 'Média',
        LINK: '',
        prazo_tipo: 'Corridos',
        ID_ESCRITORIO: escritorioAtivoId || '',
        ATRIBUIDO_ID: currentUser?.id || '',
        ID_PROC: '',
        'PROC.NOME': '',
        ID_VARA: '',
        'VARA.NOME': '',
        ID_USER: '',
        TAREFA: '',
        PRAZO_IN: '',
        PRAZO_FIM: ''
      });
    }
    setCurrentMode(mode);
  }, [tarefa, initialData, mode, escritorioAtivoId, state.processos, state.varas, state.upj, isOpen, currentUser]);

  const handleCalculateDeadline = (days: number) => {
    const dataCriacao = formData.DATA_CRIACAO || formData.PRAZO_IN;
    if (!dataCriacao) {
      alert('Selecione uma data de início primeiro');
      return;
    }

    const tribunal = (initialData as any)?.TRIBUNAL || state.processos.find(p => p.id === (formData.PROCESSO_ID || formData.ID_PROC))?.tribunal || 'TJ';
    const holidays = getTribunalHolidays(state.calendario, tribunal);
    
    const deadline = calculateDeadline(
      dataCriacao,
      days,
      formData.prazo_tipo || 'Corridos',
      holidays
    );

    setFormData(prev => ({
      ...prev,
      DATA_LIMITE: deadline,
      PRAZO_FIM: deadline
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const titulo = formData.TITULO || formData.TAREFA;
    if (!titulo) return;
    
    const selectedProcesso = state.processos.find(p => p.id === (formData.PROCESSO_ID || formData.ID_PROC));
    const selectedVara = state.varas.find(v => v.id === (formData.VARA_ID || formData.ID_VARA));

    const finalData = {
      ...formData,
      TITULO: titulo,
      TAREFA: titulo,
      PROCESSO_ID: formData.PROCESSO_ID || formData.ID_PROC,
      ID_PROC: formData.PROCESSO_ID || formData.ID_PROC,
      PROC_NOME: selectedProcesso?.numero || formData.PROC_NOME || formData['PROC.NOME'] || '',
      'PROC.NOME': selectedProcesso?.numero || formData.PROC_NOME || formData['PROC.NOME'] || '',
      VARA_ID: selectedVara?.id || formData.VARA_ID || formData.ID_VARA || '',
      ID_VARA: selectedVara?.id || formData.VARA_ID || formData.ID_VARA || '',
      VARA_NOME: selectedVara?.nome || formData.VARA_NOME || formData['VARA.NOME'] || '',
      'VARA.NOME': selectedVara?.nome || formData.VARA_NOME || formData['VARA.NOME'] || '',
      RESPONSAVEL_ID: formData.RESPONSAVEL_ID || formData.ID_USER,
      ID_USER: formData.RESPONSAVEL_ID || formData.ID_USER,
      DATA_CRIACAO: formData.DATA_CRIACAO || formData.PRAZO_IN,
      PRAZO_IN: formData.DATA_CRIACAO || formData.PRAZO_IN,
      DATA_LIMITE: formData.DATA_LIMITE || formData.PRAZO_FIM,
      PRAZO_FIM: formData.DATA_LIMITE || formData.PRAZO_FIM,
      ID_ESCRITORIO: formData.ID_ESCRITORIO || escritorioAtivoId || '',
      ATRIBUIDO_ID: formData.ATRIBUIDO_ID || currentUser?.id || ''
    };

    if (currentMode === 'create') {
      addTarefa({
        ID_TAREFA: `TAR_${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
        ...finalData
      } as any);
    } else if (currentMode === 'edit' && tarefa) {
      updateTarefa({
        ...tarefa,
        ...finalData
      } as any);
    }
    
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={currentMode === 'create' ? 'Nova Tarefa' : currentMode === 'edit' ? 'Editar Tarefa' : 'Detalhes da Tarefa'}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-app-text">Título da Tarefa *</label>
            <input 
              required
              disabled={currentMode === 'view'}
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all"
              placeholder="Ex: Protocolar Petição Inicial"
              value={formData.TITULO}
              onChange={e => setFormData({...formData, TITULO: e.target.value})}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-app-text">Descrição</label>
            <textarea 
              disabled={currentMode === 'view'}
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all resize-none"
              placeholder="Detalhes da tarefa..."
              rows={3}
              value={formData.DESCRICAO}
              onChange={e => setFormData({...formData, DESCRICAO: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Processo *</label>
            <ProcessoSelect
              disabled={currentMode === 'view'}
              value={formData.PROCESSO_ID || formData.ID_PROC}
              onChange={procId => {
                const proc = state.processos.find(p => p.id === procId);
                const vara = state.varas.find(v => v.id === proc?.varaId);
                const upj = state.upj.find(u => u.id === vara?.secretaria);
                setFormData({
                  ...formData, 
                  PROCESSO_ID: procId,
                  ID_PROC: procId,
                  VARA_ID: proc?.varaId || '',
                  ID_VARA: proc?.varaId || '',
                  VARA_NOME: vara?.nome || '',
                  'VARA.NOME': vara?.nome || '',
                  PROC_NOME: proc?.numero || '',
                  'PROC.NOME': proc?.numero || '',
                  UPJ_NOME: upj?.nome || (vara as any)?.UPJ || (vara as any)?.UPJ_NOME || ''
                });
              }}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Vara</label>
            {(() => {
              const procId = formData.PROCESSO_ID || formData.ID_PROC;
              const proc = state.processos.find(p => p.id === procId);
              const varaId = formData.VARA_ID || formData.ID_VARA || proc?.varaId;
              const vara = state.varas.find(v => v.id === varaId);
              const varaNome = vara?.nome || formData.VARA_NOME || formData['VARA.NOME'];
              
              return (
                <div className={`w-full px-3 py-2 border border-app-border bg-app-bg text-app-text-muted rounded-lg text-sm min-h-[42px] flex items-center ${!varaNome ? 'italic opacity-60' : ''}`}>
                  {varaNome || (procId ? 'Localização não definida' : 'Selecione o processo')}
                </div>
              );
            })()}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Prioridade</label>
            <select 
              disabled={currentMode === 'view'}
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all"
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
            <label className="text-sm font-medium text-app-text">Status</label>
            <select 
              disabled={currentMode === 'view'}
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all"
              value={formData.STATUS}
              onChange={e => {
                const newStatus = e.target.value;
                let newConclusao = formData.CONCLUSAO;
                if (newStatus === 'Concluída' && !newConclusao) {
                  newConclusao = new Date().toISOString().split('T')[0];
                } else if (newStatus !== 'Concluída') {
                  newConclusao = '';
                }
                setFormData({...formData, STATUS: newStatus, CONCLUSAO: newConclusao});
              }}
            >
              <option value="Pendente">Pendente</option>
              <option value="Em Andamento">Em Andamento</option>
              <option value="Concluída">Concluída</option>
              <option value="Aguardando Terceiros">Aguardando Terceiros</option>
            </select>
          </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">
                {currentMode === 'view' ? 'Criado em' : 'Data Início'}
              </label>
              <input 
                type="date" 
                disabled={currentMode === 'view'}
                className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all font-medium"
                value={formData.DATA_CRIACAO || formData.PRAZO_IN}
                onChange={e => setFormData({...formData, DATA_CRIACAO: e.target.value, PRAZO_IN: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Tipo de Prazo</label>
              <select 
                disabled={currentMode === 'view'}
                className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all font-medium"
                value={formData.prazo_tipo}
                onChange={e => setFormData({...formData, prazo_tipo: e.target.value})}
              >
                <option value="Corridos">Dias Corridos</option>
                <option value="Úteis">Dias Úteis</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Data Limite (Prazo Final)</label>
              <div className="space-y-2">
                <input 
                  type="date" 
                  disabled={currentMode === 'view'}
                  className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all font-bold text-primary"
                  value={formData.DATA_LIMITE || formData.PRAZO_FIM}
                  onChange={e => setFormData({...formData, DATA_LIMITE: e.target.value, PRAZO_FIM: e.target.value})}
                />
                {currentMode !== 'view' && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {[5, 10, 15].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => handleCalculateDeadline(days)}
                        className="flex-1 py-1.5 px-2 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap"
                        title={`Calcular ${days} ${formData.prazo_tipo?.toLowerCase() === 'úteis' ? 'dias úteis' : 'dias corridos'}`}
                      >
                        +{days} {formData.prazo_tipo?.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">UPJ / Secretaria</label>
            {(() => {
              const varaId = formData.VARA_ID || formData.ID_VARA;
              const vara = state.varas.find(v => v.id === varaId);
              const upj = state.upj.find(u => u.id === vara?.secretaria);
              const upjNome = upj?.nome || formData.UPJ_NOME;
              
              return (
                <div className={`w-full px-3 py-2 border border-app-border bg-app-bg text-app-text-muted rounded-lg text-sm min-h-[42px] flex items-center ${!upjNome ? 'italic opacity-60' : ''}`}>
                  {upjNome || (formData.PROCESSO_ID || formData.ID_PROC ? 'Secretaria não definida' : 'Selecione o processo')}
                </div>
              );
            })()}
          </div>
          {isGlobalAdmin && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Escritório</label>
              <select 
                disabled={currentMode === 'view'}
                className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all font-medium"
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
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Responsável</label>
            <select 
              disabled={currentMode === 'view'}
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all font-medium"
              value={formData.RESPONSAVEL_ID || formData.ID_USER}
              onChange={e => setFormData({...formData, RESPONSAVEL_ID: e.target.value, ID_USER: e.target.value})}
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
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Criado por</label>
            <select 
              disabled={currentMode === 'view'}
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all font-medium"
              value={formData.ATRIBUIDO_ID}
              onChange={e => setFormData({...formData, ATRIBUIDO_ID: e.target.value})}
            >
              <option value="">Selecione quem criou</option>
              {state.usuarios
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Página</label>
            <input 
              disabled={currentMode === 'view'}
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all"
              placeholder="Página..."
              value={formData.PAGINA}
              onChange={e => setFormData({...formData, PAGINA: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Data Conclusão</label>
            <input 
              type="date" 
              disabled={currentMode === 'view'}
              className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60 transition-all"
              value={formData.CONCLUSAO}
              onChange={e => setFormData({...formData, CONCLUSAO: e.target.value})}
            />
          </div>
        </div>

        {(() => {
          const procId = formData.PROCESSO_ID || formData.ID_PROC;
          const proc = state.processos.find(p => p.id === procId);
          if (proc?.link) {
            return (
              <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center text-sm text-primary font-medium">
                  <LinkIcon size={16} className="mr-2" />
                  Link do Processo disponível
                </div>
                <a 
                  href={proc.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm font-medium"
                >
                  Acessar <LinkIcon size={12} />
                </a>
              </div>
            );
          }
          return null;
        })()}

        <div className="pt-6 flex justify-end space-x-3 border-t border-app-border">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-app-secondary text-app-text rounded-lg hover:bg-app-bg transition-colors"
          >
            {currentMode === 'view' ? 'Fechar' : 'Cancelar'}
          </button>
          
          {currentMode !== 'view' && (
            <button 
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors shadow-sm font-medium"
            >
              {currentMode === 'create' ? 'Adicionar' : 'Salvar Alterações'}
            </button>
          )}
          {currentMode === 'view' && canEdit && (
            <button 
              type="button"
              onClick={() => setCurrentMode('edit')}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors shadow-sm font-medium"
            >
              Editar
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
