import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GCLICK_BASE = "https://api.gclick.com.br";

// Known taxation group names from G-Click
const ALLOWED_STATUSES = ["ATIVO", "SUSPENSO"];

function isAllowedClient(c: any): boolean {
  if (!ALLOWED_STATUSES.includes(c.status)) return false;
  const doc = (c.inscricao || "").replace(/\D/g, "");
  if (doc.length !== 14) return false; // Only CNPJ
  return true;
}

const TAXATION_KEYWORDS = [
  "simples nacional fator r",
  "simples nacional",
  "lucro presumido equiparação hospitalar",
  "lucro presumido",
  "lucro real",
  "mei",
];

function extractTaxation(grupos: any[]): string {
  if (!Array.isArray(grupos)) return "";
  for (const keyword of TAXATION_KEYWORDS) {
    const match = grupos.find((g: any) => (g.nome || "").toLowerCase().includes(keyword));
    if (match) return match.nome;
  }
  return "";
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GCLICK_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GCLICK_CLIENT_SECRET")!;

  const endpoints = [
    `${GCLICK_BASE}/oauth/token`,
    `${GCLICK_BASE}/auth/token`,
    `${GCLICK_BASE}/token`,
  ];

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
        await res.text();
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

async function gclickGetAllPages(token: string, basePath: string, pageSize = 200): Promise<any[]> {
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

async function getExistingClientMaps(supabase: any) {
  const { data: ourClients } = await supabase.from("clients").select("id, document, name, gclick_id");
  const docMap = new Map<string, string>();
  const nameMap = new Map<string, string>();
  const gclickIdSet = new Set<string>();
  for (const c of ourClients || []) {
    if (c.document) docMap.set(c.document.replace(/\D/g, ""), c.id);
    if (c.name) nameMap.set(c.name.toLowerCase().trim(), c.id);
    if (c.gclick_id) gclickIdSet.add(c.gclick_id);
  }
  return { docMap, nameMap, gclickIdSet };
}

async function getIgnoredGclickIds(supabase: any): Promise<Set<string>> {
  const { data } = await supabase.from("gclick_ignored_clients").select("gclick_id");
  return new Set((data || []).map((r: any) => r.gclick_id));
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
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "test";
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

    // ── PREVIEW CLIENTS ──
    if (action === "preview-clients") {
      const token = await getAccessToken();
      const allGclickClients = await gclickGetAllPages(token, "/clientes");
      const gclickClients = allGclickClients.filter(isAllowedClient);

      const { docMap, nameMap, gclickIdSet } = await getExistingClientMaps(supabase);
      const ignoredSet = await getIgnoredGclickIds(supabase);

      const items: any[] = [];
      for (const gc of gclickClients) {
        const inscricao = (gc.inscricao || "").replace(/\D/g, "");
        const nome = (gc.nome || "").trim();
        const gclickId = String(gc.id);

        // Skip if ignored
        if (ignoredSet.has(gclickId)) continue;
        // Skip if already linked by gclick_id
        if (gclickIdSet.has(gclickId)) continue;
        // Skip if already exists in CSHUB by document or name (only show truly new clients)
        if (inscricao && docMap.has(inscricao)) continue;
        if (nome && nameMap.has(nome.toLowerCase())) continue;

        items.push({
          gclick_id: gclickId,
          nome: nome || `Cliente G-Click ${gclickId}`,
          inscricao: gc.inscricao || "",
          segmento: gc.ramo || gc.segmento || "",
          status: gc.status,
          match_type: "new",
          match_id: null,
          data_inicio: gc.dataInicio || "",
          tributacao: extractTaxation(gc.grupos),
          contatos: [],
        });
      }

      return json({ success: true, items });
    }

    // ── LIST IGNORED CLIENTS ──
    if (action === "list-ignored") {
      const { data, error } = await supabase
        .from("gclick_ignored_clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, items: data || [] });
    }

    // ── IGNORE CLIENTS ──
    if (action === "ignore-clients") {
      const body = await req.json();
      const items: { gclick_id: string; nome?: string; inscricao?: string }[] = body.items || [];
      const ignoredBy: string = body.ignored_by || "";
      if (items.length === 0) return json({ success: false, error: "Nenhum cliente informado" }, 400);

      const rows = items.map((it) => ({
        gclick_id: String(it.gclick_id),
        nome: it.nome || "",
        inscricao: it.inscricao || "",
        ignored_by: ignoredBy,
      }));

      const { error } = await supabase
        .from("gclick_ignored_clients")
        .upsert(rows, { onConflict: "gclick_id", ignoreDuplicates: true });

      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, ignored: rows.length });
    }

    // ── RESTORE IGNORED CLIENTS ──
    if (action === "restore-ignored") {
      const body = await req.json();
      const ids: string[] = body.gclick_ids || [];
      if (ids.length === 0) return json({ success: false, error: "Nenhum ID informado" }, 400);

      const { error } = await supabase
        .from("gclick_ignored_clients")
        .delete()
        .in("gclick_id", ids);

      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, restored: ids.length });
    }

    // ── IMPORT SELECTED CLIENTS ──
    if (action === "import-clients") {
      const body = await req.json();
      const selectedIds: string[] = body.selected_ids || [];
      if (selectedIds.length === 0) return json({ success: false, error: "Nenhum ID selecionado" }, 400);

      const token = await getAccessToken();
      const allGclickClients = await gclickGetAllPages(token, "/clientes");
      const selectedSet = new Set(selectedIds);
      const gclickClients = allGclickClients.filter((c: any) => selectedSet.has(String(c.id)));

      const { docMap, nameMap, gclickIdSet } = await getExistingClientMaps(supabase);
      const logId = await createLog(supabase, "clients-selective");

      let synced = 0, created = 0;
      const toUpdate: { id: string; gclick_id: string; taxation: string; contract_start_date: string; gc: any }[] = [];
      const toInsert: { data: any; gc: any }[] = [];

      for (const gc of gclickClients) {
        const inscricao = (gc.inscricao || "").replace(/\D/g, "");
        const nome = (gc.nome || "").trim();
        const gclickId = String(gc.id);

        if (gclickIdSet.has(gclickId)) continue;

        let matchId = inscricao ? docMap.get(inscricao) : undefined;
        if (!matchId && nome) matchId = nameMap.get(nome.toLowerCase());

        const taxation = extractTaxation(gc.grupos);
        const startDate = gc.dataInicio || "";

        if (matchId) {
          toUpdate.push({ id: matchId, gclick_id: gclickId, taxation, contract_start_date: startDate, gc });
        } else {
          const clientData: any = {
            name: nome || `Cliente G-Click ${gclickId}`,
            document: gc.inscricao || "",
            gclick_id: gclickId,
            segment: gc.ramo || gc.segmento || "",
            cs_responsible: "",
            status: "active",
            health_score: "healthy",
            financial_status: "active_financial",
            complexity: "C",
            profile: "standard",
            taxation: taxation || "",
          };
          if (startDate) clientData.contract_start_date = startDate;
          toInsert.push({ data: clientData, gc });
        }
      }

      for (const u of toUpdate) {
        const updateData: any = { gclick_id: u.gclick_id };
        if (u.taxation) updateData.taxation = u.taxation;
        if (u.contract_start_date) updateData.contract_start_date = u.contract_start_date;
        await supabase.from("clients").update(updateData).eq("id", u.id);
        await importContactsFromClientData(supabase, u.id, u.gc);
        synced++;
      }

      // Build a map of gclick_id -> gc for contact import after insert
      const gcByGclickId = new Map<string, any>();
      for (const item of toInsert) {
        gcByGclickId.set(item.data.gclick_id, item.gc);
      }

      const insertRows = toInsert.map(item => item.data);
      for (let i = 0; i < insertRows.length; i += 100) {
        const chunk = insertRows.slice(i, i + 100);
        const { data: inserted, error } = await supabase.from("clients").insert(chunk).select("id, gclick_id");
        if (!error && inserted) {
          created += inserted.length;
          for (const newClient of inserted) {
            const gc = gcByGclickId.get(newClient.gclick_id);
            if (gc) {
              await importContactsFromClientData(supabase, newClient.id, gc);
            }
          }
        } else if (error) {
          console.error("Insert batch error:", error.message);
        }
      }

      await updateLog(supabase, logId, "completed", synced + created,
        `${selectedIds.length} selecionados, ${synced} vinculados, ${created} criados`);

      return json({ success: true, imported: synced + created, synced, created });
    }

    // ── PREVIEW TASKS ──
    if (action === "preview-tasks") {
      const token = await getAccessToken();
      // Default: department 25 = "6. Sucesso do Cliente" (Atendimento ao Cliente / CS)
      const deptId = parseInt(url.searchParams.get("departamentoId") || "25");

      let tasks: any[] = [];
      // G-Click /tarefas requires `categoria` (OBRIGACAO, SERVICO, AVULSA...). Try the main ones.
      // G-Click TarefaCategoria enum (PascalCase). Tentamos todas para descobrir as válidas.
      const categorias = ["Obrigacao", "Servico", "Avulsa", "Tarefa", "Processo", "Honorario"];
      const taskEndpoints: string[] = [];
      for (const cat of categorias) {
        taskEndpoints.push(`/tarefas?departamentoId=${deptId}&categoria=${cat}&size=100`);
      }
      taskEndpoints.push(`/departamentos/${deptId}/tarefas?size=100`);

      for (const ep of taskEndpoints) {
        try {
          const data = await gclickGet(token, ep);
          const list = data.content || data || [];
          console.log(`[preview-tasks] ${ep} -> ${Array.isArray(list) ? list.length : 0} tarefas`);
          if (Array.isArray(list) && list.length > 0) {
            tasks.push(...list);
          }
        } catch (e: any) {
          console.log(`Tasks endpoint ${ep}: ${e.message}`);
        }
      }

      console.log(`[preview-tasks] dept=${deptId} total tasks from G-Click: ${tasks.length}`);

      const { data: linkedClients } = await supabase
        .from("clients")
        .select("id, gclick_id, name")
        .not("gclick_id", "is", null);
      const gclickToClient = new Map<string, { id: string; name: string }>();
      for (const c of linkedClients || []) {
        if (c.gclick_id) gclickToClient.set(c.gclick_id, { id: c.id, name: c.name });
      }

      const items: any[] = [];
      for (const task of tasks) {
        const clientGclickId = String(task.clienteId || task.cliente?.id || "");
        const client = gclickToClient.get(clientGclickId);
        if (!client) continue;

        const title = task.assunto || task.titulo || task.nome || "Tarefa G-Click";

        const { data: existing } = await supabase
          .from("tasks")
          .select("id")
          .eq("client_id", client.id)
          .eq("title", title)
          .limit(1);
        if (existing && existing.length > 0) continue;

        items.push({
          gclick_id: String(task.id || `${clientGclickId}-${title}`),
          title,
          client_name: client.name,
          client_id: client.id,
          responsible: task.responsavel?.nome || "",
          due_date: task.dataVencimento || task.prazo || "",
          description: task.andamento || task.descricao || "",
        });
      }

      return json({ success: true, items });
    }

    // ── IMPORT SELECTED TASKS ──
    if (action === "import-tasks") {
      const body = await req.json();
      const selectedIds: string[] = body.selected_ids || [];
      if (selectedIds.length === 0) return json({ success: false, error: "Nenhum ID selecionado" }, 400);

      const token = await getAccessToken();
      const deptId = parseInt(url.searchParams.get("departamentoId") || "25");

      let tasks: any[] = [];
      const categorias = ["OBRIGACAO", "SERVICO", "AVULSA"];
      const taskEndpoints: string[] = [];
      for (const cat of categorias) {
        taskEndpoints.push(`/tarefas?departamentoId=${deptId}&categoria=${cat}&size=100`);
      }
      taskEndpoints.push(`/departamentos/${deptId}/tarefas?size=100`);
      for (const ep of taskEndpoints) {
        try {
          const data = await gclickGet(token, ep);
          const list = data.content || data || [];
          if (Array.isArray(list) && list.length > 0) tasks.push(...list);
        } catch (e: any) { console.log(`Tasks endpoint ${ep}: ${e.message}`); }
      }

      const { data: linkedClients } = await supabase
        .from("clients")
        .select("id, gclick_id")
        .not("gclick_id", "is", null);
      const gclickToOurId = new Map<string, string>();
      for (const c of linkedClients || []) {
        if (c.gclick_id) gclickToOurId.set(c.gclick_id, c.id);
      }

      const selectedSet = new Set(selectedIds);
      const logId = await createLog(supabase, "tasks-selective");
      let imported = 0;

      for (const task of tasks) {
        const taskId = String(task.id || "");
        const clientGclickId = String(task.clienteId || task.cliente?.id || "");
        const title = task.assunto || task.titulo || task.nome || "Tarefa G-Click";
        const compositeId = taskId || `${clientGclickId}-${title}`;

        if (!selectedSet.has(compositeId)) continue;

        const clientId = gclickToOurId.get(clientGclickId);
        if (!clientId) continue;

        const { data: existing } = await supabase
          .from("tasks").select("id").eq("client_id", clientId).eq("title", title).limit(1);
        if (existing && existing.length > 0) continue;

        await supabase.from("tasks").insert({
          client_id: clientId,
          title,
          description: task.andamento || task.descricao || "",
          responsible: task.responsavel?.nome || "",
          due_date: task.dataVencimento || task.prazo || new Date().toISOString().split("T")[0],
          status: "pending",
        });
        imported++;
      }

      await updateLog(supabase, logId, "completed", imported,
        `${selectedIds.length} selecionadas, ${imported} importadas`);

      return json({ success: true, imported });
    }

    // ── SYNC CARTEIRAS ──
    if (action === "sync-carteiras") {
      const token = await getAccessToken();
      const logId = await createLog(supabase, "carteiras");

      const { data: linkedClients } = await supabase
        .from("clients")
        .select("id, gclick_id")
        .not("gclick_id", "is", null);

      let synced = 0;
      for (const client of linkedClients || []) {
        try {
          const responsaveis = await gclickGet(token, `/clientes/${client.gclick_id}/responsaveis`);
          if (Array.isArray(responsaveis) && responsaveis.length > 0) {
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
        } catch (e: any) {
          console.log(`Carteira error for gclick_id ${client.gclick_id}: ${e.message}`);
        }
      }

      await updateLog(supabase, logId, "completed", synced,
        `${(linkedClients || []).length} clientes vinculados, ${synced} carteiras atualizadas`);

      return json({ success: true, linked_clients: (linkedClients || []).length, synced });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err: any) {
    console.error("gclick-sync error:", err);
    return json({ success: false, error: err.message }, 500);
  }
});

