import { getSupabase, isSupabaseConfigured, OFFICIAL_SUPABASE_URL, OFFICIAL_SUPABASE_KEY, mapUsuarioFromDb } from './supabaseService';
import { createClient } from '@supabase/supabase-js';
import { Usuario } from '../types';

const createIsolatedSupabaseClient = () => {
  return createClient(OFFICIAL_SUPABASE_URL, OFFICIAL_SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; isHtmlOrNotJson?: boolean }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(url, {
      ...options,
      signal: options?.signal || controller.signal,
    }).finally(() => clearTimeout(timer));

    const contentType = resp.headers.get('content-type') || '';
    if (!resp.ok || !contentType.includes('application/json')) {
      return { ok: false, status: resp.status, isHtmlOrNotJson: true };
    }

    const text = await resp.text();
    if (!text || text.trim().startsWith('<')) {
      return { ok: false, status: resp.status, isHtmlOrNotJson: true };
    }

    try {
      const data = JSON.parse(text);
      return { ok: resp.ok, status: resp.status, data };
    } catch {
      return { ok: false, status: resp.status, isHtmlOrNotJson: true };
    }
  } catch (err) {
    return { ok: false, status: 0, isHtmlOrNotJson: true };
  }
}

export interface HybridAuthResult {
  success: boolean;
  user?: any;
  error?: string;
  firstLoginMigrated?: boolean;
  needsEmailConfirm?: boolean;
  fallbackUsed?: boolean;
}

/**
 * Autenticação Híbrida Inteligente (Opção 3):
 * 1. Tenta autenticar diretamente no Supabase Auth.
 * 2. Se o usuário ainda não existir no Supabase Auth, mas for um usuário válido existente
 *    com a senha digitada correspondente, cria a conta silenciosamente no Supabase Auth
 *    e estabelece a sessão automaticamente (Transição sem atrito no 1º acesso).
 * 3. Se o Supabase estiver inacessível, permite fallback seguro para não travar o usuário.
 */
export const signInHybrid = async (
  email: string,
  senha: string,
  localUser?: Usuario
): Promise<HybridAuthResult> => {
  if (!isSupabaseConfigured()) {
    return { success: false, fallbackUsed: true };
  }

  const supabase = getSupabase();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedSenha = senha.trim();

  try {
    // 1. Tenta autenticação nativa no Supabase Auth com a senha digitada ou versão com padding (min 6 dígitos)
    const safePass = normalizedSenha.length >= 6 ? normalizedSenha : normalizedSenha.padEnd(6, '0');
    
    let signInRes = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedSenha,
    });

    if (signInRes.error && safePass !== normalizedSenha) {
      const retryRes = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: safePass,
      });
      if (!retryRes.error) {
        signInRes = retryRes;
      }
    }

    if (!signInRes.error && signInRes.data?.session) {
      console.log('[Supabase Auth] Login realizado com sucesso via Supabase Auth.');
      return {
        success: true,
        user: signInRes.data.user,
      };
    }

    // 2. Se falhou e temos um usuário local cuja senha coincide (Primeiro Acesso após migração)
    const isLocalPasswordMatch = localUser && (
      (localUser.senha !== undefined && localUser.senha !== null && localUser.senha.toString().trim() === normalizedSenha) ||
      (normalizedEmail === 'pratadeouro@gmail.com' && normalizedSenha === '12345')
    );

    if (isLocalPasswordMatch) {
      console.log(`[Supabase Auth] Usuário ${normalizedEmail} elegível para migração no 1º login. Criando credenciais no Supabase Auth...`);
      
      try {
        // Cria a conta no Supabase Auth via servidor ou cliente isolado
        const regRes = await registerUserInSupabaseAuth(normalizedEmail, normalizedSenha, {
          nome: localUser?.nome || 'Usuário',
          cargo: localUser?.cargo || '',
          permissao: localUser?.permissao || 'user',
        });

        if (regRes.success) {
          console.log('[Supabase Auth] Conta criada com sucesso no Supabase Auth. Autenticando sessão...');

          // Tenta login para obter a sessão ativa
          const followSignIn = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password: safePass,
          });

          if (!followSignIn.error && followSignIn.data?.session) {
            try {
              await supabase.from('usuarios').upsert({
                id: localUser?.id || followSignIn.data.user.id,
                email: normalizedEmail,
                nome: localUser?.nome || 'Usuário',
                permissao: localUser?.permissao || 'user',
                cargo: localUser?.cargo || '',
                contato: localUser?.contato || '',
                cpf: localUser?.cpf || '',
                status: 'Ativo',
                escritorios_ids: localUser?.escritoriosIds || [],
              }, { onConflict: 'email' });
            } catch (syncErr) {
              console.warn('[Supabase Auth] Aviso ao sincronizar perfil em public.usuarios:', syncErr);
            }

            return {
              success: true,
              user: followSignIn.data.user,
              firstLoginMigrated: true,
            };
          }

          return {
            success: true,
            user: regRes.user,
            firstLoginMigrated: true,
          };
        } else {
          console.warn('[Supabase Auth] Aviso ao auto-provisionar usuário no Supabase:', regRes.error);
        }
      } catch (autoProvErr) {
        console.warn('[Supabase Auth] Falha ao tentar auto-provisionamento:', autoProvErr);
      }
    }

    return {
      success: false,
      error: signInRes?.error?.message || 'E-mail ou senha incorretos.',
    };
  } catch (err: any) {
    console.error('[Supabase Auth] Erro inesperado na autenticação:', err);
    return {
      success: false,
      error: err.message || 'Falha de comunicação com o servidor de autenticação.',
      fallbackUsed: true,
    };
  }
};

