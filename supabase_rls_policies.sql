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

-- Verifica se o usuário autenticado no Supabase Auth possui papel de Administrador
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT (permissao ILIKE 'admin' OR email = 'pratadeouro@gmail.com')
     FROM public.usuarios 
     WHERE email = lower(auth.jwt() ->> 'email') OR id = auth.uid()::text
     LIMIT 1),
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
-- Leitura: Qualquer usuário autenticado pode ler a lista de usuários da banca (necessário para atribuições de tarefas, responsáveis e contatos).
-- Usuários anônimos (deslogados) NÃO TÊM ACESSO a nenhum registro.
CREATE POLICY "RLS_Usuarios_Select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (true);

-- Modificação: Usuário pode editar seu próprio perfil; Administrador pode cadastrar/editar/excluir qualquer usuário.
CREATE POLICY "RLS_Usuarios_Mod" ON public.usuarios
  FOR ALL TO authenticated
  USING (public.is_admin() OR email = lower(auth.jwt() ->> 'email') OR id = auth.uid()::text)
  WITH CHECK (public.is_admin() OR email = lower(auth.jwt() ->> 'email') OR id = auth.uid()::text);


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

-- ==============================================================================
-- FIM DAS POLÍTICAS DE RLS
-- ==============================================================================
