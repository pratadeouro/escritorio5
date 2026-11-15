-- ==============================================================================
-- REGRAS DEFINITIVAS DE RLS (ROW LEVEL SECURITY) - LEXGESTÃO / SUPABASE
-- ==============================================================================
-- Este arquivo aplica a segurança completa e atualizações de schema no Supabase:
-- 1. Cria funções auxiliares de alta performance (is_active_user, is_admin e current_user_escritorios)
-- 2. Habilita RLS em todas as tabelas e garante colunas recentes (status, environment_mode)
-- 3. Remove políticas de desenvolvimento antigas
-- 4. Aplica políticas de leitura, inserção, atualização e exclusão baseadas em:
--    - Usuário autenticado e ativo (auth.role() = 'authenticated' e public.is_active_user())
--    - Multi-Escritório (escritorios_ids)
--    - Privilégios de Administrador (is_admin = true)
-- 5. Funções RPC administrativas (admin_upsert_usuario, admin_toggle_usuario_status,
--    admin_delete_usuario, get_user_by_email_for_login) e trigger handle_new_auth_user
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNÇÕES AUXILIARES DE SEGURANÇA (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT (
        lower(trim(email)) = 'pratadeouro@gmail.com'
        OR lower(trim(COALESCE(status, 'Ativo'))) <> 'inativo'
      )
     FROM public.usuarios
     WHERE lower(trim(email)) = lower(trim(auth.jwt() ->> 'email')) OR id = auth.uid()::text
     LIMIT 1),
    true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT (
        (permissao ILIKE '%admin%' OR permissao ILIKE '%gestor%' OR lower(trim(email)) = 'pratadeouro@gmail.com' OR email ILIKE '%walber%')
        AND (lower(trim(email)) = 'pratadeouro@gmail.com' OR lower(trim(COALESCE(status, 'Ativo'))) <> 'inativo')
      )
     FROM public.usuarios 
     WHERE lower(trim(email)) = lower(trim(auth.jwt() ->> 'email')) OR id = auth.uid()::text
     LIMIT 1),
    (lower(trim(auth.jwt() ->> 'email')) = 'pratadeouro@gmail.com' OR lower(trim(auth.jwt() ->> 'email')) ILIKE '%walber%'),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_escritorios()
RETURNS TEXT[] AS $$
DECLARE
  v_json jsonb;
  v_status text;
  v_arr text[];
