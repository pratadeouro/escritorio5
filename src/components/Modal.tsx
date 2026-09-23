import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se o usuário estiver digitando em campo de texto, textarea, select ou elemento editável
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isContentEditable = (document.activeElement as HTMLElement)?.isContentEditable;
      const isInputActive = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || isContentEditable;

      if (isInputActive) return;

      // Tecla 'x' ou 'X' fecha a janela do modal
      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 p-2 sm:p-4 backdrop-blur-sm">
      <div className={`relative w-full ${maxWidth} max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-app-surface rounded-xl shadow-xl border border-app-border overflow-hidden`}>
        <div className="flex items-start sm:items-center justify-between p-3 sm:p-4 border-b border-app-border shrink-0 gap-3">
          <div className="text-base sm:text-lg md:text-xl font-semibold text-app-text min-w-0 flex-1 break-words overflow-hidden leading-snug">
            {title}
          </div>
          <button
            onClick={onClose}
            className="text-app-text-muted hover:text-app-text hover:bg-app-bg p-1.5 rounded-lg transition-colors shrink-0 mt-0.5 sm:mt-0"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-3 sm:p-6 text-app-text overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
