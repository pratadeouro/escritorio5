-- ==============================================================================
-- REGRAS DEFINITIVAS DE RLS (ROW LEVEL SECURITY) - LEXGESTÃO / SUPABASE
-- ==============================================================================
-- Este arquivo aplica a segurança completa no Supabase PostgreSQL:
-- 1. Cria funções auxiliares de alta performance (is_admin e current_user_escritorios)
-- 2. Habilita RLS em todas as tabelas
-- 3. Remove políticas de desenvolvimento antigas
-- 4. Aplica políticas de leitura, inserção, atualização e exclusão baseadas em:
--    - Usuário autenticado (auth.role() = 'authenticated')
--    - Multi-Escritório (escritorios_ids)
--    - Privilégios de Administrador (is_admin = true)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNÇÕES AUXILIARES DE SEGURANÇA (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- Verifica se o usuário autenticado no Supabase Auth possui papel de Administrador ou Gestor
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT (permissao ILIKE '%admin%' OR permissao ILIKE '%gestor%' OR email = 'pratadeouro@gmail.com' OR email ILIKE '%walber%')
     FROM public.usuarios 
     WHERE email = lower(trim(auth.jwt() ->> 'email')) OR id = auth.uid()::text
     LIMIT 1),
    -- Fallback se o usuário logado tiver email pratadeouro@gmail.com ou walber
    (lower(trim(auth.jwt() ->> 'email')) = 'pratadeouro@gmail.com' OR lower(trim(auth.jwt() ->> 'email')) ILIKE '%walber%'),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Retorna os IDs dos escritórios permitidos para o usuário logado como TEXT[]
CREATE OR REPLACE FUNCTION public.current_user_escritorios()
RETURNS TEXT[] AS $$
DECLARE
  v_json jsonb;
  v_arr text[];
BEGIN
  SELECT escritorios_ids INTO v_json
  FROM public.usuarios 
  WHERE email = lower(auth.jwt() ->> 'email') OR id = auth.uid()::text
  LIMIT 1;

  IF v_json IS NULL OR jsonb_typeof(v_json) != 'array' THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  SELECT ARRAY(SELECT jsonb_array_elements_text(v_json)) INTO v_arr;
  RETURN COALESCE(v_arr, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ------------------------------------------------------------------------------
-- 2. HABILITAR ROW LEVEL SECURITY (RLS) EM TODAS AS 24 TABELAS
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
ALTER TABLE public.envolvidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- 3. LIMPEZA DE POLÍTICAS ANTIGAS / PÚBLICAS DE DESENVOLVIMENTO
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public Access Escritorios" ON public.escritorios;
DROP POLICY IF EXISTS "Public Access Usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Public Access Processos" ON public.processos;
DROP POLICY IF EXISTS "Public Access Contatos" ON public.contatos;
DROP POLICY IF EXISTS "Public Access Tarefas" ON public.tarefas;
DROP POLICY IF EXISTS "Public Access Eventos" ON public.eventos;
DROP POLICY IF EXISTS "Public Access Financeiro" ON public.financeiro;

-- Remover eventuais versões anteriores das novas políticas
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
DROP POLICY IF EXISTS "RLS_Envolvidos" ON public.envolvidos;
DROP POLICY IF EXISTS "RLS_Modelos" ON public.modelos;
DROP POLICY IF EXISTS "RLS_Etiquetas" ON public.etiquetas;
DROP POLICY IF EXISTS "RLS_Calendario" ON public.calendario;
DROP POLICY IF EXISTS "RLS_LeadsStatus" ON public.leads_status;
DROP POLICY IF EXISTS "RLS_Leads" ON public.leads;
DROP POLICY IF EXISTS "RLS_Logs_Insert" ON public.logs;
DROP POLICY IF EXISTS "RLS_Logs_Select" ON public.logs;
DROP POLICY IF EXISTS "RLS_AppSettings_Select" ON public.app_settings;
DROP POLICY IF EXISTS "RLS_AppSettings_Mod" ON public.app_settings;


-- ------------------------------------------------------------------------------
-- 4. APLICAÇÃO DAS POLÍTICAS DE ACESSO DEFINITIVAS
-- ------------------------------------------------------------------------------

-- A. ESCRITÓRIOS
-- Leitura: Usuários autenticados veem apenas os escritórios atribuídos a eles; Admins veem todos.
CREATE POLICY "RLS_Escritorios_Select" ON public.escritorios
  FOR SELECT TO authenticated
  USING (public.is_admin() OR id = ANY(public.current_user_escritorios()));

-- Criação/Edição/Exclusão: Apenas administradores
CREATE POLICY "RLS_Escritorios_Mod" ON public.escritorios
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- B. USUÁRIOS
-- Leitura: Qualquer usuário autenticado pode ler a lista de usuários da banca
CREATE POLICY "RLS_Usuarios_Select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (true);

-- Inserção: Permitir que usuários autenticados cadastrem novos membros na equipe
CREATE POLICY "RLS_Usuarios_Insert" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Atualização: Usuário pode editar seu próprio perfil; Administrador/Gestor pode editar qualquer usuário
CREATE POLICY "RLS_Usuarios_Update" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() 
    OR email = lower(trim(auth.jwt() ->> 'email')) 
    OR id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE (u.email = lower(trim(auth.jwt() ->> 'email')) OR u.id = auth.uid()::text)
      AND (u.permissao ILIKE '%admin%' OR u.permissao ILIKE '%gestor%' OR u.email = 'pratadeouro@gmail.com')
    )
  )
  WITH CHECK (true);

