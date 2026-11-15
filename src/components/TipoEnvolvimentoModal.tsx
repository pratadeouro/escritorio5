import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, Tag } from 'lucide-react';
import Modal from './Modal';
import { useAppContext } from '../context';
import { TipoEnvolvimento } from '../types';

interface TipoEnvolvimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCreated?: (nome: string) => void;
}

export default function TipoEnvolvimentoModal({
  isOpen,
  onClose,
  onSelectCreated
}: TipoEnvolvimentoModalProps) {
  const {
    state,
    addTipoEnvolvimento,
    updateTipoEnvolvimento,
    deleteTipoEnvolvimento
  } = useAppContext();

  const [novoNome, setNovoNome] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = novoNome.trim();
    if (!clean) {
      setErrorMsg('Informe o nome do tipo de envolvimento.');
      return;
    }

    const exists = state.tipoEnvolvimentos.some(
      t => t.nome.trim().toLowerCase() === clean.toLowerCase()
    );
    if (exists) {
      setErrorMsg('Este tipo de envolvimento já está cadastrado.');
      return;
    }

    const slug = clean
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const id = slug && !state.tipoEnvolvimentos.some(t => t.id === slug)
      ? slug
      : `tipo_${Date.now()}`;

    const novo: TipoEnvolvimento = { id, nome: clean };
    addTipoEnvolvimento(novo);
    setNovoNome('');
    if (onSelectCreated) {
      onSelectCreated(clean);
    }
  };

  const handleSaveEdit = (item: TipoEnvolvimento) => {
    const clean = editingNome.trim();
    if (!clean) return;
    const duplicate = state.tipoEnvolvimentos.some(
      t => t.id !== item.id && t.nome.trim().toLowerCase() === clean.toLowerCase()
    );
    if (duplicate) {
      setErrorMsg('Já existe outro tipo de envolvimento com este nome.');
      return;
    }
    setErrorMsg(null);
    updateTipoEnvolvimento({ ...item, nome: clean });
    setEditingId(null);
    setEditingNome('');
  };

  const sortedTipos = [...state.tipoEnvolvimentos].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gerenciar Tipos de Envolvimento"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <p className="text-xs text-app-text-muted">
          Cadastre os papéis das partes envolvidas em processos e recursos (ex.: Autor, Réu, Exequente, Executado, Terceiro Interessado). Salvo na tabela <code className="font-mono text-[11px]">envolvidos_tipo</code> do Supabase.
        </p>

        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={novoNome}
            onChange={(e) => {
              setNovoNome(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="Ex: Autor, Réu, Exequente..."
            className="flex-1 px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            className="px-3.5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus size={16} />
            Adicionar
          </button>
        </form>

        {errorMsg && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}

        <div className="border border-app-border rounded-xl divide-y divide-app-border max-h-72 overflow-y-auto bg-app-surface">
          {sortedTipos.length === 0 ? (
            <div className="p-4 text-center text-xs text-app-text-muted">
              Nenhum tipo cadastrado.
            </div>
          ) : (
            sortedTipos.map((item) => {
              const isDefault = item.id === 'apelante' || item.id === 'apelado';
              const isEditing = editingId === item.id;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-app-secondary/40 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        value={editingNome}
                        onChange={(e) => setEditingNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit(item);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        autoFocus
                        className="flex-1 px-2.5 py-1 text-sm bg-app-bg border border-primary rounded-md text-app-text focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(item)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-500/10 rounded-md"
                        title="Salvar"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-app-text-muted hover:bg-app-secondary rounded-md"
                        title="Cancelar"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <Tag size={14} className="text-primary shrink-0" />
                        <span className="font-medium text-app-text truncate">{item.nome}</span>
                        {isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-app-secondary text-app-text-muted font-semibold">
                            Padrão
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditingNome(item.nome);
                            setErrorMsg(null);
                          }}
                          className="p-1.5 text-app-text-muted hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                          title="Editar nome"
                        >
                          <Edit2 size={14} />
                        </button>
                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => deleteTipoEnvolvimento(item.id)}
                            className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Excluir tipo"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