BEGIN
  SELECT escritorios_ids, status INTO v_json, v_status
  FROM public.usuarios 
  WHERE lower(trim(email)) = lower(trim(auth.jwt() ->> 'email')) OR id = auth.uid()::text
  LIMIT 1;

  IF lower(trim(COALESCE(v_status, 'Ativo'))) = 'inativo' AND lower(trim(COALESCE(auth.jwt() ->> 'email', ''))) <> 'pratadeouro@gmail.com' THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  IF v_json IS NULL OR jsonb_typeof(v_json) != 'array' THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  SELECT ARRAY(SELECT jsonb_array_elements_text(v_json)) INTO v_arr;
  RETURN COALESCE(v_arr, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 2. HABILITAR ROW LEVEL SECURITY (RLS) E GARANTIR COLUNAS RECENTES
-- ------------------------------------------------------------------------------
ALTER TABLE public.escritorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.varas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.julgadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upj ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tribunais ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.envolvidos_tipo (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.envolvidos_tipo (id, nome) VALUES
  ('apelante', 'Apelante'),
  ('apelado', 'Apelado')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.envolvidos_tipo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envolvidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ativo';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS environment_mode TEXT DEFAULT 'homologacao';


-- ------------------------------------------------------------------------------
-- 3. REMOVER POLÍTICAS ANTIGAS / PÚBLICAS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public Access Escritorios" ON public.escritorios;
DROP POLICY IF EXISTS "Public Access Usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Public Access Processos" ON public.processos;
DROP POLICY IF EXISTS "Public Access Contatos" ON public.contatos;
DROP POLICY IF EXISTS "Public Access Tarefas" ON public.tarefas;
DROP POLICY IF EXISTS "Public Access Eventos" ON public.eventos;
DROP POLICY IF EXISTS "Public Access Financeiro" ON public.financeiro;

DROP POLICY IF EXISTS "RLS_Escritorios_Select" ON public.escritorios;
DROP POLICY IF EXISTS "RLS_Escritorios_Mod" ON public.escritorios;
DROP POLICY IF EXISTS "RLS_Usuarios_Select" ON public.usuarios;
DROP POLICY IF EXISTS "RLS_Usuarios_Mod" ON public.usuarios;
DROP POLICY IF EXISTS "RLS_Usuarios_Insert" ON public.usuarios;
DROP POLICY IF EXISTS "RLS_Usuarios_Update" ON public.usuarios;
DROP POLICY IF EXISTS "RLS_Usuarios_Delete" ON public.usuarios;
DROP POLICY IF EXISTS "RLS_Processos" ON public.processos;
DROP POLICY IF EXISTS "RLS_Contatos" ON public.contatos;
DROP POLICY IF EXISTS "RLS_Tarefas" ON public.tarefas;
DROP POLICY IF EXISTS "RLS_Eventos" ON public.eventos;
DROP POLICY IF EXISTS "RLS_Financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "RLS_Movimentos" ON public.movimentos;
DROP POLICY IF EXISTS "RLS_Documentos" ON public.documentos;
DROP POLICY IF EXISTS "RLS_Varas" ON public.varas;
DROP POLICY IF EXISTS "RLS_Julgadores" ON public.julgadores;
DROP POLICY IF EXISTS "RLS_Servidores" ON public.servidores;
DROP POLICY IF EXISTS "RLS_Recursos" ON public.recursos;
DROP POLICY IF EXISTS "RLS_UPJ" ON public.upj;
DROP POLICY IF EXISTS "RLS_Forums" ON public.forums;
DROP POLICY IF EXISTS "RLS_Tribunais" ON public.tribunais;
DROP POLICY IF EXISTS "RLS_EnvolvidosTipo" ON public.envolvidos_tipo;
DROP POLICY IF EXISTS "RLS_Envolvidos" ON public.envolvidos;
DROP POLICY IF EXISTS "RLS_Modelos" ON public.modelos;
DROP POLICY IF EXISTS "RLS_Etiquetas" ON public.etiquetas;
DROP POLICY IF EXISTS "RLS_Calendario" ON public.calendario;
DROP POLICY IF EXISTS "RLS_LeadsStatus" ON public.leads_status;
DROP POLICY IF EXISTS "RLS_Leads" ON public.leads;
DROP POLICY IF EXISTS "RLS_Logs_Insert" ON public.logs;
DROP POLICY IF EXISTS "RLS_Logs_Update" ON public.logs;
DROP POLICY IF EXISTS "RLS_Logs_Select" ON public.logs;
DROP POLICY IF EXISTS "RLS_AppSettings_Select" ON public.app_settings;
DROP POLICY IF EXISTS "RLS_AppSettings_Mod" ON public.app_settings;


-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS DE ACESSO DEFINITIVAS
-- ------------------------------------------------------------------------------

CREATE POLICY "RLS_Escritorios_Select" ON public.escritorios
  FOR SELECT TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Escritorios_Mod" ON public.escritorios
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "RLS_Usuarios_Select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "RLS_Usuarios_Insert" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "RLS_Usuarios_Update" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() 
    OR lower(trim(email)) = lower(trim(auth.jwt() ->> 'email')) 
    OR id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE (lower(trim(u.email)) = lower(trim(auth.jwt() ->> 'email')) OR u.id = auth.uid()::text)
      AND lower(trim(COALESCE(u.status, 'Ativo'))) <> 'inativo'
      AND (u.permissao ILIKE '%admin%' OR u.permissao ILIKE '%gestor%' OR lower(trim(u.email)) = 'pratadeouro@gmail.com')
    )
  )
  WITH CHECK (true);

CREATE POLICY "RLS_Usuarios_Delete" ON public.usuarios
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE (lower(trim(u.email)) = lower(trim(auth.jwt() ->> 'email')) OR u.id = auth.uid()::text)
      AND lower(trim(COALESCE(u.status, 'Ativo'))) <> 'inativo'
      AND (u.permissao ILIKE '%admin%' OR u.permissao ILIKE '%gestor%' OR lower(trim(u.email)) = 'pratadeouro@gmail.com')
    )
  );

