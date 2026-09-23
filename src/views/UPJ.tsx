import React, { useState } from 'react';
import { useAppContext } from '../context';
import { Building2, Search, Mail, Phone, User, MapPin, ExternalLink, MessageSquare, Plus, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { UPJ as UPJType } from '../types';

export default function UPJ() {
  const { state, escritorioAtivoId, isAdmin, currentUser, hasPermission, addUPJ, updateUPJ, deleteUPJ } = useAppContext();
  const canWrite = hasPermission('upj', 'write');
  const canDelete = hasPermission('upj', 'delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUPJ, setEditingUPJ] = useState<UPJType | null>(null);
  const [formData, setFormData] = useState<Partial<UPJType>>({
    nome: '',
    diretor: '',
    localizacao: '',
    email: '',
    telefone: '',
    whatsapp: '',
    balcao: ''
  });

  const handleOpenModal = (unit?: UPJType) => {
    if (unit) {
      setEditingUPJ(unit);
      setFormData(unit);
    } else {
      setEditingUPJ(null);
      setFormData({
        nome: '',
        diretor: '',
        localizacao: '',
        email: '',
        telefone: '',
        whatsapp: '',
        balcao: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return;

    if (editingUPJ) {
      updateUPJ({ ...editingUPJ, ...formData } as UPJType);
    } else {
      addUPJ({
        ...formData,
        id: Math.random().toString(36).substr(2, 9),
        escritorioId: escritorioAtivoId || ''
      } as UPJType);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta UPJ?')) {
      deleteUPJ(id);
    }
  };

  const filteredUPJ = state.upj.filter(u => {
    const isGlobal = !u.escritorioId || u.escritorioId.toLowerCase() === 'x' || u.escritorioId.trim() === '';
    if (escritorioAtivoId && u.escritorioId && u.escritorioId.trim() !== '' && u.escritorioId !== escritorioAtivoId && !isGlobal) return false;
    if (!isAdmin() && !isGlobal && u.escritorioId && !(currentUser?.escritoriosIds || []).includes(u.escritorioId)) return false;
    
    return u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
           u.diretor.toLowerCase().includes(searchTerm.toLowerCase()) ||
           u.localizacao.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <Building2 className="mr-3 text-primary" />
          Unidades de Processamento Judicial (UPJ)
        </h1>
        {canWrite && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Nova UPJ
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="p-4 border-b border-app-border flex items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, diretor ou localização..." 
              className="w-full pl-10 pr-4 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-app-bg text-app-text placeholder-app-text-muted"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {filteredUPJ.map((unit) => (
            <div key={unit.id} className="bg-app-bg rounded-xl p-6 border border-app-border hover:border-primary/30 transition-colors">
              <div className="flex justify-between items-start mb-4 gap-2">
                <h3 className="text-lg font-bold text-app-text flex-1">{unit.nome}</h3>
                <div className="flex items-center gap-1">
                  {canWrite && (
                    <button 
                      onClick={() => handleOpenModal(unit)}
                      className="p-1.5 text-app-text-muted hover:text-primary transition-colors hover:bg-primary/10 rounded-lg"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(unit.id)}
                      className="p-1.5 text-app-text-muted hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  {unit.balcao && (
                    <a 
                      href={unit.balcao} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1 bg-primary text-white text-[10px] font-medium rounded-full hover:opacity-90 transition-colors shadow-sm whitespace-nowrap ml-1"
                    >
                      <ExternalLink size={10} className="mr-1" />
                      Balcão
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-sm text-app-text-muted">
                  <User size={16} className="mr-3 text-app-text-muted" />
                  <span className="font-medium text-app-text mr-2">Diretor:</span>
                  {unit.diretor}
                </div>

                <div className="flex items-start text-sm text-app-text-muted">
                  <MapPin size={16} className="mr-3 mt-0.5 text-app-text-muted" />
                  <div>
                    <span className="font-medium text-app-text block">Localização:</span>
                    {unit.localizacao}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center text-sm text-app-text-muted">
                    <Mail size={16} className="mr-3 text-app-text-muted" />
                    <a href={`mailto:${unit.email}`} className="hover:text-primary transition-colors truncate">
                      {unit.email}
                    </a>
                  </div>
                  
                  {unit.telefone && (
                    <div className="flex items-center text-sm text-app-text-muted">
                      <Phone size={16} className="mr-3 text-app-text-muted" />
                      {unit.telefone}
                    </div>
                  )}

                  {unit.whatsapp && (
                    <div className="flex items-center text-sm text-app-text-muted">
                      <MessageSquare size={16} className="mr-3 text-emerald-500" />
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">{unit.whatsapp}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {filteredUPJ.length === 0 && (
            <div className="col-span-full py-12 text-center text-app-text-muted">
              Nenhuma UPJ encontrada.
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUPJ ? "Editar UPJ" : "Nova UPJ"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Nome da UPJ *</label>
              <input 
                type="text" required
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Diretor(a)</label>
              <input 
                type="text"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                value={formData.diretor}
                onChange={e => setFormData({...formData, diretor: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">E-mail</label>
              <input 
                type="email"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Telefone</label>
              <input 
                type="text"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                value={formData.telefone}
                onChange={e => setFormData({...formData, telefone: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">WhatsApp</label>
              <input 
                type="text"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                value={formData.whatsapp}
                onChange={e => setFormData({...formData, whatsapp: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Balcão Virtual (Link)</label>
              <input 
                type="url"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text"
                value={formData.balcao}
                onChange={e => setFormData({...formData, balcao: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-app-text">Localização</label>
            <textarea 
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-app-text resize-none"
              rows={2}
              value={formData.localizacao}
              onChange={e => setFormData({...formData, localizacao: e.target.value})}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-app-text-muted hover:text-app-text transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
            >
              {editingUPJ ? 'Salvar Alterações' : 'Adicionar UPJ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
