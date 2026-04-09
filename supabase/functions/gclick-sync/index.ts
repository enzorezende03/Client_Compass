import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GCLICK_BASE = "https://api.gclick.com.br";

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GCLICK_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GCLICK_CLIENT_SECRET")!;

  // Try standard OAuth2 endpoints
  const endpoints = [
    `${GCLICK_BASE}/oauth/token`,
    `${GCLICK_BASE}/auth/token`,
    `${GCLICK_BASE}/token`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          console.log(`Auth successful via ${url}`);
          return data.access_token;
        }
      }
      const text = await res.text();
      console.log(`Auth attempt ${url}: ${res.status} - ${text}`);
    } catch (e) {
      console.log(`Auth attempt ${url} failed: ${e.message}`);
    }
  }

  // Try JSON body variant
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          console.log(`Auth successful (JSON) via ${url}`);
          return data.access_token;
        }
      }
      await res.text();
    } catch (_) { /* skip */ }
  }

  throw new Error("Could not authenticate with G-Click API. Check credentials and auth endpoint.");
}

async function gclickGet(token: string, path: string) {
  const res = await fetch(`${GCLICK_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`G-Click GET ${path}: ${res.status} - ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "test";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test connection
    if (action === "test") {
      const token = await getAccessToken();
      // Try to list departments to validate
      let departments = [];
      try {
        departments = await gclickGet(token, "/departamentos");
      } catch (e) {
        console.log("Could not list departments:", e.message);
      }
      return new Response(JSON.stringify({
        success: true,
        message: "Conexão com G-Click estabelecida!",
        departments,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sync clients
    if (action === "sync-clients") {
      const token = await getAccessToken();
      const gclickClients = await gclickGet(token, "/clientes");

      const { data: logEntry } = await supabase.from("gclick_sync_log").insert({
        sync_type: "clients",
        status: "running",
      }).select().single();

      let synced = 0;
      for (const gc of gclickClients) {
        // Match by document (CNPJ/CPF)
        const doc = (gc.inscricao || gc.cnpj || gc.cpf || "").replace(/\D/g, "");
        const name = gc.nome || gc.razaoSocial || gc.nomeFantasia || "";

        if (!doc && !name) continue;

        // Try matching by document first, then by name
        let matchQuery = supabase.from("clients").select("id");
        if (doc) {
          matchQuery = matchQuery.eq("document", doc);
        } else {
          matchQuery = matchQuery.ilike("name", `%${name}%`);
        }
        const { data: matches } = await matchQuery.limit(1);

        if (matches && matches.length > 0) {
          // Update with G-Click ID
          await supabase.from("clients").update({
            gclick_id: String(gc.id),
          }).eq("id", matches[0].id);
          synced++;
        }
      }

      if (logEntry) {
        await supabase.from("gclick_sync_log").update({
          status: "completed",
          records_synced: synced,
          details: `${gclickClients.length} clientes no G-Click, ${synced} vinculados`,
        }).eq("id", logEntry.id);
      }

      return new Response(JSON.stringify({
        success: true,
        total_gclick: gclickClients.length,
        synced,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sync carteiras (portfolio/responsible info)
    if (action === "sync-carteiras") {
      const token = await getAccessToken();
      let carteiras = [];
      try {
        carteiras = await gclickGet(token, "/carteiras");
      } catch (_) {
        // Try alternative endpoints
        try { carteiras = await gclickGet(token, "/usuarios"); } catch (_) { /* skip */ }
      }

      const { data: logEntry } = await supabase.from("gclick_sync_log").insert({
        sync_type: "carteiras",
        status: "running",
      }).select().single();

      let synced = 0;
      // Update clients with their carteira responsible from G-Click
      if (Array.isArray(carteiras)) {
        for (const c of carteiras) {
          const clientId = String(c.clienteId || c.cliente_id || "");
          const responsavel = c.responsavel?.nome || c.nome || "";
          if (!clientId || !responsavel) continue;

          const { data: matches } = await supabase.from("clients")
            .select("id")
            .eq("gclick_id", clientId)
            .limit(1);

          if (matches && matches.length > 0) {
            await supabase.from("clients").update({
              gclick_carteira: responsavel,
            }).eq("id", matches[0].id);
            synced++;
          }
        }
      }

      if (logEntry) {
        await supabase.from("gclick_sync_log").update({
          status: "completed",
          records_synced: synced,
          details: `${carteiras.length} carteiras, ${synced} vinculadas`,
        }).eq("id", logEntry.id);
      }

      return new Response(JSON.stringify({
        success: true,
        total: carteiras.length,
        synced,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sync tasks from "Atendimento ao Cliente" department
    if (action === "sync-tasks") {
      const token = await getAccessToken();

      // First find the department ID for "Atendimento ao Cliente"
      const departments = await gclickGet(token, "/departamentos");
      const dept = departments.find((d: any) =>
        (d.nome || "").toLowerCase().includes("atendimento")
      );

      if (!dept) {
        return new Response(JSON.stringify({
          success: false,
          error: "Departamento 'Atendimento ao Cliente' não encontrado",
          available_departments: departments.map((d: any) => ({ id: d.id, nome: d.nome })),
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get tasks for this department
      let tasks = [];
      try {
        tasks = await gclickGet(token, `/tarefas?departamentoId=${dept.id}`);
      } catch (_) {
        try {
          tasks = await gclickGet(token, `/departamentos/${dept.id}/tarefas`);
        } catch (_) { /* skip */ }
      }

      const { data: logEntry } = await supabase.from("gclick_sync_log").insert({
        sync_type: "tasks",
        status: "running",
        details: `Departamento: ${dept.nome} (ID: ${dept.id})`,
      }).select().single();

      let synced = 0;
      for (const task of tasks) {
        // Find matching client
        const clientGclickId = String(task.clienteId || task.cliente?.id || "");
        let clientId: string | null = null;

        if (clientGclickId) {
          const { data: matches } = await supabase.from("clients")
            .select("id")
            .eq("gclick_id", clientGclickId)
            .limit(1);
          if (matches && matches.length > 0) clientId = matches[0].id;
        }

        if (!clientId) continue; // Skip tasks without matching client

        // Check if task already exists (by title + client to avoid duplicates)
        const title = task.assunto || task.titulo || task.nome || "Tarefa G-Click";
        const { data: existing } = await supabase.from("tasks")
          .select("id")
          .eq("client_id", clientId)
          .eq("title", title)
          .limit(1);

        if (existing && existing.length > 0) continue; // Already synced

        await supabase.from("tasks").insert({
          client_id: clientId,
          title,
          description: task.andamento || task.descricao || "",
          responsible: task.responsavel?.nome || "",
          due_date: task.dataVencimento || task.prazo || new Date().toISOString().split("T")[0],
          status: "pending",
        });
        synced++;
      }

      if (logEntry) {
        await supabase.from("gclick_sync_log").update({
          status: "completed",
          records_synced: synced,
          details: `Dept: ${dept.nome}, ${tasks.length} tarefas encontradas, ${synced} importadas`,
        }).eq("id", logEntry.id);
      }

      return new Response(JSON.stringify({
        success: true,
        department: dept.nome,
        total_tasks: tasks.length,
        synced,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      error: "Ação inválida. Use: test, sync-clients, sync-carteiras, sync-tasks",
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("gclick-sync error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