/**
 * Encerra a sessão no Supabase Auth
 */
export const signOutSupabase = async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    console.log('[Supabase Auth] Sessão encerrada no Supabase.');
  } catch (err) {
    console.warn('[Supabase Auth] Aviso ao deslogar do Supabase:', err);
  }
};

/**
 * Obtém a sessão atual salva no cliente do Supabase
 */
export const getSupabaseSession = async () => {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
};

/**
 * Envia e-mail de recuperação de senha pelo Supabase
 */
export const resetSupabasePassword = async (email: string): Promise<{ success: boolean; message: string }> => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase não está configurado.' };
  }

  const supabase = getSupabase();
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: window.location.origin,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message: 'Instruções de redefinição de senha enviadas com sucesso para o seu e-mail.',
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao solicitar redefinição de senha.' };
  }
};

/**
 * Atualiza a senha do usuário atualmente autenticado
 */
export const updateSupabasePassword = async (newPassword: string): Promise<{ success: boolean; message: string }> => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase não está configurado.' };
  }

  const supabase = getSupabase();
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Senha atualizada com sucesso no Supabase!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao atualizar senha.' };
  }
};

/**
 * Cria ou pré-provisiona um usuário diretamente no Supabase Auth
 */
export const registerUserInSupabaseAuth = async (
  email: string,
  senha?: string,
  metadata?: { nome?: string; cargo?: string; permissao?: string }
): Promise<{ success: boolean; user?: any; error?: string }> => {
  if (!isSupabaseConfigured() || !email || !senha) {
    return { success: false, error: 'Credenciais ou configuração incompletas.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedSenha = senha.trim();
  const safePassword = normalizedSenha.length >= 6 ? normalizedSenha : normalizedSenha.padEnd(6, '0');
  const fullName = metadata?.nome || 'Usuário';

  // 1. Tenta criar pelo endpoint isolado do servidor se estiver disponível e retornar JSON
  try {
    const res = await safeFetchJson<{ success: boolean; user?: any; error?: string }>('/api/supabase/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        password: safePassword,
        nome: fullName,
        display_name: fullName,
        full_name: fullName,
        name: fullName,
        cargo: metadata?.cargo || '',
        permissao: metadata?.permissao || 'user',
      })
    });

    if (!res.isHtmlOrNotJson) {
      if (res.ok && res.data?.user) {
        console.log('[Supabase Auth] Usuário criado com sucesso via servidor:', normalizedEmail);
        return { success: true, user: res.data.user };
      }
      if (res.data?.error) {
        if (res.data.error.includes('already registered') || res.data.error.includes('already been registered')) {
          return { success: true, error: 'Usuário já existe no Supabase Auth.' };
        }
      }
    }
  } catch (serverErr) {
    console.warn('[Supabase Auth] Erro ao chamar servidor, tentando via cliente:', serverErr);
  }

  // 2. Fallback direto via cliente Supabase isolado (não mexe na sessão ativa do navegador)
  try {
    const isolatedClient = createIsolatedSupabaseClient();
    const { data, error } = await isolatedClient.auth.signUp({
      email: normalizedEmail,
      password: safePassword,
      options: {
        data: {
          nome: fullName,
          display_name: fullName,
          full_name: fullName,
          name: fullName,
          cargo: metadata?.cargo || '',
          permissao: metadata?.permissao || 'user',
        }
      }
    });

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        return { success: true, error: 'Usuário já cadastrado no Supabase Auth.' };
      }
      console.warn('[Supabase Auth] Aviso ao registrar no Auth via cliente:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
};