async function createLog(supabase: any, type: string, details = "") {
  const { data } = await supabase.from("gclick_sync_log").insert({
    sync_type: type, status: "running", details,
  }).select("id").single();
  return data?.id;
}

async function updateLog(supabase: any, id: string | undefined, status: string, count: number, details: string) {
  if (!id) return;
  await supabase.from("gclick_sync_log").update({
    status, records_synced: count, details,
  }).eq("id", id);
}

async function importContactsFromClientData(supabase: any, clientId: string, gc: any) {
  try {
    const telefones = gc.telefones || [];
    const emails = gc.emails || [];

    // Build a contact map by name, merging phone+email
    const contactMap = new Map<string, { name: string; phone: string; email: string; role: string }>();

    for (const t of telefones) {
      const name = (t.nome || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = contactMap.get(key) || { name, phone: "", email: "", role: "" };
      existing.phone = t.numero || "";
      if (t.categorias && t.categorias.length > 0) existing.role = t.categorias.join(", ");
      contactMap.set(key, existing);
    }

    for (const e of emails) {
      const name = (e.nome || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = contactMap.get(key) || { name, phone: "", email: "", role: "" };
      existing.email = e.email || "";
      if (!existing.role && e.categorias && e.categorias.length > 0) existing.role = e.categorias.join(", ");
      contactMap.set(key, existing);
    }

    const contacts = Array.from(contactMap.values());
    if (contacts.length === 0) return;

    // Remove existing contacts for this client before re-importing
    await supabase.from("client_contacts").delete().eq("client_id", clientId);

    const toInsert = contacts.map((ct) => ({
      client_id: clientId,
      name: ct.name,
      phone: ct.phone,
      email: ct.email,
      role: ct.role,
    }));

    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100);
      const { error } = await supabase.from("client_contacts").insert(chunk);
      if (error) console.error("Contact insert error:", error.message);
    }
    console.log(`Imported ${toInsert.length} contacts for client ${clientId}`);
  } catch (e: any) {
    console.log(`Import contacts error for client ${clientId}: ${e.message}`);
  }
}
