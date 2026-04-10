
-- 1. Add auth_user_id to internal_users
ALTER TABLE public.internal_users
ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create helper function to check if current user is an active internal user
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.internal_users
    WHERE auth_user_id = auth.uid()
      AND active = true
  );
$$;

-- 3. Create helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.internal_users
    WHERE auth_user_id = auth.uid()
      AND active = true
      AND access_profile = 'admin'
  );
$$;

-- 4. Drop all existing permissive policies

-- audit_logs
DROP POLICY IF EXISTS "Allow public access to audit_logs" ON public.audit_logs;

-- clients
DROP POLICY IF EXISTS "Allow public access to clients" ON public.clients;

-- digisac_complaints
DROP POLICY IF EXISTS "Allow public access to digisac_complaints" ON public.digisac_complaints;

-- gclick_sync_log
DROP POLICY IF EXISTS "Allow public access to gclick_sync_log" ON public.gclick_sync_log;

-- internal_users
DROP POLICY IF EXISTS "Allow public access to internal_users" ON public.internal_users;

-- notifications
DROP POLICY IF EXISTS "Allow public access to notifications" ON public.notifications;

-- tasks
DROP POLICY IF EXISTS "Allow public access to tasks" ON public.tasks;

-- timeline_entries
DROP POLICY IF EXISTS "Allow public access to timeline_entries" ON public.timeline_entries;

-- 5. Create new authenticated RLS policies

-- == audit_logs ==
CREATE POLICY "Authenticated internal users can read audit_logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Authenticated internal users can insert audit_logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (public.is_internal_user());

-- == clients ==
CREATE POLICY "Authenticated internal users can read clients"
ON public.clients FOR SELECT TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Authenticated internal users can insert clients"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (public.is_internal_user());

CREATE POLICY "Authenticated internal users can update clients"
ON public.clients FOR UPDATE TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Authenticated internal users can delete clients"
ON public.clients FOR DELETE TO authenticated
USING (public.is_internal_user());

-- == digisac_complaints ==
CREATE POLICY "Authenticated internal users can read digisac_complaints"
ON public.digisac_complaints FOR SELECT TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Authenticated internal users can insert digisac_complaints"
ON public.digisac_complaints FOR INSERT TO authenticated
WITH CHECK (public.is_internal_user());

CREATE POLICY "Authenticated internal users can update digisac_complaints"
ON public.digisac_complaints FOR UPDATE TO authenticated
USING (public.is_internal_user());

-- == gclick_sync_log ==
CREATE POLICY "Authenticated internal users can read gclick_sync_log"
ON public.gclick_sync_log FOR SELECT TO authenticated
USING (public.is_internal_user());

-- Service role handles inserts via edge functions (no anon/authenticated insert policy needed)

-- == internal_users ==
CREATE POLICY "Authenticated internal users can read all internal_users"
ON public.internal_users FOR SELECT TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Admins can insert internal_users"
ON public.internal_users FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update internal_users"
ON public.internal_users FOR UPDATE TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can delete internal_users"
ON public.internal_users FOR DELETE TO authenticated
USING (public.is_admin());

-- == notifications ==
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.internal_users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated internal users can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.is_internal_user());

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.internal_users WHERE auth_user_id = auth.uid()
  )
);

-- == tasks ==
CREATE POLICY "Authenticated internal users can read tasks"
ON public.tasks FOR SELECT TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Authenticated internal users can insert tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (public.is_internal_user());

CREATE POLICY "Authenticated internal users can update tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Authenticated internal users can delete tasks"
ON public.tasks FOR DELETE TO authenticated
USING (public.is_internal_user());

-- == timeline_entries ==
CREATE POLICY "Authenticated internal users can read timeline_entries"
ON public.timeline_entries FOR SELECT TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Authenticated internal users can insert timeline_entries"
ON public.timeline_entries FOR INSERT TO authenticated
WITH CHECK (public.is_internal_user());

CREATE POLICY "Authenticated internal users can update timeline_entries"
ON public.timeline_entries FOR UPDATE TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Authenticated internal users can delete timeline_entries"
ON public.timeline_entries FOR DELETE TO authenticated
USING (public.is_internal_user());

-- Allow the first admin to be created when no internal users with auth_user_id exist yet
CREATE POLICY "Allow first user self-registration"
ON public.internal_users FOR INSERT TO authenticated
WITH CHECK (
  NOT EXISTS (SELECT 1 FROM public.internal_users WHERE auth_user_id IS NOT NULL)
  AND auth_user_id = auth.uid()
);

-- Allow authenticated users to read their own internal_users record (for login check)
CREATE POLICY "Users can read own record"
ON public.internal_users FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());
