import React, { useState } from 'react';
import { useAppContext } from '../context';
import { 
  Building2, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  LogOut, 
  RefreshCw, 
  ShieldCheck, 
  Mail, 
  User, 
  Scale, 
  Phone,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

export default function AguardandoAprovacao() {
  const { currentUser, logout, forceLoad, refreshAuthUsers } = useAppContext();
  const [isChecking, setIsChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const userName = currentUser?.nome || 'Usuário';
  const userEmail = currentUser?.email || '';
  const userOab = currentUser?.oab;
  const userContato = currentUser?.contato;

  const handleCopyRequest = () => {
    const text = `Olá! Realizei meu cadastro no sistema Meu Escritório Jurídico com o e-mail: ${userEmail} (${userName}${userOab ? `, OAB: ${userOab}` : ''}). Por favor, vincule meu acesso ao escritório no menu de Usuários para liberar minhas permissões. Obrigado!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCheckAccess = async () => {
    setIsChecking(true);
    setCheckMessage(null);
    try {
      await refreshAuthUsers();
      await forceLoad();
      setCheckMessage('Dados atualizados. Se o administrador já vinculou o escritório, a página será redirecionada.');
      setTimeout(() => setCheckMessage(null), 4000);
    } catch (e) {
      setCheckMessage('Não foi possível verificar no momento. Tente novamente em instantes.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-500 relative overflow-hidden">
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-[-10%] right-[-10%] w-[35%] h-[35%] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[35%] h-[35%] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-2xl w-full bg-app-surface border border-app-border rounded-3xl shadow-2xl p-6 sm:p-10 relative z-10 space-y-8 animate-fadeIn">
        {/* Cabeçalho de Status */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Cadastro Concluído com Sucesso
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Clock size={14} className="text-amber-500 animate-pulse" />
              Aguardando Vinculação
            </span>
          </div>

          <div className="mx-auto w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center shadow-inner transform rotate-1 hover:rotate-0 transition-transform">
            <Building2 size={40} />
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-app-text tracking-tight mb-2">
              Seu cadastro foi concluído!
            </h1>
            <p className="text-sm sm:text-base text-app-text-muted max-w-lg mx-auto leading-relaxed">
              Olá, <strong className="text-app-text font-bold">{userName}</strong>. Para acessar os processos, prazos e documentos, <strong className="text-primary font-bold">solicite acesso ao administrador do escritório</strong>.
            </p>
          </div>
        </div>

        {/* Card com os dados do cadastro */}
        <div className="bg-app-bg/60 border border-app-border rounded-2xl p-4 sm:p-5 space-y-3">
          <h2 className="text-xs font-bold text-app-text-muted uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            Dados da sua conta cadastrada
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-app-surface/80 border border-app-border/50">
              <User size={16} className="text-app-text-muted shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-app-text-muted block font-medium">Nome</span>
                <span className="font-semibold text-app-text truncate block">{userName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-app-surface/80 border border-app-border/50">
              <Mail size={16} className="text-app-text-muted shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-app-text-muted block font-medium">E-mail</span>
                <span className="font-semibold text-app-text truncate block">{userEmail}</span>
              </div>
            </div>

            {userOab && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-app-surface/80 border border-app-border/50">
                <Scale size={16} className="text-app-text-muted shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-app-text-muted block font-medium">Inscrição OAB</span>
                  <span className="font-semibold text-app-text truncate block">{userOab}</span>
                </div>
              </div>
            )}

            {userContato && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-app-surface/80 border border-app-border/50">
                <Phone size={16} className="text-app-text-muted shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-app-text-muted block font-medium">Contato</span>
                  <span className="font-semibold text-app-text truncate block">{userContato}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* O que fazer agora? (Instruções práticas) */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-app-text uppercase tracking-wider flex items-center gap-2">
            <HelpCircle size={16} className="text-amber-500" />
            Como liberar o meu acesso?
          </h2>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 sm:p-5 space-y-3 text-xs leading-relaxed text-app-text-muted">
            <ol className="list-decimal list-inside space-y-2 text-xs">
              <li>
                <strong className="text-app-text font-semibold">Envie sua mensagem ao Administrador:</strong> Clique no botão abaixo para copiar a solicitação de acesso e envie via WhatsApp ou e-mail para o responsável pelo escritório.
              </li>
              <li>
                <strong className="text-app-text font-semibold">Liberação pelo Administrador:</strong> O administrador acessará o menu <span className="font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded text-[11px]">Usuários</span> e vinculará sua conta ao escritório correspondente.
              </li>
              <li>
                <strong className="text-app-text font-semibold">Acesso imediato:</strong> Assim que ele salvar, clique em <strong className="text-app-text">"Verificar Acesso"</strong> ou recarregue a página para entrar no painel.
              </li>
            </ol>
          </div>
        </div>

        {checkMessage && (
          <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs rounded-xl text-center font-medium animate-fadeIn">
            {checkMessage}
          </div>
        )}

        {/* Botões de Ação */}
        <div className="space-y-3 pt-2 border-t border-app-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleCopyRequest}
              className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-app-border bg-app-surface hover:bg-app-bg text-app-text font-bold text-xs transition-all shadow-sm hover:shadow"
            >
              {copied ? (
                <>
                  <Check size={16} className="text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Solicitação Copiada!</span>
                </>
              ) : (
                <>
                  <Copy size={16} className="text-primary" />
                  <span>Copiar Mensagem para o Admin</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCheckAccess}
              disabled={isChecking}
              className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-all shadow-lg hover:shadow-primary/30 disabled:opacity-50"
            >
              <RefreshCw size={16} className={isChecking ? 'animate-spin' : ''} />
              <span>{isChecking ? 'Verificando...' : 'Verificar Acesso'}</span>
            </button>
          </div>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-xs text-app-text-muted hover:text-red-500 font-semibold transition-colors py-2 px-3 rounded-lg"
            >
              <LogOut size={14} />
              <span>Sair da conta e voltar ao login</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
