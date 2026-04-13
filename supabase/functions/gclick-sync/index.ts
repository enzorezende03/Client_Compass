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
  // Require complementary status "em carteira"
  const complementar = (c.statusComplementar || c.situacaoComplementar || c.statusCliente || "").toLowerCase().trim();
  const situacao = (c.situacao?.nome || c.situacao?.descricao || "").toLowerCase().trim();
  const statusValue = complementar || situacao;
  if (statusValue !== "em carteira") return false;
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
      // Try to fetch status complementar list
      let statusList: any[] = [];
      const statusEndpoints = ["/statuscomplementar", "/status-complementar", "/clientes/status-complementar", "/situacoes"];
      for (const ep of statusEndpoints) {
        try {
          const data = await gclickGet(token, ep);
          statusList = data.content || data || [];
          if (statusList.length > 0) {
            console.log(`Status complementar from ${ep}:`, JSON.stringify(statusList));
            break;
          }
        } catch (e) {
          console.log(`Status endpoint ${ep}: ${e.message}`);
        }
      }
      return json({ success: true, message: "Conexão OK!", departments: deptList, statusComplementar: statusList });
    }

    // ── PREVIEW CLIENTS ──
    if (action === "preview-clients") {
      const token = await getAccessToken();
      const allGclickClients = await gclickGetAllPages(token, "/clientes");
      // Log first client fields for debugging complementary status field name
      if (allGclickClients.length > 0) {
        // Log unique statusComplementarId values to discover the "em carteira" ID
        const statusIds = new Set(allGclickClients.map((c: any) => c.statusComplementarId));
        console.log("Unique statusComplementarId values:", JSON.stringify([...statusIds]));
        // Log a few samples with their statusComplementarId
        const samples = allGclickClients.slice(0, 5).map((c: any) => ({
          nome: c.nome,
          status: c.status,
          statusComplementarId: c.statusComplementarId,
          inscricao: c.inscricao,
        }));
        console.log("Sample clients:", JSON.stringify(samples));
      }
      const gclickClients = allGclickClients.filter(isAllowedClient);

      const { docMap, nameMap, gclickIdSet } = await getExistingClientMaps(supabase);

      const items: any[] = [];
      for (const gc of gclickClients) {
        const inscricao = (gc.inscricao || "").replace(/\D/g, "");
        const nome = (gc.nome || "").trim();
        const gclickId = String(gc.id);

        if (gclickIdSet.has(gclickId)) continue;

        let matchId = inscricao ? docMap.get(inscricao) : undefined;
        if (!matchId && nome) matchId = nameMap.get(nome.toLowerCase());

        // Fetch contacts for this client
        let contatos: any[] = [];
        try {
          const contatosData = await gclickGet(token, `/clientes/${gclickId}/contatos`);
          contatos = Array.isArray(contatosData) ? contatosData : (contatosData.content || []);
        } catch (e) {
          console.log(`Contatos error for gclick_id ${gclickId}: ${e.message}`);
        }

        items.push({
          gclick_id: gclickId,
          nome: nome || `Cliente G-Click ${gclickId}`,
          inscricao: gc.inscricao || "",
          segmento: gc.ramo || gc.segmento || "",
          status: gc.status,
          match_type: matchId ? "update" : "new",
          match_id: matchId || null,
          data_inicio: gc.dataInicio || "",
          tributacao: extractTaxation(gc.grupos),
          contatos: contatos.map((ct: any) => ({
            nome: ct.nome || "",
            telefone: ct.telefone || ct.celular || "",
            email: ct.email || "",
            cargo: ct.cargo || ct.funcao || "",
          })),
        });
      }

      return json({ success: true, items });
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
      const toUpdate: { id: string; gclick_id: string; taxation: string; contract_start_date: string }[] = [];
      const toInsert: any[] = [];

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
          toUpdate.push({ id: matchId, gclick_id: gclickId, taxation, contract_start_date: startDate });
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
          };
          if (taxation) clientData.taxation = taxation;
          if (startDate) clientData.contract_start_date = startDate;
          toInsert.push(clientData);
        }
      }

      for (const u of toUpdate) {
        const updateData: any = { gclick_id: u.gclick_id };
        if (u.taxation) updateData.taxation = u.taxation;
        if (u.contract_start_date) updateData.contract_start_date = u.contract_start_date;
        await supabase.from("clients").update(updateData).eq("id", u.id);
        // Import contacts for updated client
        await importContacts(supabase, token, u.gclick_id, u.id);
        synced++;
      }

      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100);
        const { data: inserted, error } = await supabase.from("clients").insert(chunk).select("id, gclick_id");
        if (!error && inserted) {
          created += inserted.length;
          // Import contacts for each new client
          for (const newClient of inserted) {
            if (newClient.gclick_id) {
              await importContacts(supabase, token, newClient.gclick_id, newClient.id);
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
      const deptId = parseInt(url.searchParams.get("departamentoId") || "16");

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
      const deptId = parseInt(url.searchParams.get("departamentoId") || "16");

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
        } catch (e) { console.log(`Tasks endpoint ${ep}: ${e.message}`); }
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
        } catch (e) {
          console.log(`Carteira error for gclick_id ${client.gclick_id}: ${e.message}`);
        }
      }

      await updateLog(supabase, logId, "completed", synced,
        `${(linkedClients || []).length} clientes vinculados, ${synced} carteiras atualizadas`);

      return json({ success: true, linked_clients: (linkedClients || []).length, synced });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err) {
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

async function importContacts(supabase: any, token: string, gclickId: string, clientId: string) {
  try {
    const contatosData = await gclickGet(token, `/clientes/${gclickId}/contatos`);
    const contatos = Array.isArray(contatosData) ? contatosData : (contatosData.content || []);
    if (contatos.length === 0) return;

    // Remove existing contacts for this client before re-importing
    await supabase.from("client_contacts").delete().eq("client_id", clientId);

    const toInsert = contatos.map((ct: any) => ({
      client_id: clientId,
      name: ct.nome || "",
      phone: ct.telefone || ct.celular || "",
      email: ct.email || "",
      role: ct.cargo || ct.funcao || "",
    }));

    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100);
      const { error } = await supabase.from("client_contacts").insert(chunk);
      if (error) console.error("Contact insert error:", error.message);
    }
  } catch (e) {
    console.log(`Import contacts error for gclick_id ${gclickId}: ${e.message}`);
  }
}
