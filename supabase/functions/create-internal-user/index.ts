import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateTempPassword(): string {
  // 12 chars: maiúscula, minúscula, número e símbolo
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const nums = '23456789';
  const syms = '!@#$%&*';
  const all = upper + lower + nums + syms;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(nums) + pick(syms);
  for (let i = 0; i < 8; i++) pwd += pick(all);
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verifica quem está chamando
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Apenas admins podem criar
    const { data: caller } = await admin
      .from('internal_users')
      .select('access_profile, active')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!caller || !caller.active || caller.access_profile !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem cadastrar usuários' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { name, email, access_profile, active } = body ?? {};

    if (!name?.trim() || !email?.trim()) {
      return new Response(JSON.stringify({ error: 'Nome e email são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tempPassword = generateTempPassword();

    // Cria conta no Auth (já confirmada para permitir login imediato)
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name, must_change_password: true },
    });

    if (authErr || !created.user) {
      return new Response(JSON.stringify({ error: authErr?.message || 'Falha ao criar usuário no Auth' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cria registro em internal_users já vinculado
    const { data: inserted, error: insErr } = await admin
      .from('internal_users')
      .insert({
        name,
        email: email.trim().toLowerCase(),
        access_profile: access_profile ?? 'cs',
        active: active ?? true,
        auth_user_id: created.user.id,
      })
      .select()
      .single();

    if (insErr) {
      // rollback do auth
      await admin.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      user: inserted,
      tempPassword,
      email: email.trim().toLowerCase(),
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