CREATE POLICY "RLS_Processos" ON public.processos
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Contatos" ON public.contatos
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Tarefas" ON public.tarefas
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Eventos" ON public.eventos
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Financeiro" ON public.financeiro
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Movimentos" ON public.movimentos
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Documentos" ON public.documentos
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Varas" ON public.varas
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Julgadores" ON public.julgadores
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Servidores" ON public.servidores
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Modelos" ON public.modelos
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Etiquetas" ON public.etiquetas
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_Tribunais" ON public.tribunais FOR ALL TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_admin());
CREATE POLICY "RLS_Forums" ON public.forums FOR ALL TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_admin());
CREATE POLICY "RLS_UPJ" ON public.upj FOR ALL TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_admin());
CREATE POLICY "RLS_Recursos" ON public.recursos FOR ALL TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_active_user());
CREATE POLICY "RLS_EnvolvidosTipo" ON public.envolvidos_tipo FOR ALL TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_active_user());
CREATE POLICY "RLS_Envolvidos" ON public.envolvidos FOR ALL TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_active_user());
CREATE POLICY "RLS_Calendario" ON public.calendario FOR ALL TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_active_user());
CREATE POLICY "RLS_LeadsStatus" ON public.leads_status FOR ALL TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_admin());

CREATE POLICY "RLS_Logs_Insert" ON public.logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "RLS_Logs_Update" ON public.logs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

CREATE POLICY "RLS_Logs_Select" ON public.logs
  FOR SELECT TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR id_escritorio IS NULL OR id_escritorio = ANY(public.current_user_escritorios())));