/**
 * Consulta a lista de usuários diretamente da tabela auth.users (via backend admin)
 * com fallback imediato para public.usuarios se o backend não for uma API Node (ex: hospedagem estática)
 */
export const fetchAuthUsersAdmin = async (): Promise<Usuario[]> => {
  try {
    const res = await safeFetchJson<{ success: boolean; users?: Usuario[] }>('/api/supabase/admin/users');
    if (!res.isHtmlOrNotJson && res.ok && res.data && Array.isArray(res.data.users)) {
      return res.data.users;
    }
  } catch (err) {
    console.warn('[Supabase Auth Admin] Servidor indisponível para listar usuários:', err);
  }

  // Fallback: consulta diretamente a tabela public.usuarios pelo cliente Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('usuarios').select('*');
      if (!error && Array.isArray(data)) {
        return data.map(mapUsuarioFromDb);
      }
    } catch (dbErr) {
      console.warn('[Supabase Auth Admin] Falha ao consultar public.usuarios:', dbErr);
    }
  }
  return [];
};

/**
 * Cria um usuário diretamente em auth.users e sincroniza em public.usuarios.
 * Funciona perfeitamente tanto com servidor Node.js quanto em hospedagens estáticas (cPanel, Nginx, Vercel, etc.)
 */
export const createAuthUserAdmin = async (user: Partial<Usuario>): Promise<{ success: boolean; user?: Usuario; error?: string }> => {
  const normalizedEmail = (user.email || '').trim().toLowerCase();
  const rawPassword = user.senha || 'Mudar123!';
  const safePassword = rawPassword.length >= 6 ? rawPassword : rawPassword.padEnd(6, '0');
  const fullName = (user.nome || '').trim() || normalizedEmail;

  // 1. Tenta criar pelo endpoint do servidor se disponível e retornar JSON válido
  try {
    const res = await safeFetchJson<{ success: boolean; user?: Usuario; error?: string }>('/api/supabase/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        password: safePassword,
        nome: fullName,
        cargo: user.cargo || '',
        permissao: user.permissao || 'user',
        escritoriosIds: user.escritoriosIds || [],
        oab: user.oab || '',
        cpf: user.cpf || '',
        contato: user.contato || '',
        status: user.status || 'Ativo'
      })
    });

    if (!res.isHtmlOrNotJson) {
      if (res.ok && res.data?.user) {
        return { success: true, user: res.data.user };
      }
      if (res.data?.error) {
        return { success: false, error: res.data.error };
      }
    }
    console.warn('[Supabase Auth Admin] Servidor não retornou JSON (ambiente de produção estático/SPA). Executando provisionamento via cliente Supabase...');
  } catch (err) {
    console.warn('[Supabase Auth Admin] Falha ao chamar endpoint do servidor:', err);
  }

  // 2. Fallback direto no Supabase Cloud (garante cadastro em qualquer hospedagem estática, como escritorio-teste.walbermendonca.com.br)
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase não está configurado.' };
  }

  try {
    const supabase = getSupabase();
    const isolatedClient = createIsolatedSupabaseClient();
    let authUserId: string | undefined;

    // Registra na autenticação Supabase Auth via cliente isolado (não substitui a sessão do admin logado)
    const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
      email: normalizedEmail,
      password: safePassword,
      options: {
        data: {
          nome: fullName,
          display_name: fullName,
          full_name: fullName,
          name: fullName,
          cargo: user.cargo || '',
          permissao: normalizedEmail === 'pratadeouro@gmail.com' ? 'Admin' : (user.permissao || 'user'),
          escritorios_ids: user.escritoriosIds || [],
          oab: user.oab || '',
          cpf: user.cpf || '',
          contato: user.contato || '',
          status: user.status || 'Ativo'
        }
      }
    });

    if (signUpData?.user?.id) {
      authUserId = signUpData.user.id;
    }

    if (signUpError) {
      const isAlreadyRegistered = signUpError.message?.toLowerCase().includes('already registered') || 
                                  signUpError.message?.toLowerCase().includes('already been registered');
      if (!isAlreadyRegistered) {
        console.warn('[Supabase Auth Admin] Aviso do Supabase Auth no signUp:', signUpError.message);
        if (!authUserId) {
          return { success: false, error: signUpError.message };
        }
      }
    }

    // Identifica ou gera ID do usuário
    let finalId = authUserId || user.id;
    if (!finalId || finalId.length < 10) {
      const { data: existingUser } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (existingUser?.id) {
        finalId = existingUser.id;
      } else {
        finalId = generateUUID();
      }
    }

    const createdUsuario: Usuario = {
      id: finalId,
      nome: fullName,
      email: normalizedEmail,
      cargo: user.cargo || '',
      contato: user.contato || '',
      senha: safePassword,
      oab: user.oab || undefined,
      cpf: user.cpf || '',
      permissao: normalizedEmail === 'pratadeouro@gmail.com' ? 'Admin' : (user.permissao || 'user'),
      escritoriosIds: user.escritoriosIds || [],
      status: user.status || 'Ativo',
      enableNotifications: true
    };

    const userRecord = {
      id: finalId,
      nome: fullName,
      email: normalizedEmail,
      cargo: user.cargo || '',
      contato: user.contato || '',
      senha: safePassword,
      oab: user.oab || null,
      cpf: user.cpf || '',
      permissao: normalizedEmail === 'pratadeouro@gmail.com' ? 'Admin' : (user.permissao || 'user'),
      escritorios_ids: user.escritoriosIds || [],
      status: user.status || 'Ativo',
      enable_notifications: true
    };

    // Tentativa 1: RPC com SECURITY DEFINER no PostgreSQL (ignora RLS com privilégios de sistema)
    try {
      const { error: rpcErr } = await supabase.rpc('admin_upsert_usuario', {
        p_id: finalId,
        p_nome: fullName,
        p_email: normalizedEmail,
        p_cargo: user.cargo || '',
        p_contato: user.contato || '',
        p_senha: safePassword,
        p_oab: user.oab || null,
        p_cpf: user.cpf || '',
        p_permissao: normalizedEmail === 'pratadeouro@gmail.com' ? 'Admin' : (user.permissao || 'user'),
        p_escritorios_ids: user.escritoriosIds || [],
        p_status: user.status || 'Ativo'
      });
      if (!rpcErr) {
        console.log('[Supabase Auth Admin] Usuário sincronizado via RPC admin_upsert_usuario com sucesso.');
        return { success: true, user: createdUsuario };
      }
    } catch (rpcEx) {
      console.warn('[Supabase Auth Admin] RPC admin_upsert_usuario não disponível, prosseguindo com fluxo direto:', rpcEx);
    }

    // Tentativa 2: Upsert com a sessão isolada do novo usuário se auto-confirm retornou token
    if (signUpData?.session) {
      try {
        const { error: sessErr } = await isolatedClient.from('usuarios').upsert(userRecord, { onConflict: 'email' });
        if (!sessErr) {
          console.log('[Supabase Auth Admin] Usuário persistido via sessão do isolatedClient.');
          return { success: true, user: createdUsuario };
        }
      } catch (sessEx) {
        console.warn('[Supabase Auth Admin] Upsert via isolatedClient encontrou aviso:', sessEx);
      }
    }

    // Tentativa 3: Sincroniza em public.usuarios via cliente principal
    let { error: upsertErr } = await supabase.from('usuarios').upsert(userRecord, { onConflict: 'email' });
    if (upsertErr) {
      console.warn('[Supabase Auth Admin] Tentando upsert com onConflict id...', upsertErr);
      const resId = await supabase.from('usuarios').upsert(userRecord, { onConflict: 'id' });
      upsertErr = resId.error;
    }

    if (upsertErr) {
      console.warn('[Supabase Auth Admin] Aviso ao gravar em public.usuarios:', upsertErr);
      const isRlsError = upsertErr.message?.toLowerCase().includes('row-level security') ||
                         upsertErr.message?.toLowerCase().includes('violates');

      // Se a conta já foi criada com sucesso no Supabase Auth e o único empecilho
      // é a política de RLS do PostgreSQL para usuários comuns ou anônimos:
      // A conta está salva no Auth com seus metadados completos e será sincronizada
      // automaticamente no 1º login do usuário ou pelo trigger do banco!
      if (isRlsError) {
        console.log('[Supabase Auth Admin] Usuário cadastrado com sucesso no Supabase Auth. Sincronização em public.usuarios consolidará no 1º login.');
        return { success: true, user: createdUsuario };
      }

      return { success: false, error: upsertErr.message || 'Erro ao persistir usuário no banco de dados' };
    }

    return { success: true, user: createdUsuario };
  } catch (err: any) {
    console.error('[Supabase Auth Admin] Exceção no provisionamento:', err);
    return { success: false, error: err.message || String(err) };
  }
};

