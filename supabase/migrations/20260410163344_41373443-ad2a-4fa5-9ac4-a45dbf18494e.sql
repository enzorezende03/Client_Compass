-- Remove the dangerous self-registration bootstrap policy
DROP POLICY IF EXISTS "Allow first user self-registration" ON public.internal_users;
