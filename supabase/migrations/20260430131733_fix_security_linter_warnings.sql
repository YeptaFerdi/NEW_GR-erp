/*
  # Fix Supabase Security Linter Warnings

  1. Function hardening
    - Adds explicit `search_path = public, pg_temp` to `handle_distribution_delivered`
      and `handle_payment_insert` to prevent search-path hijacking.
    - Revokes EXECUTE on both SECURITY DEFINER functions from `anon` and `authenticated`
      so they can only run from the trigger context.

  2. RLS policies - replace permissive USING(true) / WITH CHECK(true)
    - Adds helper function `public.has_role(text[])` (STABLE, SECURITY DEFINER with
      hardened search_path) to check caller's role from users_profile.
    - Rewrites INSERT / UPDATE / DELETE policies on every public table so that:
        * Admin role can do everything.
        * Warehouse role can mutate stock, products, producers, distributions.
        * Owner and Staff are read-only (no mutation policies).
        * Everyone authenticated keeps SELECT access (app-level visibility).
    - audit_logs: any authenticated user may INSERT their own audit rows; no
      UPDATE/DELETE allowed.

  3. Notes
    - This migration is idempotent: existing policies are dropped and recreated.
    - Leaked-password protection (HaveIBeenPwned) must be toggled on in the
      Supabase Auth dashboard; it cannot be set via SQL.
*/

-- 1. Hardened role-check helper ------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(allowed text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_profile
    WHERE id = auth.uid()
      AND status = 'Aktif'
      AND role_name = ANY (allowed)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(text[]) TO authenticated;

-- 2. Harden existing SECURITY DEFINER trigger functions -----------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_distribution_delivered') THEN
    EXECUTE 'ALTER FUNCTION public.handle_distribution_delivered() SET search_path = public, pg_temp';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_distribution_delivered() FROM PUBLIC, anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_payment_insert') THEN
    EXECUTE 'ALTER FUNCTION public.handle_payment_insert() SET search_path = public, pg_temp';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_payment_insert() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

-- 3. Drop old permissive policies --------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 4. SELECT policies (authenticated users) -----------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'roles','permissions','regions','customers','producers','products',
    'stock_movements','orders','order_items','invoices','payments',
    'distributions','account_master','capital_entries','operational_costs',
    'users_profile','audit_logs'
  ]) LOOP
    EXECUTE format(
      'CREATE POLICY "auth can read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (true)', t);
  END LOOP;
END $$;

-- 5. Admin-only write policies (most master + finance tables) ----------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'roles','permissions','regions','customers','orders','order_items',
    'invoices','payments','account_master','capital_entries',
    'operational_costs','users_profile'
  ]) LOOP
    EXECUTE format($f$
      CREATE POLICY "admin insert %1$s" ON public.%1$I
        FOR INSERT TO authenticated
        WITH CHECK (public.has_role(ARRAY['Admin']))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "admin update %1$s" ON public.%1$I
        FOR UPDATE TO authenticated
        USING (public.has_role(ARRAY['Admin']))
        WITH CHECK (public.has_role(ARRAY['Admin']))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "admin delete %1$s" ON public.%1$I
        FOR DELETE TO authenticated
        USING (public.has_role(ARRAY['Admin']))
    $f$, t);
  END LOOP;
END $$;

-- 6. Admin + Warehouse write on operational tables ---------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'products','producers','stock_movements','distributions'
  ]) LOOP
    EXECUTE format($f$
      CREATE POLICY "admin_wh insert %1$s" ON public.%1$I
        FOR INSERT TO authenticated
        WITH CHECK (public.has_role(ARRAY['Admin','Warehouse']))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "admin_wh update %1$s" ON public.%1$I
        FOR UPDATE TO authenticated
        USING (public.has_role(ARRAY['Admin','Warehouse']))
        WITH CHECK (public.has_role(ARRAY['Admin','Warehouse']))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "admin_wh delete %1$s" ON public.%1$I
        FOR DELETE TO authenticated
        USING (public.has_role(ARRAY['Admin','Warehouse']))
    $f$, t);
  END LOOP;
END $$;

-- 7. audit_logs: any authenticated user may append own entries ---------------
CREATE POLICY "auth insert own audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
