
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context';
import { FileText, Link as LinkIcon, Users, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import Modal from './Modal';
import ProcessoSelect from './ProcessoSelect';
import { Recurso, Envolvido } from '../types';

interface RecursoModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurso?: Recurso | null;
  readOnly?: boolean;
}

export default function RecursoModal({ isOpen, onClose, recurso, readOnly: propReadOnly }: RecursoModalProps) {
  const { state, addRecurso, updateRecurso, addEnvolvimento, deleteEnvolvimento, escritorioAtivoId, isAdmin, hasPermission } = useAppContext();
  const isGlobalAdmin = isAdmin() && (escritorioAtivoId === "" || !escritorioAtivoId);
  const canWrite = hasPermission('recursos', 'write');
  const readOnly = propReadOnly !== undefined ? propReadOnly : !canWrite;

  const [varaSearch, setVaraSearch] = useState('');
  const [showVaraResults, setShowVaraResults] = useState(false);
  
  const [selectedContactToAdd, setSelectedContactToAdd] = useState('');
  const [selectedTipoEnvolvimento, setSelectedTipoEnvolvimento] = useState('');
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [showContactResults, setShowContactResults] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);

  const [formData, setFormData] = useState<Partial<Recurso>>({
    processoOriginarioId: '',
    status: 'Ativo',
    escritorioId: escritorioAtivoId || '',
    envolvidosIds: []
  });

  const tagsArray = React.useMemo(() => (formData.marcador || '').split(',').map(t => t.trim()).filter(Boolean), [formData.marcador]);
  const availableEtiquetas = React.useMemo(() => {
    return state.etiquetas.filter(e => !e.escritorioId || e.escritorioId.toLowerCase() === 'x' || e.escritorioId === (formData.escritorioId || escritorioAtivoId));
  }, [state.etiquetas, formData.escritorioId, escritorioAtivoId]);
  const unselectedTags = React.useMemo(() => {
    return availableEtiquetas.filter(tag => {
      const tagIdStr = String(tag.id);
      const tagNameLower = tag.nome.toLowerCase();
      return !tagsArray.some(part => part === tagIdStr || part.toLowerCase() === tagNameLower);
    });
  }, [availableEtiquetas, tagsArray]);

  useEffect(() => {
    if (recurso) {
      setFormData(recurso);
      if (recurso.orgaoJulgadorId) {
        const vara = state.varas.find(v => v.id === recurso.orgaoJulgadorId);
        setVaraSearch(vara?.nome || recurso.secao || '');
      } else {
        setVaraSearch(recurso.secao || '');
      }
    } else {
      setFormData({
        processoOriginarioId: '',
        recursoOriginario: '',
        classe: '',
        assunto: '',
        secao: '',
        orgaoJulgadorId: '',
        area: '',
        relatorId: '',
        link: '',
        marcador: '',
        resultado: '',
        status: 'Ativo',
        escritorioId: escritorioAtivoId || '',
        envolvidosIds: []
      });
      setVaraSearch('');
    }
    // Determinar um ID para o recurso se for novo, para vincular envolvidos
    if (!recurso && isOpen) {
      const tempId = Math.random().toString(36).substr(2, 9);
      setFormData(prev => ({ ...prev, id: tempId }));
    }
  }, [recurso, isOpen, escritorioAtivoId, state.varas]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.processoOriginarioId || !formData.classe) {
      alert('Processo Originário e Classe são obrigatórios');
      return;
    }

    if (recurso) {
      updateRecurso({ ...recurso, ...formData } as Recurso);
    } else {
      addRecurso({
        ...formData,
        escritorioId: formData.escritorioId || escritorioAtivoId || '',
        secao: formData.secao || '',
        orgaoJulgadorId: formData.orgaoJulgadorId || '',
        area: formData.area || '',
        relatorId: formData.relatorId || '',
        status: formData.status || 'Ativo',
        envolvidosIds: formData.envolvidosIds || []
      } as Recurso);
    }
    
    onClose();
  };

  const filteredContacts = state.contatos.filter(c => {
    const normName = (c.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normSearch = (contactSearchTerm || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const matchesSearch = normName.includes(normSearch) || 
                         c.cpfCnpj.includes(contactSearchTerm);
    const notAlreadyAdded = !(formData.envolvidosIds || []).includes(c.id);
    return matchesSearch && notAlreadyAdded;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={readOnly ? "Visualizar Recurso" : (recurso ? "Editar Recurso" : "Novo Recurso")} maxWidth="max-w-4xl">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-app-secondary/20 p-4 rounded-xl border border-app-border space-y-4">
          <h3 className="text-sm font-semibold text-app-text flex items-center">
            <FileText className="mr-2 text-primary" size={18} />
            Dados Básicos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text">Processo Originário *</label>
              <ProcessoSelect
                value={formData.processoOriginarioId || ''}
                onChange={id => setFormData({...formData, processoOriginarioId: id})}
                required
                disabled={readOnly}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Classe *</label>
              <input 
                type="text" 
                required
                disabled={readOnly}
                className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-70 disabled:cursor-not-allowed"
                value={formData.classe || ''}
                onChange={e => setFormData({...formData, classe: e.target.value})}
                placeholder="Ex: Apelação Cível"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Assunto</label>
              <input 
                type="text" 
                disabled={readOnly}
                className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-70 disabled:cursor-not-allowed"
                value={formData.assunto || ''}
                onChange={e => setFormData({...formData, assunto: e.target.value})}
                placeholder="Ex: Danos Morais"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Recurso Originário (ID)</label>
              <input 
                type="text" 
                disabled={readOnly}
                className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-70 disabled:cursor-not-allowed"
                value={formData.recursoOriginario || ''}
                onChange={e => setFormData({...formData, recursoOriginario: e.target.value})}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Seção / Órgão</label>
              <div className="relative">
                <input 
                  type="text" 
                  disabled={readOnly}
                  className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-70 disabled:cursor-not-allowed"
                  placeholder="Busque pela Vara/Órgão (mín. 2 letras)"
                  value={varaSearch}
                  onChange={e => {
                    setVaraSearch(e.target.value);
                    setShowVaraResults(true);
                    setFormData(prev => ({ ...prev, secao: e.target.value, orgaoJulgadorId: '' }));
                  }}
                  onFocus={() => !readOnly && setShowVaraResults(true)}
                />
                {showVaraResults && varaSearch.length >= 2 && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowVaraResults(false)} />
                    <div className="absolute top-full left-0 right-0 z-[70] mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {state.varas
                        .filter(v => {
                          const normName = (v.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                          const normSearch = (varaSearch || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                          return normName.includes(normSearch);
                        })
                        .map(v => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, orgaoJulgadorId: v.id, secao: v.nome }));
                              setVaraSearch(v.nome);
                              setShowVaraResults(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-app-secondary text-sm text-app-text"
                          >
                            {v.nome}
                          </button>
                        ))}
                      {state.varas.filter(v => {
                        const normName = (v.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        const normSearch = (varaSearch || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        return normName.includes(normSearch);
                      }).length === 0 && (
                        <div className="px-3 py-2 text-sm text-app-text-muted">Nenhuma vara encontrada. Mantendo texto digitado.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Relator</label>
              <select 
                disabled={readOnly}
                className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-70 disabled:cursor-not-allowed"
                value={formData.relatorId || ''}
                onChange={e => setFormData({...formData, relatorId: e.target.value})}
              >
                <option value="">Selecione um relator</option>
                {state.julgadores
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map(j => (
                    <option key={j.id} value={j.id}>{j.nome}</option>
                  ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Status</label>
              <select 
                disabled={readOnly}
                className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-70 disabled:cursor-not-allowed"
                value={formData.status || 'Ativo'}
                onChange={e => setFormData({...formData, status: e.target.value as any})}
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-app-text-muted uppercase mb-1 block">Marcadores (Etiquetas)</label>
              <div className="flex flex-wrap gap-2 p-3 bg-app-surface border border-app-border rounded-xl min-h-[52px] relative items-center">
                {tagsArray.map((part, idx) => {
                  let tag = state.etiquetas.find(t => String(t.id) === part);
                  if (!tag) {
                    tag = state.etiquetas.find(t => t.nome.toLowerCase() === part.toLowerCase());
                  }
                  if (!tag) {
                    return (
                      <div 
                        key={idx}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm"
                        style={{ backgroundColor: '#4b5563', color: '#fff' }}
                      >
                        {part.toUpperCase()}
                        {!readOnly && (
                          <button 
                            type="button" 
                            onClick={() => {
                              const newTags = tagsArray.filter((_, i) => i !== idx);
                              setFormData({ ...formData, marcador: newTags.join(',') });
                            }}
                            className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
                          >
                            <Plus size={14} className="rotate-45" />
                          </button>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div 
                      key={tag.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm animate-in fade-in zoom-in duration-200"
                      style={{ backgroundColor: tag.cor || 'var(--primary)', color: '#fff' }}
                    >
                      {tag.nome.toUpperCase()}
                      {!readOnly && (
                        <button 
                          type="button" 
                          onClick={() => {
                            const newTags = tagsArray.filter(id => id !== String(tag!.id) && id.toLowerCase() !== tag!.nome.toLowerCase());
                            setFormData({ ...formData, marcador: newTags.join(',') });
                          }}
                          className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
                        >
                          <Plus size={14} className="rotate-45" />
                        </button>
                      )}
                    </div>
                  );
                })}
                
                {!readOnly && (
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
                          <div className="space-y-1 font-sans">
                            {unselectedTags.length === 0 ? (
                              <div className="text-xs text-app-text-muted p-2 text-center">Nenhum marcador disponível</div>
                            ) : (
                              unselectedTags.map(tag => (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => {
                                    const newTags = [...tagsArray, String(tag.id)];
                                    setFormData({ ...formData, marcador: newTags.join(',') });
                                    setShowTagSelector(false);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-app-secondary transition-colors text-xs font-bold flex items-center gap-2"
                                >
                                  <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: tag.cor || 'var(--primary)' }} />
                                  <span className="text-app-text">{tag.nome}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {tagsArray.length === 0 && readOnly && (
                  <span className="text-xs text-app-text-muted italic">Nenhum marcador selecionado</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Resultado</label>
              <input 
                type="text" 
                disabled={readOnly}
                className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-70 disabled:cursor-not-allowed"
                value={formData.resultado || ''}
                onChange={e => setFormData({...formData, resultado: e.target.value})}
                placeholder="Ex: Provido, Improvido"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text">Link do Processo</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                <input 
                  type="url" 
                  disabled={readOnly}
                  className="w-full pl-10 pr-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-70 disabled:cursor-not-allowed"
                  value={formData.link || ''}
                  onChange={e => setFormData({...formData, link: e.target.value})}
                  placeholder="https://..."
                />
              </div>
            </div>

            {isGlobalAdmin && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text">Escritório</label>
                <select 
                  disabled={readOnly}
                  className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-70 disabled:cursor-not-allowed"
                  value={formData.escritorioId || ''}
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
        </div>

        <div className="bg-app-secondary/20 p-4 rounded-xl border border-app-border space-y-4">
          <h3 className="text-sm font-semibold text-app-text flex items-center">
            <Users className="mr-2 text-primary" size={18} />
            {readOnly ? "Partes do Recurso" : "Partes do Recurso"}
          </h3>
          
          {!readOnly && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="relative">
                <label className="text-xs font-medium text-app-text-muted mb-1 block">Buscar Contato</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                  <input 
                    type="text" 
                    className="w-full pl-9 pr-3 py-2 bg-app-surface border border-app-border text-app-text text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Nome ou CPF/CNPJ"
                    value={contactSearchTerm}
                    onChange={e => {
                      setContactSearchTerm(e.target.value);
                      setShowContactResults(true);
                    }}
                    onFocus={() => setShowContactResults(true)}
                  />
                  {showContactResults && contactSearchTerm.length > 0 && (
                    <>
                      <div className="fixed inset-0 z-50" onClick={() => setShowContactResults(false)} />
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {filteredContacts.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedContactToAdd(c.id);
                              setContactSearchTerm(c.nome);
                              setShowContactResults(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-app-bg text-sm text-app-text"
                          >
                            <div className="font-medium">{c.nome}</div>
                            <div className="text-xs text-app-text-muted">{c.cpfCnpj}</div>
                          </button>
                        ))}
                        {filteredContacts.length === 0 && (
                          <div className="px-3 py-2 text-sm text-app-text-muted">Nenhum contato encontrado.</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-app-text-muted mb-1 block">Tipo de Envolvimento</label>
                <select 
                  className="w-full px-3 py-2 bg-app-surface border border-app-border text-app-text text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={selectedTipoEnvolvimento}
                  onChange={e => setSelectedTipoEnvolvimento(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {state.tipoEnvolvimentos
                    .sort((a, b) => {
                      const isDefaultA = a.id === 'apelante' || a.id === 'apelado';
                      const isDefaultB = b.id === 'apelante' || b.id === 'apelado';
                      if (isDefaultA && !isDefaultB) return 1;
                      if (!isDefaultA && isDefaultB) return -1;
                      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
                    })
                    .map(t => (
                      <option key={t.id} value={t.nome}>{t.nome}</option>
                    ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedContactToAdd && selectedTipoEnvolvimento) {
                      const envId = Math.random().toString(36).substr(2, 9);
                      const recId = formData.id || (recurso?.id) || '';
                      
                      addEnvolvimento({
                        id: envId,
                        contatoId: selectedContactToAdd,
                        recursoId: recId,
                        tipoEnvolvimento: selectedTipoEnvolvimento,
                        escritorioId: escritorioAtivoId || 'x'
                      });
                      
                      setFormData(prev => ({
                        ...prev,
                        envolvidosIds: [...(prev.envolvidosIds || []), selectedContactToAdd]
                      }));
                      
                      setSelectedContactToAdd('');
                      setContactSearchTerm('');
                      setSelectedTipoEnvolvimento('');
                    }
                  }}
                  disabled={!selectedContactToAdd || !selectedTipoEnvolvimento}
                  className="w-full bg-primary text-white py-2 rounded-lg hover:opacity-90 transition-all font-medium flex items-center justify-center disabled:opacity-50"
                >
                  <UserPlus size={18} className="mr-2" /> Adicionar Parte
                </button>
              </div>
            </div>
          )}

          <div className="border border-app-border rounded-xl overflow-hidden bg-app-surface">
            <table className="w-full text-sm">
              <thead className="bg-app-secondary/50 text-app-text-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Nome</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {(!formData.envolvidosIds || formData.envolvidosIds.length === 0) ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-app-text-muted italic">
                      Nenhuma parte vinculada a este recurso.
                    </td>
                  </tr>
                ) : (
                  formData.envolvidosIds.map((id, index) => {
                    const contato = state.contatos.find(c => c.id === id);
                    const envolvimento = state.envolvidos.find(e => 
                      String(e.recursoId) === String(formData.id || recurso?.id) && 
                      String(e.contatoId) === String(id)
                    );
                    
                    return (
                      <tr key={`${id}-${index}`}>
                        <td className="px-4 py-2 font-medium">{contato?.nome || id}</td>
                        <td className="px-4 py-2 text-primary">{envolvimento?.tipoEnvolvimento || '-'}</td>
                        <td className="px-4 py-2 text-right">
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  envolvidosIds: (prev.envolvidosIds || []).filter(eid => eid !== id)
                                }));
                                if (envolvimento) {
                                  deleteEnvolvimento(envolvimento.id);
                                }
                              }}
                              className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
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

        <div className="pt-6 flex justify-end space-x-3 border-t border-app-border">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-app-secondary text-app-text rounded-lg hover:bg-app-bg transition-colors"
          >
            {readOnly ? "Fechar" : "Cancelar"}
          </button>
          {!readOnly && (
            <button 
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors shadow-sm font-medium"
            >
              {recurso ? "Salvar Alterações" : "Adicionar Recurso"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
