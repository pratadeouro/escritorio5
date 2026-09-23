
import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context';
import { Search, ChevronDown, Check } from 'lucide-react';

interface ProcessoSelectProps {
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function ProcessoSelect({ value, onChange, required, disabled, placeholder = "Buscar processo...", className = "" }: ProcessoSelectProps) {
  const { state, escritorioAtivoId, isAdmin, currentUser } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProcesso = state.processos.find(p => p.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProcessos = searchTerm.length >= 3 
    ? state.processos.filter(p => {
        if (escritorioAtivoId && p.escritorioId !== escritorioAtivoId) return false;
        if (!isAdmin() && !(currentUser?.escritoriosIds || []).includes(p.escritorioId)) return false;
        
        const searchLower = searchTerm.toLowerCase();
        return (p.numero || '').toLowerCase().includes(searchLower) || 
               (p.titulo || '').toLowerCase().includes(searchLower) ||
               (p.parteContraria || '').toLowerCase().includes(searchLower);
      })
    : [];

  const formatCNJ = (numero: string) => {
    if (!numero) return '';
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 bg-app-surface border ${isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-app-border'} text-app-text rounded-lg flex items-center justify-between cursor-pointer transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className={!selectedProcesso ? 'text-app-text-muted' : ''}>
          {selectedProcesso ? formatCNJ(selectedProcesso.numero) : placeholder}
        </span>
        <ChevronDown size={16} className={`text-app-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div className="p-2 border-b border-app-border bg-app-bg">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-app-text-muted" size={14} />
              <input
                autoFocus
                type="text"
                className="w-full pl-8 pr-3 py-1.5 bg-app-surface border border-app-border rounded-md text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder="Digite 3+ caracteres..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {searchTerm.length < 3 ? (
              <div className="p-4 text-center text-xs text-app-text-muted">
                Digite pelo menos 3 caracteres para buscar.
              </div>
            ) : filteredProcessos.length > 0 ? (
              filteredProcessos.map(p => (
                <div
                  key={p.id}
                  onClick={() => {
                    onChange(p.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-primary/10 transition-colors ${value === p.id ? 'bg-primary/5 text-primary' : 'text-app-text'}`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{formatCNJ(p.numero)}</span>
                    <span className="text-xs text-app-text-muted line-clamp-1">{p.titulo || p.parteContraria}</span>
                  </div>
                  {value === p.id && <Check size={14} />}
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-app-text-muted">
                Nenhum processo encontrado.
              </div>
            )}
          </div>
        </div>
      )}
      
      {required && !value && (
        <input type="text" className="sr-only" required value="" readOnly />
      )}
    </div>
  );
}
