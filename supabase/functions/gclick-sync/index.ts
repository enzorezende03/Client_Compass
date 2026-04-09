import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GCLICK_BASE = "https://api.gclick.com.br";

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GCLICK_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GCLICK_CLIENT_SECRET")!;

  const endpoints = [
    `${GCLICK_BASE}/oauth/token`,
    `${GCLICK_BASE}/auth/token`,
    `${GCLICK_BASE}/token`,
  ];

  // Try form-urlencoded first, then JSON
  for (const contentType of ["application/x-www-form-urlencoded", "application/json"]) {
    for (const url of endpoints) {
      try {
        const bodyData = {
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        };
        const body = contentType.includes("json")
          ? JSON.stringify(bodyData)
          : new URLSearchParams(bodyData).toString();

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": contentType },
          body,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.access_token) {
            console.log(`Auth OK via ${url}`);
            return data.access_token;
          }
        }
        await res.text(); // consume
      } catch (_) { /* skip */ }
    }
  }
  throw new Error("Could not authenticate with G-Click API");
}

async function gclickGet(token: string, path: string) {
  const url = `${GCLICK_BASE}${path}`;
  console.log(`GET ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`G-Click GET ${path}: ${res.status} - ${text}`);
  }
  return res.json();
}

// Fetch all pages from paginated endpoint
async function gclickGetAllPages(token: string, basePath: string, pageSize = 50): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  const separator = basePath.includes("?") ? "&" : "?";

  while (true) {
    const data = await gclickGet(token, `${basePath}${separator}size=${pageSize}&page=${page}`);
    if (data.content && Array.isArray(data.content)) {
      all.push(...data.content);
      if (data.last === true || data.content.length < pageSize) break;
      page++;
    } else if (Array.isArray(data)) {
      all.push(...data);
      break;
    } else {
      break;
    }
  }
  return all;
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const action = new URL(req.url).searchParams.get("action") || "test";
    const supabase = getSupabase();

    // ── TEST CONNECTION ──
    if (action === "test") {
      const token = await getAccessToken();
      const departments = await gclickGet(token, "/departamentos");
      const deptList = (departments.content || departments || []).map((d: any) => ({
        id: d.id,
        nome: d.nome,
      }));
      return json({ success: true, message: "Conexão OK!", departments: deptList });
    }

    // ── SYNC CLIENTS ──
    if (action === "sync-clients") {
      const token = await getAccessToken();
      const allGclickClients = await gclickGetAllPages(token, "/clientes");
      // Filter only active clients
      const gclickClients = allGclickClients.filter((c: any) => c.status === "ATIVO");

      const logId = await createLog(supabase, "clients");

      // Get all our clients
      const { data: ourClients } = await supabase.from("clients").select("id, document, name");
      const docMap = new Map<string, string>();
      const nameMap = new Map<string, string>();
      for (const c of ourClients || []) {
        if (c.document) docMap.set(c.document.replace(/\D/g, ""), c.id);
        if (c.name) nameMap.set(c.name.toLowerCase().trim(), c.id);
      }

      let synced = 0;
      for (const gc of gclickClients) {
        const inscricao = (gc.inscricao || "").replace(/\D/g, "");
        const nome = (gc.nome || "").toLowerCase().trim();

        let matchId = inscricao ? docMap.get(inscricao) : undefined;
        if (!matchId && nome) matchId = nameMap.get(nome);

        if (matchId) {
          await supabase.from("clients").update({ gclick_id: String(gc.id) }).eq("id", matchId);
          synced++;
        }
      }

      await updateLog(supabase, logId, "completed", synced,
        `${gclickClients.length} clientes no G-Click, ${synced} vinculados`);

      return json({ success: true, total_gclick: gclickClients.length, synced });
    }

    // ── SYNC CARTEIRAS (responsáveis por cliente) ──
    if (action === "sync-carteiras") {
      const token = await getAccessToken();
      const logId = await createLog(supabase, "carteiras");

      // Get clients that have gclick_id
      const { data: linkedClients } = await supabase
        .from("clients")
        .select("id, gclick_id")
        .not("gclick_id", "is", null);

      let synced = 0;
      for (const client of linkedClients || []) {
        try {
          const responsaveis = await gclickGet(token, `/clientes/${client.gclick_id}/responsaveis`);
          if (Array.isArray(responsaveis) && responsaveis.length > 0) {
            // Get names of all responsáveis per department
            const carteira = responsaveis
              .filter((r: any) => r.ativo !== false)
              .map((r: any) => {
                const dept = r.cargo?.nome || "";
                return `${r.nome}${dept ? ` (${dept})` : ""}`;
              })
              .join(", ");

            if (carteira) {
              await supabase.from("clients").update({ gclick_carteira: carteira }).eq("id", client.id);
              synced++;
            }
          }
        } catch (e) {
          console.log(`Carteira error for gclick_id ${client.gclick_id}: ${e.message}`);
        }
      }

      await updateLog(supabase, logId, "completed", synced,
        `${(linkedClients || []).length} clientes vinculados, ${synced} carteiras atualizadas`);

      return json({ success: true, linked_clients: (linkedClients || []).length, synced });
    }

    // ── SYNC TASKS (dept "5. Atendimento ao Cliente" = ID 16) ──
    if (action === "sync-tasks") {
      const token = await getAccessToken();
      const deptIdParam = new URL(req.url).searchParams.get("departamentoId");

      const deptId = deptIdParam ? parseInt(deptIdParam) : 16;
      const deptName = deptIdParam ? `Dept ${deptId}` : "5. Atendimento ao Cliente";

      // Try fetching tasks for this department
      let tasks: any[] = [];
      const taskEndpoints = [
        `/tarefas?departamentoId=${deptId}&size=100`,
        `/departamentos/${deptId}/tarefas?size=100`,
      ];

      for (const ep of taskEndpoints) {
        try {
          const data = await gclickGet(token, ep);
          tasks = data.content || data || [];
          if (tasks.length > 0) break;
        } catch (e) {
          console.log(`Tasks endpoint ${ep}: ${e.message}`);
        }
      }

      const logId = await createLog(supabase, "tasks", `Dept: ${deptName} (ID: ${deptId})`);

      // Get linked clients map (gclick_id -> our id)
      const { data: linkedClients } = await supabase
        .from("clients")
        .select("id, gclick_id")
        .not("gclick_id", "is", null);
      const gclickToOurId = new Map<string, string>();
      for (const c of linkedClients || []) {
        if (c.gclick_id) gclickToOurId.set(c.gclick_id, c.id);
      }

      let synced = 0;
      for (const task of tasks) {
        const clientGclickId = String(task.clienteId || task.cliente?.id || "");
        const clientId = gclickToOurId.get(clientGclickId);
        if (!clientId) continue;

        const title = task.assunto || task.titulo || task.nome || "Tarefa G-Click";

        // Check duplicate
        const { data: existing } = await supabase
          .from("tasks")
          .select("id")
          .eq("client_id", clientId)
          .eq("title", title)
          .limit(1);
        if (existing && existing.length > 0) continue;

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

      await updateLog(supabase, logId, "completed", synced,
        `Dept: ${deptName}, ${tasks.length} tarefas no G-Click, ${synced} importadas`);

      return json({ success: true, department: deptName, total_tasks: tasks.length, synced });
    }

    return json({ error: "Ação inválida. Use: test, sync-clients, sync-carteiras, sync-tasks" }, 400);
  } catch (err) {
    console.error("gclick-sync error:", err);
    return json({ success: false, error: err.message }, 500);
  }
});

// Helper: create sync log entry
async function createLog(supabase: any, type: string, details = "") {
  const { data } = await supabase.from("gclick_sync_log").insert({
    sync_type: type, status: "running", details,
  }).select("id").single();
  return data?.id;
}

// Helper: update sync log
async function updateLog(supabase: any, id: string | undefined, status: string, count: number, details: string) {
  if (!id) return;
  await supabase.from("gclick_sync_log").update({
    status, records_synced: count, details,
  }).eq("id", id);
}
