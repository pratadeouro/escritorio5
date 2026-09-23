import React, { useState } from 'react';
import { useAppContext } from '../context';
import { Users, Plus, Search, ChevronRight, Mail, Phone, Briefcase } from 'lucide-react';
import Modal from '../components/Modal';

export default function Servidores() {
  const { state, addServidor, updateServidor, deleteServidor, escritorioAtivoId, isAdmin, currentUser, hasPermission } = useAppContext();
  const canWrite = hasPermission('servidores', 'write');
  const canDelete = hasPermission('servidores', 'delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServidorId, setEditingServidorId] = useState<string | null>(null);
  const [novoServidor, setNovoServidor] = useState({
    nome: '',
    cargo: '',
    email: '',
    telefone: ''
  });

  const filteredServidores = state.servidores.filter(s => {
    const isGlobal = !s.escritorioId || s.escritorioId.toLowerCase() === 'x' || s.escritorioId.trim() === '';
    if (escritorioAtivoId && s.escritorioId && s.escritorioId.trim() !== '' && s.escritorioId !== escritorioAtivoId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && s.escritorioId && !(currentUser?.escritoriosIds || []).includes(s.escritorioId)) return false;
    
    const searchLower = searchTerm.toLowerCase();
    return s.nome.toLowerCase().includes(searchLower) || 
           (s.cargo || '').toLowerCase().includes(searchLower) ||
           (s.email || '').toLowerCase().includes(searchLower);
  });

  const handleEdit = (servidor: any) => {
    setEditingServidorId(servidor.id);
    setNovoServidor({
      nome: servidor.nome || '',
      cargo: servidor.cargo || '',
      email: servidor.email || '',
      telefone: servidor.telefone || ''
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingServidorId(null);
    setNovoServidor({
      nome: '',
      cargo: '',
      email: '',
      telefone: ''
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoServidor.nome) return;
    
    if (editingServidorId) {
      updateServidor(editingServidorId, {
        ...novoServidor,
        id: editingServidorId,
        escritorioId: state.servidores.find(s => s.id === editingServidorId)?.escritorioId
      });
    } else {
      addServidor({
        id: Math.random().toString(36).substr(2, 9),
        ...novoServidor,
        escritorioId: escritorioAtivoId || ''
      });
    }
    
    setIsModalOpen(false);
    setNovoServidor({
      nome: '',
      cargo: '',
      email: '',
      telefone: ''
    });
    setEditingServidorId(null);
  };

  const handleDelete = () => {
    if (editingServidorId && window.confirm('Tem certeza que deseja excluir este servidor?')) {
      deleteServidor(editingServidorId);
      setIsModalOpen(false);
      setEditingServidorId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <Users className="mr-3 text-primary" />
          Servidores
        </h1>
        {canWrite && (
          <button 
            onClick={handleAddNew}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Servidor
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="p-4 border-b border-app-border flex items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, cargo ou e-mail..." 
              className="w-full pl-10 pr-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-app-surface text-app-text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-app-bg text-app-text-muted text-sm uppercase tracking-wider">
                <th className="p-4 font-medium">Nome / Cargo</th>
                <th className="p-4 font-medium">Contato</th>
                <th className="p-4 font-medium">Varas Associadas</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {filteredServidores.map(servidor => {
                const varasDoServidor = state.varas.filter(v => v.id_servidores?.includes(servidor.id));
                const isGlobal = servidor.escritorioId?.toLowerCase() === 'x';
                return (
                  <tr 
                    key={servidor.id} 
                    onClick={() => canWrite && handleEdit(servidor)}
                    className={`hover:bg-app-secondary/50 transition-colors group ${canWrite ? 'cursor-pointer' : ''} ${isGlobal ? 'bg-primary/5' : ''}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {servidor.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-app-text flex items-center gap-2">
                            {servidor.nome}
                            {isGlobal && (
                              <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                                Geral
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-app-text-muted flex items-center">
                            <Briefcase size={12} className="mr-1" />
                            {servidor.cargo || 'Não informado'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {servidor.email && (
                          <div className="text-sm text-primary flex items-center">
                            <Mail size={12} className="mr-1" />
                            {servidor.email}
                          </div>
                        )}
                        {servidor.telefone && (
                          <div className="text-sm text-app-text-muted flex items-center">
                            <Phone size={12} className="mr-1" />
                            {servidor.telefone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {varasDoServidor.length > 0 ? (
                          varasDoServidor.map(v => (
                            <span key={v.id} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                              {v.nome}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs italic text-app-text-muted">Nenhuma vara</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10">
                        <ChevronRight size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredServidores.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-app-text-muted italic">
                    Nenhum servidor encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingServidorId ? "Editar Servidor" : "Novo Servidor"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editingServidorId && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-app-text">ID do Servidor</label>
                <input 
                  type="text" 
                  readOnly
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text-muted cursor-not-allowed"
                  value={editingServidorId}
                />
              </div>
            )}
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text">Nome Completo</label>
              <input 
                type="text" 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: João Silva"
                value={novoServidor.nome}
                onChange={e => setNovoServidor({...novoServidor, nome: e.target.value})}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-app-text">Cargo / Função</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: Diretor de Secretaria"
                value={novoServidor.cargo}
                onChange={e => setNovoServidor({...novoServidor, cargo: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">E-mail</label>
              <input 
                type="email" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: joao@tjam.jus.br"
                value={novoServidor.email}
                onChange={e => setNovoServidor({...novoServidor, email: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Telefone / WhatsApp</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: (11) 99999-9999"
                value={novoServidor.telefone}
                onChange={e => setNovoServidor({...novoServidor, telefone: e.target.value})}
              />
            </div>
            {escritorioAtivoId && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">ID Escritório</label>
                <input 
                  type="text" 
                  readOnly
                  className="w-full px-3 py-2 border border-app-border rounded-lg bg-app-bg text-app-text-muted cursor-not-allowed"
                  value={escritorioAtivoId}
                />
              </div>
            )}
          </div>
          <div className="pt-4 flex justify-between items-center border-t border-app-border">
            <div>
              {editingServidorId && canDelete && (
                <button 
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Excluir Servidor
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
              >
                Cancelar
              </button>
              {canWrite && (
                <button 
                  type="submit"
                  className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                  {editingServidorId ? "Salvar Alterações" : "Salvar Servidor"}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
