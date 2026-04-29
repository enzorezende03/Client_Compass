import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Janelas de notificação por proximidade do prazo (em dias)
// Cada janela gera uma notificação única (deduplicada por task_id + window key)
const DEADLINE_WINDOWS = [
  { key: 'overdue', daysFrom: -3650, daysTo: -1, label: 'atrasada', emoji: '🚨', urgent: true },
  { key: 'today', daysFrom: 0, daysTo: 0, label: 'vence hoje', emoji: '⏰', urgent: true },
  { key: 'd1', daysFrom: 1, daysTo: 1, label: 'vence amanhã', emoji: '⚠️', urgent: false },
  { key: 'd2', daysFrom: 2, daysTo: 2, label: 'vence em 2 dias', emoji: '🔔', urgent: false },
];

function diffInDays(target: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target + 'T12:00:00');
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    let totalNotified = 0;

    // ===== PARTE 1: Lembretes baseados em horário (scheduled_time + reminder_minutes) =====
    const { data: scheduledTasks } = await supabase
      .from("tasks")
      .select("id, title, client_id, responsible_id, due_date, scheduled_time, reminder_minutes")
      .eq("status", "pending")
      .eq("due_date", todayStr)
      .not("scheduled_time", "is", null)
      .not("responsible_id", "is", null)
      .not("reminder_minutes", "is", null);

    for (const task of scheduledTasks || []) {
      const reminderMinutes = task.reminder_minutes || 60;
      const taskDateTime = new Date(`${task.due_date}T${task.scheduled_time}`);
      const diffMinutes = (taskDateTime.getTime() - now.getTime()) / 60000;

      if (diffMinutes <= reminderMinutes + 5 && diffMinutes > -5) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("task_id", task.id)
          .eq("type", "reminder")
          .like("message", "%agendada para%");
        if (existing && existing.length > 0) continue;

        const { data: client } = await supabase.from("clients").select("name").eq("id", task.client_id).single();
        const clientName = client?.name || "Cliente";
        const timeStr = task.scheduled_time?.slice(0, 5) || "";

        await supabase.from("notifications").insert({
          user_id: task.responsible_id,
          task_id: task.id,
          title: "⏰ Lembrete de tarefa",
          message: `A tarefa "${task.title}" para ${clientName} está agendada para ${timeStr}.`,
          type: "reminder",
        });
        totalNotified++;
      }
    }

    // ===== PARTE 2: Notificações por proximidade de prazo (D-2, D-1, hoje, atrasadas) =====
    // Considera o prazo do cliente se houver, senão prazo interno, senão due_date
    const { data: pendingTasks } = await supabase
      .from("tasks")
      .select("id, title, client_id, responsible_id, due_date, internal_due_date, client_due_date")
      .eq("status", "pending")
      .not("responsible_id", "is", null);

    for (const task of pendingTasks || []) {
      const effectiveDate: string =
        (task as any).client_due_date || (task as any).internal_due_date || task.due_date;
      if (!effectiveDate) continue;

      const days = diffInDays(effectiveDate);
      const window = DEADLINE_WINDOWS.find((w) => days >= w.daysFrom && days <= w.daysTo);
      if (!window) continue;

      // Dedup: uma notificação por janela por tarefa
      const dedupTag = `[deadline:${window.key}]`;
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("task_id", task.id)
        .eq("type", "deadline")
        .like("message", `%${dedupTag}%`);
      if (existing && existing.length > 0) continue;

      const { data: client } = await supabase.from("clients").select("name").eq("id", task.client_id).single();
      const clientName = client?.name || "Cliente";

      const dateLabel = new Date(effectiveDate + "T12:00:00").toLocaleDateString("pt-BR");
      const detail =
        window.key === "overdue"
          ? `está atrasada desde ${dateLabel} (${Math.abs(days)} dia(s))`
          : `${window.label} (${dateLabel})`;

      await supabase.from("notifications").insert({
        user_id: task.responsible_id,
        task_id: task.id,
        title: `${window.emoji} Prazo de tarefa`,
        message: `${dedupTag} A tarefa "${task.title}" para ${clientName} ${detail}.`,
        type: "deadline",
      });
      totalNotified++;
    }

    return new Response(
      JSON.stringify({ message: `Notificações criadas: ${totalNotified}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
