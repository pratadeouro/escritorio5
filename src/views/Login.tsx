import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context';
import { Lock, Mail, Loader2, Scale, AlertCircle, Info, ShieldCheck, KeyRound, X as CloseIcon, CheckCircle2 } from 'lucide-react';
import { CURRENT_APP_VERSION } from '../services/versionService';

declare global {
  interface Window {
    google?: any;
  }
}

export default function Login() {
  const { state, login, loginWithGoogleEmail, forceLoad, isImporting, activeOfficeName, escritorioAtivoId, resetPassword, updatePassword } = useAppContext();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [cachedOfficeName, setCachedOfficeName] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Estados para Solicitação de Redefinição de Senha (Supabase Auth)
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showGoogleHelp, setShowGoogleHelp] = useState(false);

  // Estados para Definição de Nova Senha (Link de Recuperação Supabase Auth)
  const [isSettingNewPassword, setIsSettingNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordStatus, setNewPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSavingNewPassword, setIsSavingNewPassword] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsSettingNewPassword(true);
    }
  }, []);

  // Client ID do Google configurado globalmente, no escritório, ou no cache local
  const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
  const googleClientId =
    state.settings.googleClientId ||
    activeOffice?.googleClientId ||
    (typeof window !== 'undefined' ? (localStorage.getItem('advocacia_google_client_id') || '') : '') ||
    ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '') ||
    '';

  const handleGoogleBtnClick = () => {
    if (!googleClientId) {
      setShowGoogleHelp(true);
      return;
    }
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
            console.log('Google prompt status:', notification.getNotDisplayedReason?.() || 'skipped');
          }
        });
      } catch (e) {
        console.error('Erro ao acionar prompt do Google:', e);
      }
    } else {
      setError('Biblioteca do Google Identity Services não carregou. Verifique sua conexão à internet.');
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('advocacia_theme_cache');
    if (cached) {
      try {
        const { officeName } = JSON.parse(cached);
        if (officeName) setCachedOfficeName(officeName);
      } catch (e) {}
    }
  }, []);

  const officeName = activeOfficeName || cachedOfficeName;


  // Decodifica JWT do Google sem dependências externas
  const decodeGoogleCredential = (credential: string): { email?: string; name?: string; sub?: string } | null => {
    try {
      const parts = credential.split('.');
      if (parts.length < 2) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Erro ao decodificar credencial do Google:', e);
      return null;
    }
  };

  // Inicializa Google Identity Services (GSI) caso exista Client ID configurado
  useEffect(() => {
    if (!googleClientId || !window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: any) => {
          if (!response?.credential) return;
          const payload = decodeGoogleCredential(response.credential);
          if (payload?.email) {
            setIsGoogleLoading(true);
            setError('');
            try {
              const success = await loginWithGoogleEmail(payload.email);
              if (!success) {
                setError(`A conta Google ${payload.email} não possui acesso cadastrado no sistema.`);
              }
            } catch (err) {
              setError('Falha ao autenticar com a conta Google.');
            } finally {
              setIsGoogleLoading(false);
            }
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: '100%',
        });
      }
    } catch (err) {
      console.warn('Google GSI initialize notice:', err);
    }
  }, [googleClientId, loginWithGoogleEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(email, senha);
      if (!success) {
        setError('E-mail ou senha incorretos.');
      }
    } catch (err) {
      setError('E-mail ou senha incorretos.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');

    if (!googleClientId) {
      setError('A autenticação com Google (OAuth 2.0) não está configurada para este escritório. Por favor, utilize os campos de e-mail e senha convencionais acima para acessar.');
      return;
    }

    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
      } catch (err) {
        console.warn('Erro ao acionar prompt do Google:', err);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setIsResetting(true);
    setResetStatus(null);
    try {
      const res = await resetPassword(resetEmail);
      if (res.success) {
        setResetStatus({ type: 'success', message: res.message });
      } else {
        setResetStatus({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setResetStatus({ type: 'error', message: err.message || 'Erro ao enviar redefinição.' });
    } finally {
      setIsResetting(false);
    }
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setNewPasswordStatus({ type: 'error', message: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNewPasswordStatus({ type: 'error', message: 'As senhas digitadas não coincidem.' });
      return;
    }

    setIsSavingNewPassword(true);
    setNewPasswordStatus(null);
    try {
      const res = await updatePassword(newPassword);
      if (res.success) {
        setNewPasswordStatus({ type: 'success', message: 'Senha atualizada com sucesso no Supabase Auth! Redirecionando...' });
        if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        setTimeout(() => {
          setIsSettingNewPassword(false);
          window.location.reload();
        }, 1200);
      } else {
        setNewPasswordStatus({ type: 'error', message: res.message || 'Erro ao redefinir senha no Supabase.' });
      }
    } catch (err: any) {
      setNewPasswordStatus({ type: 'error', message: err.message || 'Erro inesperado ao salvar nova senha.' });
    } finally {
      setIsSavingNewPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-bg p-4 transition-colors duration-700 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="max-w-md w-full space-y-8 bg-app-surface/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-app-border relative z-10 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
        
        <div className="text-center relative z-10">
          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Ambiente de homologação
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck size={13} />
              Supabase Auth Híbrido
            </div>
          </div>
          <div className="mx-auto h-20 w-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <Scale className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-4xl font-black text-app-text tracking-tighter leading-tight mb-2">
            {officeName && officeName !== 'Todos os Escritórios' && officeName !== 'LexGestão' ? officeName : 'Meu Escritório Jurídico'}
          </h2>
          <p className="text-sm text-app-text-muted font-medium">
            Escritório Jurídico
          </p>
        </div>

        {isImporting && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-center text-primary text-xs font-semibold animate-pulse">
            <Loader2 className="animate-spin mr-3" size={16} />
            Sincronizando ambiente jurídico...
          </div>
        )}

        <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-app-text-muted uppercase ml-1">E-mail de Acesso</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-app-text-muted group-focus-within:text-primary transition-colors" size={18} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none rounded-xl relative block w-full px-12 py-3.5 border border-app-border placeholder-app-text-muted/50 text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all sm:text-sm bg-app-bg/50 backdrop-blur-sm"
                  placeholder="exemplo@adv.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-app-text-muted uppercase ml-1">Senha Segura</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-app-text-muted group-focus-within:text-primary transition-colors" size={18} />
                <input
                  id="senha"
                  name="senha"
                  type="password"
                  required
                  className="appearance-none rounded-xl relative block w-full px-12 py-3.5 border border-app-border placeholder-app-text-muted/50 text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all sm:text-sm bg-app-bg/50 backdrop-blur-sm"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetStatus(null);
                    setIsResetOpen(true);
                  }}
                  className="text-xs font-semibold text-primary hover:underline transition-all"
                >
                  Esqueceu a senha?
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-xs font-bold text-center bg-red-500/5 py-3 rounded-xl border border-red-500/20 animate-bounce">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading || isImporting}
            className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-primary/30"
          >
            {isLoading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              'Acessar Sistema'
            )}
          </button>

          {/* Divisor Visual */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-app-border"></div>
            <span className="flex-shrink mx-3 text-xs uppercase font-semibold text-app-text-muted tracking-wider">
              ou
            </span>
            <div className="flex-grow border-t border-app-border"></div>
          </div>

          {/* Botão de Login com o Google */}
          <div className="space-y-2">
            {/* O container para o botão nativo do Google GSI (quando inicializado) */}
            <div ref={googleBtnRef} className="w-full flex justify-center empty:hidden min-h-[44px]" />

            {/* Botão com design premium e logotipo SVG oficial do Google */}
            <button
              type="button"
              onClick={handleGoogleBtnClick}
              disabled={isLoading || isGoogleLoading || isImporting}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border border-app-border bg-app-surface/90 hover:bg-app-bg text-app-text font-semibold text-sm transition-all shadow-sm hover:shadow hover:border-gray-400 dark:hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.13C3.25 21.35 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.57H1.27C.46 8.2 0 10.04 0 12s.46 3.8 1.27 5.43l4.01-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.65 1.27 6.57l4.01 3.14c.95-2.83 3.6-4.96 6.72-4.96z"
                  />
                </svg>
              )}
              <span>{isGoogleLoading ? 'Autenticando com Google...' : 'Entrar com o Google'}</span>
            </button>
          </div>
        </form>

        <div className="text-center pt-6 border-t border-app-border space-y-1">
          <p className="text-[10px] items-center justify-center font-bold text-app-text-muted uppercase tracking-[0.2em]">
            &copy; {new Date().getFullYear()} {officeName && officeName !== 'Todos os Escritórios' && officeName !== 'LexGestão' ? officeName : 'Meu Escritório Jurídico'}
          </p>
          <p className="text-[10px] font-medium text-app-text-muted/70 tracking-wider font-mono">
            Versão {CURRENT_APP_VERSION}
          </p>
        </div>
      </div>

      {/* Modal de Recuperação de Senha (Supabase Auth) */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-app-surface border border-app-border max-w-md w-full rounded-3xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-app-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-app-text text-base">Recuperar Senha</h3>
                  <p className="text-xs text-app-text-muted">Redefinição segura via Supabase Auth</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetOpen(false)}
                className="text-app-text-muted hover:text-app-text p-1 rounded-lg"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-xs text-app-text-muted leading-relaxed">
                Digite o seu e-mail cadastrado. Enviaremos um link seguro para você definir uma nova senha no Supabase.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">E-mail Cadastrado</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="seuemail@adv.com.br"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {resetStatus && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  resetStatus.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-600 border border-red-500/20'
                }`}>
                  {resetStatus.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                  <span>{resetStatus.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-app-text-muted hover:text-app-text rounded-xl"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={isResetting || !resetEmail}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {isResetting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  {isResetting ? 'Enviando...' : 'Enviar Link de Redefinição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Definição de Nova Senha (Acesso via link de recuperação do Supabase) */}
      {isSettingNewPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-app-surface border border-app-border max-w-md w-full rounded-3xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-app-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-app-text text-base">Definir Nova Senha</h3>
                  <p className="text-xs text-app-text-muted">Supabase Auth Security</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveNewPassword} className="space-y-4">
              <p className="text-xs text-app-text-muted leading-relaxed">
                Você acessou o link de redefinição de senha com sucesso. Digite sua nova senha de acesso abaixo.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Nova Senha (mínimo 6 caracteres)</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Confirmar Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {newPasswordStatus && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  newPasswordStatus.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-600 border border-red-500/20'
                }`}>
                  {newPasswordStatus.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                  <span>{newPasswordStatus.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingNewPassword || !newPassword || !confirmPassword}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {isSavingNewPassword ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {isSavingNewPassword ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Informativo sobre Google Client ID */}
      {showGoogleHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-app-surface border border-app-border max-w-md w-full rounded-3xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-app-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
                  <Info size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-app-text text-base">Google Client ID</h3>
                  <p className="text-xs text-app-text-muted">Autenticação com a Conta Google</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleHelp(false)}
                className="text-app-text-muted hover:text-app-text p-1 rounded-lg"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-app-text-muted leading-relaxed">
              <p>
                O <strong className="text-app-text">Google Client ID</strong> ainda não foi informado nas configurações globais deste sistema.
              </p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-amber-700 dark:text-amber-400 space-y-2">
                <p className="font-semibold text-xs">Instruções para o Administrador:</p>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Faça login com sua conta de administrador por e-mail e senha.</li>
                  <li>No menu lateral, acesse <strong className="font-bold">Configurações Globais</strong>.</li>
                  <li>Na aba <strong className="font-bold">Google OAuth & Login</strong>, informe o seu <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono text-[10px]">Client ID</code>.</li>
                  <li>Salve as alterações. O botão de login do Google passará a validar as contas autorizadas diretamente.</li>
                </ol>
              </div>
              <p className="text-[11px]">
                Você também pode acessar utilizando seu e-mail e senha cadastrados no formulário de login.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowGoogleHelp(false)}
                className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl text-xs hover:bg-primary/90 transition shadow-md"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