-- Exclusão: Administradores e Gestores
CREATE POLICY "RLS_Usuarios_Delete" ON public.usuarios
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE (u.email = lower(trim(auth.jwt() ->> 'email')) OR u.id = auth.uid()::text)
      AND (u.permissao ILIKE '%admin%' OR u.permissao ILIKE '%gestor%' OR u.email = 'pratadeouro@gmail.com')
    )
  );


-- C. PROCESSOS JUDICIAIS E ADMINISTRATIVOS
CREATE POLICY "RLS_Processos" ON public.processos
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()));


-- D. CONTATOS E CLIENTES
CREATE POLICY "RLS_Contatos" ON public.contatos
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()));


-- E. TAREFAS E ATIVIDADES
CREATE POLICY "RLS_Tarefas" ON public.tarefas
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()));


-- F. AUDIÊNCIAS, PRAZOS E EVENTOS
CREATE POLICY "RLS_Eventos" ON public.eventos
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()));


-- G. FINANCEIRO (LANÇAMENTOS, ENTRADAS E SAÍDAS)
CREATE POLICY "RLS_Financeiro" ON public.financeiro
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()));


-- H. MOVIMENTAÇÕES PROCESSUAIS
CREATE POLICY "RLS_Movimentos" ON public.movimentos
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()));


-- I. DOCUMENTOS
CREATE POLICY "RLS_Documentos" ON public.documentos
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id = ANY(public.current_user_escritorios()));


-- J. TABELAS AUXILIARES DO ESCRITÓRIO (Varas, Julgadores, Servidores, Modelos, Etiquetas, Leads)
CREATE POLICY "RLS_Varas" ON public.varas
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()));

CREATE POLICY "RLS_Julgadores" ON public.julgadores
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()));

CREATE POLICY "RLS_Servidores" ON public.servidores
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()));

CREATE POLICY "RLS_Modelos" ON public.modelos
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()));

CREATE POLICY "RLS_Etiquetas" ON public.etiquetas
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()));

CREATE POLICY "RLS_Leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()))
  WITH CHECK (public.is_admin() OR escritorio_id IS NULL OR escritorio_id = ANY(public.current_user_escritorios()));


-- K. TABELAS GERAIS DO SISTEMA (Tribunais, Fóruns, UPJ, Recursos, Envolvidos, Calendário, Status de Leads)
CREATE POLICY "RLS_Tribunais" ON public.tribunais FOR ALL TO authenticated USING (true) WITH CHECK (public.is_admin());
CREATE POLICY "RLS_Forums" ON public.forums FOR ALL TO authenticated USING (true) WITH CHECK (public.is_admin());
CREATE POLICY "RLS_UPJ" ON public.upj FOR ALL TO authenticated USING (true) WITH CHECK (public.is_admin());
CREATE POLICY "RLS_Recursos" ON public.recursos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "RLS_Envolvidos" ON public.envolvidos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "RLS_Calendario" ON public.calendario FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "RLS_LeadsStatus" ON public.leads_status FOR ALL TO authenticated USING (true) WITH CHECK (public.is_admin());


-- L. LOGS E AUDITORIA DO SISTEMA
-- Inserção permitida para qualquer usuário autenticado (para registrar ações)
CREATE POLICY "RLS_Logs_Insert" ON public.logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Leitura: Admins veem todos; Usuários veem logs referentes aos seus escritórios
CREATE POLICY "RLS_Logs_Select" ON public.logs
  FOR SELECT TO authenticated
  USING (public.is_admin() OR id_escritorio IS NULL OR id_escritorio = ANY(public.current_user_escritorios()));


-- M. CONFIGURAÇÕES DA APLICAÇÃO (APP_SETTINGS)
CREATE POLICY "RLS_AppSettings_Select" ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "RLS_AppSettings_Mod" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- 5. FUNÇÕES DE ADMINISTRAÇÃO DE USUÁRIOS (SECURITY DEFINER - IMUNES A RLS)
-- ------------------------------------------------------------------------------

-- Função para criação e sincronização garantida de usuários contornando restrições de RLS
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
    status = EXCLUDED.status;

  RETURN json_build_object('success', true, 'id', p_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_upsert_usuario TO authenticated, anon;

-- Função para exclusão administrativa garantida de usuários
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

-- Trigger automático para popular public.usuarios quando um novo usuário for criado no Supabase Auth
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
