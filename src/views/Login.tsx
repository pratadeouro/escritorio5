import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context';
import { Lock, Mail, Loader2, Scale, AlertCircle, Info } from 'lucide-react';
import { CURRENT_APP_VERSION } from '../services/versionService';

declare global {
  interface Window {
    google?: any;
  }
}

export default function Login() {
  const { state, login, loginWithGoogleEmail, forceLoad, isImporting, activeOfficeName, escritorioAtivoId } = useAppContext();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [cachedOfficeName, setCachedOfficeName] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Client ID do Google configurado no escritório ou nas configurações gerais
  const activeOffice = state.escritorios.find(e => e.id === escritorioAtivoId);
  const googleClientId = activeOffice?.googleClientId || state.settings.googleClientId || '';

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

  // Sincronizar ao entrar na página de login, apenas se ainda não carregamos dados
  useEffect(() => {
    if (!state.hasLoaded) {
      forceLoad();
    }
  }, [state.hasLoaded, forceLoad]);

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
      setError('Ocorreu um erro ao tentar fazer login.');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-bg p-4 transition-colors duration-700 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="max-w-md w-full space-y-8 bg-app-surface/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-app-border relative z-10 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
        
        <div className="text-center relative z-10">
          <div className="mx-auto h-20 w-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <Scale className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-4xl font-black text-app-text tracking-tighter leading-tight mb-2">
            {officeName || 'LexGestão'}
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
        </form>

        <div className="text-center pt-6 border-t border-app-border space-y-1">
          <p className="text-[10px] items-center justify-center font-bold text-app-text-muted uppercase tracking-[0.2em]">
            &copy; {new Date().getFullYear()} {officeName || 'Meu Escritório'}
          </p>
          <p className="text-[10px] font-medium text-app-text-muted/70 tracking-wider font-mono">
            Versão {CURRENT_APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}