CREATE POLICY "RLS_AppSettings_Select" ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "RLS_AppSettings_Mod" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5. FUNÇÕES DE ADMINISTRAÇÃO DE USUÁRIOS (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_upsert_usuario(
  p_id text,
  p_nome text,
  p_email text,
  p_cargo text DEFAULT '',
  p_contato text DEFAULT '',
  p_senha text DEFAULT NULL,
  p_oab text DEFAULT NULL,
  p_cpf text DEFAULT '',
  p_permissao text DEFAULT 'user',
  p_escritorios_ids jsonb DEFAULT '[]'::jsonb,
  p_status text DEFAULT 'Ativo'
)
RETURNS jsonb AS $$
BEGIN
  INSERT INTO public.usuarios (
    id, nome, email, cargo, contato, senha, oab, cpf, permissao, escritorios_ids, status, enable_notifications
  ) VALUES (
    p_id, p_nome, lower(trim(p_email)), p_cargo, p_contato, p_senha, p_oab, p_cpf, p_permissao, p_escritorios_ids, p_status, true
  )
  ON CONFLICT (email) DO UPDATE SET
    nome = EXCLUDED.nome,
    cargo = EXCLUDED.cargo,
    contato = EXCLUDED.contato,
    senha = COALESCE(EXCLUDED.senha, public.usuarios.senha),
    oab = EXCLUDED.oab,
    cpf = EXCLUDED.cpf,
    permissao = EXCLUDED.permissao,
    escritorios_ids = EXCLUDED.escritorios_ids,
    status = EXCLUDED.status,
    updated_at = NOW();

  RETURN json_build_object('success', true, 'id', p_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_upsert_usuario TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.admin_toggle_usuario_status(
  p_id text,
  p_status text,
  p_email text DEFAULT ''
)
RETURNS jsonb AS $$
DECLARE
  v_status text;
  v_caller_email text;
  v_target_email text;
  v_updated_count integer := 0;
  v_ban_until timestamptz;
BEGIN
  IF auth.role() <> 'authenticated' AND auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado.')::jsonb;
  END IF;

  v_status := CASE
    WHEN lower(trim(COALESCE(p_status, 'Ativo'))) = 'inativo' THEN 'Inativo'
    ELSE 'Ativo'
  END;

  v_caller_email := lower(trim(COALESCE(auth.jwt() ->> 'email', '')));
  v_target_email := lower(trim(COALESCE(p_email, '')));

  IF v_target_email = '' THEN
    SELECT lower(trim(email)) INTO v_target_email
    FROM public.usuarios
    WHERE id = p_id
    LIMIT 1;
  END IF;

  IF v_target_email = 'pratadeouro@gmail.com' AND v_status = 'Inativo' THEN
    RETURN json_build_object('success', false, 'error', 'O administrador principal não pode ser inativado.')::jsonb;
  END IF;

  IF v_target_email <> '' AND v_target_email = v_caller_email AND v_status = 'Inativo' THEN
    RETURN json_build_object('success', false, 'error', 'Você não pode inativar sua própria conta.')::jsonb;
  END IF;

  UPDATE public.usuarios
  SET status = v_status,
      updated_at = NOW()
  WHERE id = p_id
     OR (v_target_email <> '' AND lower(trim(email)) = v_target_email);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  v_ban_until := CASE
    WHEN v_status = 'Inativo' THEN NOW() + INTERVAL '100 years'
    ELSE NULL
  END;

  BEGIN
    UPDATE auth.users
    SET banned_until = v_ban_until,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('status', v_status),
        updated_at = NOW()
    WHERE id::text = p_id
       OR (v_target_email <> '' AND lower(trim(email)) = v_target_email);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object(
    'success', true,
    'status', v_status,
    'updated', v_updated_count
  )::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.admin_toggle_usuario_status(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_toggle_usuario_status(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_usuario(
  p_id text,
  p_email text DEFAULT ''
)
RETURNS jsonb AS $$
BEGIN
  DELETE FROM public.usuarios WHERE id = p_id;
  IF p_email <> '' THEN
    DELETE FROM public.usuarios WHERE email = lower(trim(p_email));
  END IF;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_delete_usuario TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_user_by_email_for_login(p_email text)
RETURNS jsonb AS $$
DECLARE
  v_user jsonb;
  v_is_banned boolean := false;
BEGIN
  SELECT (a.banned_until IS NOT NULL AND a.banned_until > NOW())
  INTO v_is_banned
  FROM auth.users a
  WHERE lower(trim(a.email)) = lower(trim(p_email))
  LIMIT 1;

  SELECT json_build_object(
    'id', u.id,
    'nome', u.nome,
    'email', u.email,
    'cargo', u.cargo,
    'contato', u.contato,
    'oab', u.oab,
    'permissao', u.permissao,
    'escritorios_ids', u.escritorios_ids,
    'status', CASE
      WHEN COALESCE(v_is_banned, false) OR lower(trim(COALESCE(u.status, 'Ativo'))) = 'inativo' THEN 'Inativo'
      ELSE 'Ativo'
    END
  )::jsonb
  INTO v_user
  FROM public.usuarios u
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_user IS NOT NULL THEN
    RETURN v_user;
  END IF;

  SELECT json_build_object(
    'id', a.id::text,
    'nome', COALESCE(a.raw_user_meta_data->>'nome', a.raw_user_meta_data->>'full_name', a.raw_user_meta_data->>'display_name', a.email),
    'email', a.email,
    'cargo', COALESCE(a.raw_user_meta_data->>'cargo', ''),
    'contato', COALESCE(a.raw_user_meta_data->>'contato', ''),
    'oab', COALESCE(a.raw_user_meta_data->>'oab', ''),
    'permissao', COALESCE(a.raw_user_meta_data->>'permissao', 'user'),
    'escritorios_ids', COALESCE(a.raw_user_meta_data->'escritorios_ids', '[]'::jsonb),
    'status', CASE
      WHEN (a.banned_until IS NOT NULL AND a.banned_until > NOW()) OR lower(trim(COALESCE(a.raw_user_meta_data->>'status', 'Ativo'))) = 'inativo' THEN 'Inativo'
      ELSE 'Ativo'
    END
  )::jsonb
  INTO v_user
  FROM auth.users a
  WHERE lower(trim(a.email)) = lower(trim(p_email))
  LIMIT 1;

  RETURN v_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_by_email_for_login TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuarios (
    id,
    email,
    nome,
    cargo,
    permissao,
    escritorios_ids,
    status,
    enable_notifications
  ) VALUES (
    NEW.id::text,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'cargo', ''),
    COALESCE(NEW.raw_user_meta_data->>'permissao', 'user'),
    CASE 
      WHEN NEW.raw_user_meta_data->'escritorios_ids' IS NOT NULL 
      THEN NEW.raw_user_meta_data->'escritorios_ids' 
      ELSE '[]'::jsonb 
    END,
    COALESCE(NEW.raw_user_meta_data->>'status', 'Ativo'),
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, public.usuarios.nome),
    cargo = COALESCE(EXCLUDED.cargo, public.usuarios.cargo),
    permissao = COALESCE(EXCLUDED.permissao, public.usuarios.permissao),
    escritorios_ids = COALESCE(EXCLUDED.escritorios_ids, public.usuarios.escritorios_ids);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==============================================================================
-- FIM DAS POLÍTICAS DE RLS
-- ==============================================================================