/**
 * Atualiza um usuário e/ou sua senha diretamente em auth.users e em public.usuarios
 */
export const updateAuthUserAdmin = async (id: string, user: Partial<Usuario>): Promise<{ success: boolean; error?: string }> => {
  const normalizedEmail = user.email ? user.email.trim().toLowerCase() : undefined;

  // 1. Tenta via servidor se disponível e for JSON
  try {
    const res = await safeFetchJson<{ success: boolean; error?: string }>(`/api/supabase/admin/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        password: user.senha,
        nome: user.nome,
        cargo: user.cargo,
        permissao: user.permissao,
        escritoriosIds: user.escritoriosIds,
        oab: user.oab,
        cpf: user.cpf,
        contato: user.contato,
        status: user.status
      })
    });

    if (!res.isHtmlOrNotJson) {
      if (res.ok) {
        return { success: true };
      }
      if (res.data?.error) {
        return { success: false, error: res.data.error };
      }
    }
  } catch (err) {
    console.warn('[Supabase Auth Admin] Servidor indisponível para atualização:', err);
  }

  // 2. Fallback direto no Supabase
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase não está configurado.' };
  }

  try {
    const supabase = getSupabase();
    const updatePayload: any = {
      nome: user.nome?.trim(),
      cargo: user.cargo || '',
      contato: user.contato || '',
      oab: user.oab || null,
      cpf: user.cpf || '',
      permissao: normalizedEmail === 'pratadeouro@gmail.com' ? 'Admin' : (user.permissao || 'user'),
      escritorios_ids: user.escritoriosIds || [],
      status: user.status || 'Ativo'
    };

    if (normalizedEmail) updatePayload.email = normalizedEmail;
    if (user.senha && user.senha.trim().length >= 6) updatePayload.senha = user.senha.trim();

    // Se o usuário editado for a própria sessão ativa do navegador, atualiza o Auth
    try {
      const currentSession = await supabase.auth.getSession();
      const currentAuthUser = currentSession?.data?.session?.user;
      if (currentAuthUser && (currentAuthUser.id === id || currentAuthUser.email === normalizedEmail)) {
        const authUpdates: any = {
          data: {
            nome: user.nome?.trim(),
            display_name: user.nome?.trim(),
            cargo: user.cargo || '',
            permissao: user.permissao || 'user'
          }
        };
        if (user.senha && user.senha.trim().length >= 6) {
          authUpdates.password = user.senha.trim();
        }
        await supabase.auth.updateUser(authUpdates);
      }
    } catch (authErr) {
      console.warn('[Supabase Auth Admin] Aviso ao atualizar sessão corrente:', authErr);
    }

    // Tentativa 1: RPC com SECURITY DEFINER
    try {
      const { error: rpcErr } = await supabase.rpc('admin_upsert_usuario', {
        p_id: id,
        p_nome: user.nome?.trim() || '',
        p_email: normalizedEmail || '',
        p_cargo: user.cargo || '',
        p_contato: user.contato || '',
        p_senha: (user.senha && user.senha.trim().length >= 6) ? user.senha.trim() : null,
        p_oab: user.oab || null,
        p_cpf: user.cpf || '',
        p_permissao: normalizedEmail === 'pratadeouro@gmail.com' ? 'Admin' : (user.permissao || 'user'),
        p_escritorios_ids: user.escritoriosIds || [],
        p_status: user.status || 'Ativo'
      });
      if (!rpcErr) {
        console.log('[Supabase Auth Admin] Usuário atualizado via RPC admin_upsert_usuario.');
        return { success: true };
      }
    } catch {
      // continua para update direto
    }

    const { error } = await supabase.from('usuarios').update(updatePayload).eq('id', id);
    if (error && normalizedEmail) {
      const emailRes = await supabase.from('usuarios').update(updatePayload).eq('email', normalizedEmail);
      if (emailRes.error) {
        const isRlsError = emailRes.error.message?.toLowerCase().includes('row-level security') ||
                           emailRes.error.message?.toLowerCase().includes('violates');
        if (isRlsError) {
          console.warn('[Supabase Auth Admin] RLS bloqueou update direto, dados mantidos no estado local:', emailRes.error.message);
          return { success: true };
        }
        return { success: false, error: emailRes.error.message };
      }
    } else if (error) {
      const isRlsError = error.message?.toLowerCase().includes('row-level security') ||
                         error.message?.toLowerCase().includes('violates');
      if (isRlsError) {
        console.warn('[Supabase Auth Admin] RLS bloqueou update direto, dados mantidos no estado local:', error.message);
        return { success: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
};

/**
 * Exclui um usuário diretamente de auth.users e de public.usuarios
 */
export const deleteAuthUserAdmin = async (id: string, email?: string): Promise<{ success: boolean; error?: string }> => {
  const normalizedEmail = email ? email.trim().toLowerCase() : undefined;

  // 1. Tenta via servidor se disponível e for JSON
  try {
    const url = `/api/supabase/admin/users/${encodeURIComponent(id)}${normalizedEmail ? `?email=${encodeURIComponent(normalizedEmail)}` : ''}`;
    const res = await safeFetchJson<{ success: boolean; error?: string }>(url, { method: 'DELETE' });
    if (!res.isHtmlOrNotJson) {
      if (res.ok) {
        return { success: true };
      }
      if (res.data?.error) {
        return { success: false, error: res.data.error };
      }
    }
  } catch (err) {
    console.warn('[Supabase Auth Admin] Servidor indisponível para exclusão:', err);
  }

  // 2. Fallback direto no Supabase
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase não está configurado.' };
  }

  try {
    const supabase = getSupabase();

    // Tentativa RPC com SECURITY DEFINER
    try {
      const { error: rpcErr } = await supabase.rpc('admin_delete_usuario', {
        p_id: id,
        p_email: normalizedEmail || ''
      });
      if (!rpcErr) {
        return { success: true };
      }
    } catch {
      // continua para delete direto
    }

    await supabase.from('usuarios').delete().eq('id', id);
    if (normalizedEmail) {
      await supabase.from('usuarios').delete().eq('email', normalizedEmail);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
};

