import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context';
import { Bot, Send, User, Sparkles, FileText, Search, Loader2, MessageSquare, Trash2, Copy, Check, ChevronDown } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

import Modal from '../components/Modal';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function IA() {
  const { state, escritorioAtivoId, isAdmin, currentUser } = useAppContext();
  const [selectedProcessId, setSelectedProcessId] = useState<string>('');
  const [selectedModeloId, setSelectedModeloId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const processDropdownRef = useRef<HTMLDivElement>(null);

  const formatCNJ = (numero: string) => {
    if (!numero) return '';
    const digits = numero.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    }
    return numero;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (processDropdownRef.current && !processDropdownRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProcess = state.processos.find(p => p.id === selectedProcessId);
  const selectedModelo = state.modelos.find(m => m.id === selectedModeloId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      // Construct context
      let context = "Você é um assistente jurídico especializado em direito brasileiro. ";
      
      if (selectedProcess) {
        context += `\n\nContexto do Processo Selecionado:
        Número: ${selectedProcess.numero}
        Cliente: ${state.contatos.find(c => c.id === selectedProcess.clienteId)?.nome || 'Não identificado'}
        Parte Contrária: ${selectedProcess.parteContraria}
        Tribunal/Vara: ${selectedProcess.tribunal}
        Status: ${selectedProcess.status}
        Assunto: ${selectedProcess.assunto || 'Não informado'}
        Classe: ${selectedProcess.classe || 'Não informada'}
        Valor da Causa: R$ ${selectedProcess.valorCausa || 0}
        Última Movimentação: ${(() => {
          const movs = state.movimentos.filter(m => 
            String(m.processoId) === String(selectedProcess.id) || 
            String(m.processoId) === String(selectedProcess.idProc) || 
            String(m.processoId) === String(selectedProcess.numero)
          ).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
          return movs.length > 0 ? `${movs[0].data}: ${movs[0].descricao}` : 'Não informada';
        })()}`;
      }

      if (selectedModelo) {
        context += `\n\nModelo de Documento Selecionado:
        Nome: ${selectedModelo.nome}
        Fase: ${selectedModelo.fase}
        Matéria: ${selectedModelo.materia}
        Link/Referência: ${selectedModelo.link}`;
      }

      context += "\n\nResponda de forma profissional, técnica e útil para um advogado.";

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [
          { role: 'user', parts: [{ text: context }] },
          ...messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          })),
          { role: 'user', parts: [{ text: input }] }
        ],
      });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.text || 'Desculpe, não consegui gerar uma resposta.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro na IA:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Ocorreu um erro ao processar sua solicitação. Verifique sua conexão e a chave da API.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateFromTemplate = async () => {
    if (!selectedProcess || !selectedModelo) {
      alert('Selecione um processo e um modelo para gerar o texto.');
      return;
    }

    const prompt = `Com base nos dados do processo ${selectedProcess.numero} e no modelo "${selectedModelo.nome}", crie um rascunho de petição ou documento jurídico adequado. Use os dados disponíveis do processo para preencher as informações.`;
    setInput(prompt);
    // Trigger send automatically
    setTimeout(() => handleSend(), 100);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearChat = () => {
    setMessages([]);
    setIsClearModalOpen(false);
  };

  const availableProcessos = state.processos.filter(p => p.status === 'Ativo' && (
    (escritorioAtivoId && p.escritorioId === escritorioAtivoId) ||
    (!escritorioAtivoId && (isAdmin() || (currentUser?.escritoriosIds || []).includes(p.escritorioId)))
  ));

  const cleanQuery = searchQuery.toLowerCase().trim();
  const isQueryValid = cleanQuery.length >= 4;

  const filteredProcessos = isQueryValid
    ? availableProcessos.filter(p => {
        const client = state.contatos.find(c => c.id === p.clienteId);
        const clientName = client ? client.nome : '';
        return (p.numero || '').toLowerCase().includes(cleanQuery) ||
               (p.titulo || '').toLowerCase().includes(cleanQuery) ||
               (p.parteContraria || '').toLowerCase().includes(cleanQuery) ||
               (clientName || '').toLowerCase().includes(cleanQuery);
      })
    : availableProcessos;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-app-bg">
      {/* Header / Selectors */}
      <div className="bg-app-surface border-b border-app-border p-4 shadow-sm">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-app-text-muted uppercase flex items-center">
              <Search size={14} className="mr-1" /> Selecionar Processo
            </label>
            <div className="relative" ref={processDropdownRef}>
              <div
                onClick={() => setSearchOpen(!searchOpen)}
                className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all text-app-text flex items-center justify-between cursor-pointer select-none h-[38px]"
              >
                <span className="truncate pr-2 font-medium">
                  {selectedProcess 
                    ? `${formatCNJ(selectedProcess.numero)}${selectedProcess.titulo ? ` - ${selectedProcess.titulo}` : ''}`
                    : 'Nenhum processo selecionado'
                  }
                </span>
                <ChevronDown size={16} className={`text-app-text-muted transition-transform shrink-0 ${searchOpen ? 'rotate-180' : ''}`} />
              </div>

              {searchOpen && (
                <div className="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-2 border-b border-app-border bg-app-bg">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-text-muted" size={14} />
                      <input
                        autoFocus
                        type="text"
                        className="w-full pl-8 pr-3 py-1.5 bg-app-surface border border-app-border rounded-lg text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-app-text-muted"
                        placeholder="Mínimo 4 dígitos para buscar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto">
                    {searchQuery.trim().length > 0 && searchQuery.trim().length < 4 ? (
                      <div className="p-3 text-center text-xs text-app-text-muted">
                        Digite no mínimo 4 caracteres para buscar por similaridade (número ou nome).
                      </div>
                    ) : filteredProcessos.length > 0 ? (
                      filteredProcessos.map(p => {
                        const client = state.contatos.find(c => c.id === p.clienteId);
                        const clientName = client ? client.nome : '';
                        const formattedNo = formatCNJ(p.numero);
                        const partsText = [
                          p.titulo,
                          clientName ? `Cliente: ${clientName}` : null,
                          p.parteContraria ? `vs ${p.parteContraria}` : null
                        ].filter(Boolean).join(' • ');

                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedProcessId(p.id);
                              setSearchOpen(false);
                              setSearchQuery('');
                            }}
                            className={`px-3 py-2 text-xs sm:text-sm cursor-pointer hover:bg-primary/10 transition-colors flex flex-col border-b border-app-border/30 last:border-b-0 ${selectedProcessId === p.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                          >
                            <span className="font-semibold text-app-text">{formattedNo}</span>
                            {partsText && (
                              <span className="text-xs text-app-text-muted truncate mt-0.5">
                                {partsText}
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-app-text-muted">
                        Nenhum processo encontrado.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-app-text-muted uppercase flex items-center">
              <FileText size={14} className="mr-1" /> Selecionar Modelo
            </label>
              <select
                value={selectedModeloId}
                onChange={(e) => setSelectedModeloId(e.target.value)}
                className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all text-app-text"
              >
              <option value="">Nenhum modelo selecionado</option>
              {state.modelos.filter(m => 
                (escritorioAtivoId && m.escritorioId === escritorioAtivoId) ||
                (!escritorioAtivoId && (isAdmin() || (currentUser?.escritoriosIds || []).includes(m.escritorioId)))
              ).map(m => (
                <option key={m.id} value={m.id}>{m.nome} ({m.materia})</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={generateFromTemplate}
              disabled={!selectedProcessId || !selectedModeloId || isLoading}
              className="flex-1 bg-primary hover:opacity-90 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95"
            >
              <Sparkles size={18} className="mr-2" />
              Gerar Texto
            </button>
            <button
              onClick={() => setIsClearModalOpen(true)}
              className="p-2 bg-app-secondary text-red-500 rounded-lg hover:bg-red-500/10 transition-all active:scale-95 border border-app-border"
              title="Nova Conversa"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      </div>

      <Modal isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)} title="Limpar Conversa">
        <div className="space-y-4">
          <p className="text-app-text-muted">
            Tem certeza que deseja apagar todo o histórico desta conversa? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end space-x-3 pt-4 border-t border-app-border">
            <button 
              onClick={() => setIsClearModalOpen(false)}
              className="px-4 py-2 text-app-text bg-app-surface border border-app-border rounded-lg hover:bg-app-bg transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={clearChat}
              className="px-4 py-2 text-white bg-red-600 hover:opacity-90 transition-colors shadow-sm rounded-lg"
            >
              Apagar Conversa
            </button>
          </div>
        </div>
      </Modal>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-app-bg">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <Bot size={32} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-app-text">Assistente Jurídico IA</h3>
                <p className="text-app-text-muted max-w-sm">
                  Selecione um processo acima para começar a fazer perguntas ou gerar documentos baseados em seus dados.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mt-4">
                {[
                  "Resuma este processo",
                  "Quais são os próximos prazos?",
                  "Crie uma petição inicial",
                  "Analise a última movimentação"
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="p-3 text-sm text-left bg-app-surface border border-app-border rounded-xl hover:border-primary transition-all text-app-text"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === 'user' ? 'bg-primary text-white' : 'bg-app-secondary text-app-text-muted'
                      }`}>
                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                      </div>
                      <div className={`relative group p-4 rounded-2xl shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : 'bg-app-surface border border-app-border text-app-text rounded-tl-none'
                      }`}>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-inherit">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        <div className={`text-[10px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => copyToClipboard(msg.content)}
                            className="absolute top-2 right-2 p-1.5 bg-app-bg rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-app-text-muted hover:text-primary"
                            title="Copiar resposta"
                          >
                            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-app-secondary flex items-center justify-center animate-pulse">
                      <Bot size={16} className="text-app-text-muted" />
                    </div>
                    <div className="bg-app-surface border border-app-border p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
                      <Loader2 size={18} className="animate-spin text-primary" />
                      <span className="text-sm text-app-text-muted">Pensando...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-app-surface border-t border-app-border p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => setIsClearModalOpen(true)}
            className="p-2 text-app-text-muted hover:text-red-500 transition-colors"
            title="Limpar chat"
          >
            <Trash2 size={20} />
          </button>
          <form onSubmit={handleSend} className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedProcess ? `Perguntar sobre o processo ${selectedProcess.numero}...` : "Digite sua pergunta aqui..."}
              className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-primary outline-none transition-all text-app-text placeholder-app-text-muted"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
        <p className="text-[10px] text-center text-app-text-muted mt-2">
          A IA pode cometer erros. Verifique informações importantes.
        </p>
      </div>
    </div>
  );
}
