import React, { useState } from 'react';
import { useAppContext } from '../context';
import { FileText, Search, ExternalLink, Filter, Tag, Plus, Eye, Edit2, Trash2, Link as LinkIcon } from 'lucide-react';
import Modal from '../components/Modal';
import { Modelo } from '../types';

export default function Modelos() {
  const { state, addModelo, updateModelo, deleteModelo, hasPermission, escritorioAtivoId, isAdmin, currentUser } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMateria, setSelectedMateria] = useState<string>('Todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedModelo, setSelectedModelo] = useState<Modelo | null>(null);

  const [novoModelo, setNovoModelo] = useState<Partial<Modelo>>({
    nome: '',
    fase: '',
    materia: '',
    link: '',
    escritorioId: ''
  });

  const getOfficeName = (escritorioId?: string) => {
    if (!escritorioId || escritorioId.toLowerCase() === 'x') {
      return 'Global (Todos)';
    }
    const esc = state.escritorios.find(e => e.id === escritorioId);
    return esc ? esc.nome : 'Não especificado';
  };

  const materias = ['Todas', ...Array.from(new Set(state.modelos.filter(m => {
    const isGlobal = m.escritorioId?.toLowerCase() === 'x';
    if (isGlobal) return true;
    if (escritorioAtivoId && m.escritorioId === escritorioAtivoId) return true;
    if (!escritorioAtivoId && (isAdmin() || (currentUser?.escritoriosIds || []).includes(m.escritorioId))) return true;
    return false;
  }).map(m => m.materia).filter(Boolean)))];

  const filteredModelos = state.modelos.filter(m => {
    const isGlobal = m.escritorioId?.toLowerCase() === 'x';
    if (escritorioAtivoId && m.escritorioId !== escritorioAtivoId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && !(currentUser?.escritoriosIds || []).includes(m.escritorioId)) return false;
    
    const matchesSearch = m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         m.fase.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMateria = selectedMateria === 'Todas' || m.materia === selectedMateria;
    return matchesSearch && matchesMateria;
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoModelo.nome) return;
    
    addModelo({
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      nome: novoModelo.nome || '',
      fase: novoModelo.fase || '',
      materia: novoModelo.materia || '',
      link: novoModelo.link || '',
      escritorioId: novoModelo.escritorioId || escritorioAtivoId || 'x'
    });
    setIsModalOpen(false);
    resetNovoModelo();
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModelo || !selectedModelo.nome) return;
    
    const updated: Modelo = {
      ...selectedModelo,
      escritorioId: selectedModelo.escritorioId || escritorioAtivoId || 'x'
    };
    updateModelo(updated);
    setIsEditModalOpen(false);
    setSelectedModelo(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este modelo?')) {
      deleteModelo(id);
      setIsViewModalOpen(false);
      setSelectedModelo(null);
    }
  };

  const resetNovoModelo = () => {
    setNovoModelo({
      nome: '',
      fase: '',
      materia: '',
      link: '',
      escritorioId: ''
    });
  };

  const openViewModal = (modelo: Modelo) => {
    setSelectedModelo(modelo);
    setIsViewModalOpen(true);
  };

  const openEditModal = (modelo: Modelo) => {
    setSelectedModelo({ ...modelo });
    setIsEditModalOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <FileText className="mr-3 text-primary" />
          Modelos de Documentos
        </h1>
        {hasPermission('modelos', 'write') && (
          <button 
            onClick={() => {
              resetNovoModelo();
              setIsModalOpen(true);
            }}
            className="bg-primary hover:opacity-90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Modelo
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="p-4 border-b border-app-border flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou fase..." 
              className="w-full pl-10 pr-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-app-secondary text-app-text placeholder-app-text-muted"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-app-text-muted" />
            <select 
              className="bg-app-secondary border border-app-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-app-text"
              value={selectedMateria}
              onChange={(e) => setSelectedMateria(e.target.value)}
            >
              {materias.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-app-secondary border-b border-app-border">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-app-text-muted uppercase tracking-wider">Modelo</th>
                <th className="px-6 py-4 text-xs font-semibold text-app-text-muted uppercase tracking-wider">Fase</th>
                <th className="px-6 py-4 text-xs font-semibold text-app-text-muted uppercase tracking-wider">Matéria</th>
                {isAdmin() && (
                  <th className="px-6 py-4 text-xs font-semibold text-app-text-muted uppercase tracking-wider">Escritório</th>
                )}
                <th className="px-6 py-4 text-xs font-semibold text-app-text-muted uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {filteredModelos.map((modelo) => {
                return (
                  <tr key={modelo.id} className="hover:bg-app-secondary/50 transition-colors group cursor-pointer" onClick={() => openViewModal(modelo)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <FileText className="text-app-text-muted mr-3" size={18} />
                        <span className="font-medium text-app-text">{modelo.nome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {modelo.fase}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-app-text">
                        <Tag size={14} className="mr-1.5 text-app-text-muted" />
                        {modelo.materia}
                      </div>
                    </td>
                    {isAdmin() && (
                      <td className="px-6 py-4">
                        <span className="text-sm text-app-text font-medium">
                          {getOfficeName(modelo.escritorioId)}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => openViewModal(modelo)}
                          className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                          title="Visualizar"
                        >
                          <Eye size={18} />
                        </button>
                        {hasPermission('modelos', 'write') && (
                          <button 
                            onClick={() => openEditModal(modelo)}
                            className="text-app-text-muted hover:text-amber-500 transition-colors p-2 rounded-full hover:bg-amber-500/10"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {hasPermission('modelos', 'delete') && (
                          <button 
                            onClick={() => handleDelete(modelo.id)}
                            className="text-app-text-muted hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-500/10"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                        {modelo.link && (
                          <a 
                            href={modelo.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:opacity-80 p-2 rounded-full hover:bg-primary/10"
                            title="Abrir Modelo"
                          >
                            <ExternalLink size={18} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredModelos.length === 0 && (
            <div className="py-12 text-center text-app-text-muted">
              Nenhum modelo encontrado com os filtros aplicados.
            </div>
          )}
        </div>
      </div>

      {/* Modal Novo Modelo */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Modelo de Documento">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Nome do Modelo *</label>
            <input 
              type="text" 
              required
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
              value={novoModelo.nome}
              onChange={e => setNovoModelo({...novoModelo, nome: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Fase</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoModelo.fase}
                onChange={e => setNovoModelo({...novoModelo, fase: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Matéria</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoModelo.materia}
                onChange={e => setNovoModelo({...novoModelo, materia: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Link do Documento</label>
            <input 
              type="url" 
              className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
              placeholder="https://docs.google.com/..."
              value={novoModelo.link}
              onChange={e => setNovoModelo({...novoModelo, link: e.target.value})}
            />
          </div>
          {isAdmin() && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Escritório *</label>
              <select 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={novoModelo.escritorioId || 'x'}
                onChange={e => setNovoModelo({...novoModelo, escritorioId: e.target.value})}
              >
                <option value="x">Global (Todos)</option>
                {state.escritorios.map(esc => (
                  <option key={esc.id} value={esc.id}>{esc.nome}</option>
                ))}
              </select>
            </div>
          )}
          <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm"
            >
              Salvar Modelo
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Visualizar Modelo */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Detalhes do Modelo">
        {selectedModelo && (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <FileText size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-app-text">{selectedModelo.nome}</h2>
                <p className="text-sm text-app-text-muted">{selectedModelo.materia}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-app-secondary rounded-lg border border-app-border">
                <p className="text-xs text-app-text-muted uppercase font-semibold mb-1">Fase</p>
                <p className="text-app-text font-medium">{selectedModelo.fase || 'Não informada'}</p>
              </div>
              <div className="p-3 bg-app-secondary rounded-lg border border-app-border">
                <p className="text-xs text-app-text-muted uppercase font-semibold mb-1">Matéria</p>
                <p className="text-app-text font-medium">{selectedModelo.materia || 'Não informada'}</p>
              </div>
              {isAdmin() && (
                <div className="p-3 bg-app-secondary rounded-lg border border-app-border md:col-span-2">
                  <p className="text-xs text-app-text-muted uppercase font-semibold mb-1">Escritório</p>
                  <p className="text-app-text font-medium">{getOfficeName(selectedModelo.escritorioId)}</p>
                </div>
              )}
            </div>

            {selectedModelo.link && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <LinkIcon className="text-primary" size={20} />
                    <div>
                      <p className="text-sm font-medium text-app-text">Link do Documento</p>
                      <p className="text-xs text-app-text-muted truncate max-w-[250px]">{selectedModelo.link}</p>
                    </div>
                  </div>
                  <a 
                    href={selectedModelo.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:opacity-90 transition-colors flex items-center"
                  >
                    Abrir <ExternalLink size={12} className="ml-1" />
                  </a>
                </div>
              </div>
            )}

            <div className="pt-6 flex justify-between border-t border-app-border">
              {hasPermission('modelos', 'delete') && (
                <button 
                  onClick={() => handleDelete(selectedModelo.id)}
                  className="px-4 py-2 text-red-600 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors flex items-center"
                >
                  <Trash2 size={18} className="mr-2" />
                  Excluir
                </button>
              )}
              <div className="flex space-x-3">
                <button 
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors"
                >
                  Fechar
                </button>
                {hasPermission('modelos', 'write') && (
                  <button 
                    onClick={() => {
                      setIsViewModalOpen(false);
                      openEditModal(selectedModelo);
                    }}
                    className="px-4 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors flex items-center shadow-sm"
                  >
                    <Edit2 size={18} className="mr-2" />
                    Editar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Editar Modelo */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Modelo">
        {selectedModelo && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Nome do Modelo *</label>
              <input 
                type="text" 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={selectedModelo.nome}
                onChange={e => setSelectedModelo({...selectedModelo, nome: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Fase</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedModelo.fase}
                  onChange={e => setSelectedModelo({...selectedModelo, fase: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Matéria</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedModelo.materia}
                  onChange={e => setSelectedModelo({...selectedModelo, materia: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Link do Documento</label>
              <input 
                type="url" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                value={selectedModelo.link}
                onChange={e => setSelectedModelo({...selectedModelo, link: e.target.value})}
              />
            </div>
            {isAdmin() && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Escritório *</label>
                <select 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-secondary text-app-text"
                  value={selectedModelo.escritorioId || 'x'}
                  onChange={e => setSelectedModelo({...selectedModelo, escritorioId: e.target.value})}
                >
                  <option value="x">Global (Todos)</option>
                  {state.escritorios.map(esc => (
                    <option key={esc.id} value={esc.id}>{esc.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
              <button 
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="px-4 py-2 text-white bg-primary rounded-lg hover:opacity-90 transition-colors shadow-sm"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
