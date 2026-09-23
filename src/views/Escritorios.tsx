import React, { useState } from 'react';
import { useAppContext } from '../context';
import { Building, Plus, Search, ChevronRight, MapPin, Users, Trash2, Edit2, UserPlus, UserMinus, CheckCircle2, Scale } from 'lucide-react';
import Modal from '../components/Modal';
import { Escritorio, Usuario } from '../types';
import { generateId } from '../services/googleSheets';

export default function Escritorios() {
  const { state, addEscritorio, updateEscritorio, deleteEscritorio, updateUsuario, isAdmin, currentUser, hasPermission } = useAppContext();
  const canWrite = hasPermission('escritorios', 'write');
  const canDelete = hasPermission('escritorios', 'delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEscritorio, setEditingEscritorio] = useState<Escritorio | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [novoEscritorio, setNovoEscritorio] = useState({
    nome: '',
    endereco: '',
    usuariosId: '',
    responsavel: '',
    oab: '',
    uf: '',
    cnpj: '',
    theme: 'light' as 'light' | 'dark',
    primaryColor: '#4f46e5',
    backgroundColor: '#ffffff',
    secondaryColor: '#f8fafc',
    googleFormsSpreadsheetId: '',
    googleFormsSheetName: 'Respostas ao formulário 1'
  });

  const filteredEscritorios = state.escritorios.filter(e => {
    if (!isAdmin() && !(currentUser?.escritoriosIds || []).includes(e.id)) return false;
    
    const searchLower = searchTerm.toLowerCase();
    return e.nome.toLowerCase().includes(searchLower) || 
           (e.endereco?.toLowerCase().includes(searchLower)) ||
           (e.responsavel?.toLowerCase().includes(searchLower));
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoEscritorio.nome) return;
    
    const escritorioId = (editingEscritorio ? editingEscritorio.id : generateId()).toUpperCase();
    const finalUsuariosId = selectedUsers.join(',');

    const escritorioData: Escritorio = {
      ...novoEscritorio,
      id: escritorioId,
      usuariosId: finalUsuariosId,
      theme: novoEscritorio.theme,
      primaryColor: novoEscritorio.primaryColor,
      backgroundColor: novoEscritorio.backgroundColor,
      secondaryColor: novoEscritorio.secondaryColor,
      googleFormsSpreadsheetId: novoEscritorio.googleFormsSpreadsheetId,
      googleFormsSheetName: novoEscritorio.googleFormsSheetName
    };

    // Update users' escritoriosIds
    const updatedUsers = state.usuarios.map(usuario => {
      const isSelected = selectedUsers.includes(usuario.id);
      const userOffices = usuario.escritoriosIds || [];
      const isCurrentlyLinked = userOffices.includes(escritorioId);

      if (isSelected && !isCurrentlyLinked) {
        return { ...usuario, escritoriosIds: [...userOffices, escritorioId] };
      } else if (!isSelected && isCurrentlyLinked) {
        return { ...usuario, escritoriosIds: userOffices.filter(id => id !== escritorioId) };
      }
      return usuario;
    });

    // We only send users that actually changed to avoid unnecessary mapping
    const changedUsers = updatedUsers.filter(u => {
      const original = state.usuarios.find(orig => orig.id === u.id);
      return JSON.stringify(original?.escritoriosIds) !== JSON.stringify(u.escritoriosIds);
    });

    if (editingEscritorio) {
      updateEscritorio(escritorioData, changedUsers);
    } else {
      addEscritorio(escritorioData, changedUsers);
    }
    
    closeModal();
  };

  const openEditModal = (escritorio: Escritorio) => {
    setEditingEscritorio(escritorio);
    const linkedUserIds = state.usuarios
      .filter(u => (u.escritoriosIds || []).includes(escritorio.id))
      .map(u => u.id);
    
    setSelectedUsers(linkedUserIds);
    setNovoEscritorio({
      nome: escritorio.nome,
      endereco: escritorio.endereco || '',
      usuariosId: escritorio.usuariosId || '',
      responsavel: escritorio.responsavel || '',
      oab: escritorio.oab || '',
      uf: escritorio.uf || '',
      cnpj: escritorio.cnpj || '',
      theme: escritorio.theme || 'light',
      primaryColor: escritorio.primaryColor || '#4f46e5',
      backgroundColor: escritorio.backgroundColor || '#ffffff',
      secondaryColor: escritorio.secondaryColor || '#f8fafc',
      googleFormsSpreadsheetId: escritorio.googleFormsSpreadsheetId || '',
      googleFormsSheetName: escritorio.googleFormsSheetName || 'Respostas ao formulário 1'
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEscritorio(null);
    setSelectedUsers([]);
    setNovoEscritorio({
      nome: '',
      endereco: '',
      usuariosId: '',
      responsavel: '',
      oab: '',
      uf: '',
      cnpj: '',
      theme: 'light',
      primaryColor: '#4f46e5',
      backgroundColor: '#ffffff',
      secondaryColor: '#f8fafc',
      googleFormsSpreadsheetId: '',
      googleFormsSheetName: 'Respostas ao formulário 1'
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este escritório?')) {
      deleteEscritorio(id);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-app-text flex items-center">
          <Building className="mr-3 text-primary" />
          Gestão de Escritórios
        </h1>
        {canWrite && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Novo Escritório
          </button>
        )}
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="p-4 border-b border-app-border flex items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-app-text-muted" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, endereço ou responsável..." 
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
                <th className="p-4 font-medium">Nome do Escritório</th>
                <th className="p-4 font-medium">Endereço</th>
                <th className="p-4 font-medium">Responsável / OAB</th>
                <th className="p-4 font-medium">UF / CNPJ</th>
                <th className="p-4 font-medium">Processos</th>
                <th className="p-4 font-medium">Usuários Vinculados</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {filteredEscritorios.map((escritorio, index) => {
                const vinculados = state.usuarios.filter(u => u.escritoriosIds?.includes(escritorio.id));
                return (
                  <tr key={`${escritorio.id}-${index}`} className="hover:bg-app-secondary/50 transition-colors group">
                    <td className="p-4 font-medium text-app-text">{escritorio.nome}</td>
                    <td className="p-4 text-app-text-muted">
                      <div className="flex items-center text-sm">
                        <MapPin size={14} className="mr-1 opacity-50" />
                        {escritorio.endereco || 'Não informado'}
                      </div>
                    </td>
                    <td className="p-4 text-app-text-muted">
                      <div className="text-sm font-medium text-app-text">{escritorio.responsavel || 'Não informado'}</div>
                      {escritorio.oab && <div className="text-xs">OAB: {escritorio.oab}</div>}
                    </td>
                    <td className="p-4 text-app-text-muted">
                      <div className="text-sm">{escritorio.uf || '-'}</div>
                      <div className="text-xs">{escritorio.cnpj || '-'}</div>
                    </td>
                    <td className="p-4 text-app-text-muted">
                      <div className="flex items-center text-sm font-medium text-app-text">
                        <Scale size={14} className="mr-1 text-primary opacity-70" />
                        {state.processos.filter(p => p.escritorioId === escritorio.id).length} processo(s)
                      </div>
                    </td>
                    <td className="p-4 text-app-text-muted">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm font-medium text-app-text">
                          <Users size={14} className="mr-1 text-primary" />
                          {vinculados.length} usuário(s)
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {vinculados.map((u, index) => (
                            <span key={`${u.id}-${index}`} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                              {u.nome}
                            </span>
                          ))}
                          {vinculados.length === 0 && <span className="text-xs italic opacity-50">Nenhum vínculo</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end space-x-2">
                        {canWrite && (
                          <button 
                            onClick={() => openEditModal(escritorio)}
                            className="text-app-text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-primary/10"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(escritorio.id)}
                            className="text-app-text-muted hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-500/10"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredEscritorios.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-app-text-muted">
                    Nenhum escritório encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingEscritorio ? "Editar Escritório" : "Novo Escritório"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Nome do Escritório *</label>
              <input 
                type="text" 
                required
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: Escritório Central"
                value={novoEscritorio.nome}
                onChange={e => setNovoEscritorio({...novoEscritorio, nome: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Endereço</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                placeholder="Ex: Rua das Flores, 123"
                value={novoEscritorio.endereco}
                onChange={e => setNovoEscritorio({...novoEscritorio, endereco: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">Responsável</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                  placeholder="Nome do advogado responsável"
                  value={novoEscritorio.responsavel}
                  onChange={e => setNovoEscritorio({...novoEscritorio, responsavel: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">OAB do Responsável</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                  placeholder="Ex: 12345/AM"
                  value={novoEscritorio.oab}
                  onChange={e => setNovoEscritorio({...novoEscritorio, oab: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">UF</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                  placeholder="Ex: AM"
                  maxLength={2}
                  value={novoEscritorio.uf}
                  onChange={e => setNovoEscritorio({...novoEscritorio, uf: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-text">CNPJ</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                  placeholder="Ex: 00.000.000/0001-00"
                  value={novoEscritorio.cnpj}
                  onChange={e => setNovoEscritorio({...novoEscritorio, cnpj: e.target.value})}
                />
              </div>
            </div>

            <div className="border-t border-app-border pt-4 mt-2">
              <h4 className="text-sm font-semibold text-primary mb-3">Integração Google Forms (Contatos)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">ID da Planilha do Google Forms</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text font-mono text-xs"
                    placeholder="Ex: 1GuBKYPr_ea0A7Gh5mGQxx..."
                    value={novoEscritorio.googleFormsSpreadsheetId}
                    onChange={e => setNovoEscritorio({...novoEscritorio, googleFormsSpreadsheetId: e.target.value})}
                  />
                  <p className="text-[10px] text-app-text-muted">
                    O ID contido na URL da planilha do formulário. A planilha deve estar compartilhada como "Qualquer pessoa com o link pode ler".
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-app-text">Nome da Aba/Página (Tab)</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-app-surface text-app-text"
                    placeholder="Ex: Respostas ao formulário 1"
                    value={novoEscritorio.googleFormsSheetName}
                    onChange={e => setNovoEscritorio({...novoEscritorio, googleFormsSheetName: e.target.value})}
                  />
                  <p className="text-[10px] text-app-text-muted">
                    Geralmente "Respostas ao formulário 1" ou "Form Responses 1".
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-app-text">Vincular Usuários</label>
              <div className="border border-app-border rounded-lg bg-app-bg/50 max-h-48 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-app-border">
                {state.usuarios.map((usuario, index) => {
                  const isSelected = selectedUsers.includes(usuario.id);
                  const otherOffices = state.escritorios.filter(e => usuario.escritoriosIds?.includes(e.id) && e.id !== editingEscritorio?.id);
                  
                  return (
                    <div 
                      key={`${usuario.id}-${index}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedUsers(selectedUsers.filter(id => id !== usuario.id));
                        } else {
                          setSelectedUsers([...selectedUsers, usuario.id]);
                        }
                      }}
                      className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-app-secondary'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 transition-colors ${
                          isSelected ? 'bg-primary border-primary text-white' : 'border-app-border bg-app-surface'
                        }`}>
                          {isSelected && <CheckCircle2 size={12} />}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-app-text">{usuario.nome}</div>
                          <div className="text-[10px] text-app-text-muted">{usuario.cargo}</div>
                        </div>
                      </div>
                      {otherOffices.length > 0 && !isSelected && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded border border-amber-500/20">
                          {otherOffices.map(o => o.nome).join(', ')}
                        </span>
                      )}
                      {otherOffices.length === 0 && isSelected && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium" title="Este é o único escritório associado a este usuário. Se desvincular, ele perderá acesso ao sistema.">
                          Único Escritório
                        </span>
                      )}
                    </div>
                  );
                })}
                {state.usuarios.length === 0 && (
                  <div className="p-4 text-center text-xs text-app-text-muted italic">
                    Nenhum usuário cadastrado no sistema.
                  </div>
                )}
              </div>
              <p className="text-[10px] text-app-text-muted mt-1">
                Selecione os usuários que fazem parte deste escritório. Usuários já vinculados a outros escritórios serão transferidos.
              </p>
            </div>
          </div>
          <div className="pt-4 flex justify-end space-x-3 border-t border-app-border">
            <button 
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-secondary/50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              {editingEscritorio ? "Atualizar Escritório" : "Salvar Escritório"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
