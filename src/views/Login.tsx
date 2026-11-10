import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context';
import { 
  Lock, 
  Mail, 
  Loader2, 
  Scale, 
  AlertCircle, 
  Info, 
  ShieldCheck, 
  KeyRound, 
  X as CloseIcon, 
  CheckCircle2, 
  UserPlus, 
  User, 
  Phone 
} from 'lucide-react';
import { CURRENT_APP_VERSION } from '../services/versionService';
import { Usuario } from '../types';
import { createAuthUserAdmin } from '../services/supabaseAuth';

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
  const [serverGoogleClientId, setServerGoogleClientId] = useState('');

  // Estados para Definição de Nova Senha (Link de Recuperação Supabase Auth)
  const [isSettingNewPassword, setIsSettingNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordStatus, setNewPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSavingNewPassword, setIsSavingNewPassword] = useState(false);

  // Estados para Cadastro de Novo Usuário na Tela Inicial
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerNome, setRegisterNome] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerOab, setRegisterOab] = useState('');
  const [registerContato, setRegisterContato] = useState('');
  const [registerSenha, setRegisterSenha] = useState('');
  const [registerConfirmSenha, setRegisterConfirmSenha] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerStatus, setRegisterStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterStatus(null);

    const cleanEmail = registerEmail.trim().toLowerCase();
    const cleanNome = registerNome.trim();
    if (!cleanNome) {
      setRegisterStatus({ type: 'error', message: 'Por favor, informe seu nome completo.' });
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setRegisterStatus({ type: 'error', message: 'Por favor, informe um e-mail válido.' });
      return;
    }
    if (registerSenha.length < 6) {
      setRegisterStatus({ type: 'error', message: 'A senha deve possuir no mínimo 6 caracteres.' });
      return;
    }
    if (registerSenha !== registerConfirmSenha) {
      setRegisterStatus({ type: 'error', message: 'A confirmação de senha não confere.' });
      return;
    }

    setIsRegistering(true);

    try {
      const newUserPayload: Partial<Usuario> = {
        nome: cleanNome,
        email: cleanEmail,
        senha: registerSenha,
        cargo: 'Advogado(a)',
        oab: registerOab.trim() || undefined,
        contato: registerContato.trim(),
        permissao: cleanEmail === 'pratadeouro@gmail.com' ? 'Admin' : 'user',
        escritoriosIds: cleanEmail === 'pratadeouro@gmail.com'
          ? (state.escritorios.length > 0 ? [state.escritorios[0].id] : ['1'])
          : [],
        status: 'Ativo'
      };

      const result = await createAuthUserAdmin(newUserPayload);

      if (result.success) {
        setRegisterStatus({ 
          type: 'success', 
          message: 'Cadastro concluído com sucesso! Iniciando sua sessão...' 
        });

        setTimeout(async () => {
          try {
            const loginSuccess = await login(cleanEmail, registerSenha);
            if (loginSuccess) {
              setIsRegisterOpen(false);
            } else {
              setEmail(cleanEmail);
              setSenha(registerSenha);
              setIsRegisterOpen(false);
            }
          } catch {
            setEmail(cleanEmail);
            setSenha(registerSenha);
            setIsRegisterOpen(false);
          }
        }, 1200);
      } else {
        setRegisterStatus({ 
          type: 'error', 
          message: result.error || 'Erro ao realizar o cadastro. Verifique os dados informados.' 
        });
      }
    } catch (err: any) {
      setRegisterStatus({ 
        type: 'error', 
        message: err.message || 'Erro inesperado ao cadastrar usuário.' 
      });
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsSettingNewPassword(true);
    }
  }, []);

  // Busca configurações públicas do servidor (.env e banco) mesmo se o cache do navegador estiver limpo
  useEffect(() => {
    fetch('/api/public/settings')
      .then(res => res.json())
      .then(data => {
        if (data?.googleClientId) {
          setServerGoogleClientId(data.googleClientId);
        }
      })
      .catch(() => {});
  }, []);

  // Client ID do Google configurado no .env do servidor, no estado global, no escritório, ou no cache local
  const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
  const googleClientId =
    serverGoogleClientId ||
    ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '') ||
    state.settings.googleClientId ||
    activeOffice?.googleClientId ||
    (typeof window !== 'undefined' ? (localStorage.getItem('advocacia_google_client_id') || '') : '') ||
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
            console.log('Google prompt not displayed/skipped, triggering rendered button click');
            const btnEl = googleBtnRef.current?.querySelector('div[role="button"]') as HTMLElement;
            if (btnEl) btnEl.click();
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
        use_fedcm_for_prompt: false,
        itp_support: true,
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

          {/* Opção para Cadastrar Novo Usuário na Tela Inicial */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => {
                setRegisterStatus(null);
                setRegisterNome('');
                setRegisterEmail('');
                setRegisterSenha('');
                setRegisterConfirmSenha('');
                setRegisterOab('');
                setRegisterContato('');
                setIsRegisterOpen(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-primary/20 hover:border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs transition-all"
            >
              <UserPlus size={16} />
              <span>Não tem uma conta? Cadastre-se</span>
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

      {/* Modal de Cadastro de Novo Usuário na Tela Inicial */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-app-surface border border-app-border max-w-lg w-full rounded-3xl p-6 shadow-2xl relative space-y-4 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-app-border pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-app-text text-base">Cadastrar Novo Usuário</h3>
                  <p className="text-xs text-app-text-muted">Crie seu acesso ao escritório jurídico</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="text-app-text-muted hover:text-app-text p-1.5 rounded-xl hover:bg-app-bg transition-colors"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4 overflow-y-auto pr-1">
              {registerStatus && (
                <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                  registerStatus.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-600 border border-red-500/20'
                }`}>
                  {registerStatus.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
                  <span>{registerStatus.message}</span>
                </div>
              )}

              {/* Nome Completo */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">Nome Completo *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                  <input
                    type="text"
                    required
                    value={registerNome}
                    onChange={(e) => setRegisterNome(e.target.value)}
                    placeholder="Ex: Dra. Mariana Albuquerque"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* E-mail de Acesso */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-app-text-muted uppercase">E-mail Profissional *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                  <input
                    type="email"
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="exemplo@adv.com.br"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* OAB */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-app-text-muted uppercase">Nº da OAB (Opcional)</label>
                  <div className="relative">
                    <Scale className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                    <input
                      type="text"
                      value={registerOab}
                      onChange={(e) => setRegisterOab(e.target.value)}
                      placeholder="Ex: 12345/AM"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                {/* Telefone / WhatsApp */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-app-text-muted uppercase">Telefone / WhatsApp (Opcional)</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                    <input
                      type="text"
                      value={registerContato}
                      onChange={(e) => setRegisterContato(e.target.value)}
                      placeholder="(92) 98765-4321"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Senha e Confirmação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-app-text-muted uppercase">Senha de Acesso *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={registerSenha}
                      onChange={(e) => setRegisterSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-app-text-muted uppercase">Confirmar Senha *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted" size={16} />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={registerConfirmSenha}
                      onChange={(e) => setRegisterConfirmSenha(e.target.value)}
                      placeholder="Repita a senha"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-app-border bg-app-bg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-app-border flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-app-text-muted hover:text-app-text rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50"
                >
                  {isRegistering ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                  <span>{isRegistering ? 'Cadastrando Usuário...' : 'Concluir Cadastro'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
