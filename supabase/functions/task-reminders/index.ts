import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time and 1 hour from now
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // Format dates for comparison
    const todayStr = now.toISOString().split("T")[0];

    // Fetch pending tasks with a responsible_id, due today, that have a scheduled_time and reminder
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, title, client_id, responsible_id, responsible, due_date, scheduled_time, status, reminder_minutes")
      .eq("status", "pending")
      .eq("due_date", todayStr)
      .not("scheduled_time", "is", null)
      .not("responsible_id", "is", null)
      .not("reminder_minutes", "is", null);

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      return new Response(JSON.stringify({ error: tasksError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ message: "No tasks to process", notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notifiedCount = 0;

    for (const task of tasks) {
      // Use task-specific reminder_minutes
      const reminderMinutes = task.reminder_minutes || 60;
      const taskDateTime = new Date(`${task.due_date}T${task.scheduled_time}`);
      const diffMs = taskDateTime.getTime() - now.getTime();
      const diffMinutes = diffMs / 60000;

      // Check if we're within the reminder window (±5 min tolerance)
      if (diffMinutes <= reminderMinutes + 5 && diffMinutes > -5) {
        // Check if notification already exists for this task (avoid duplicates)
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("task_id", task.id)
          .eq("type", "reminder");

        if (existing && existing.length > 0) continue;

        // Get client name
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", task.client_id)
          .single();

        const clientName = client?.name || "Cliente";
        const timeStr = task.scheduled_time?.slice(0, 5) || "";

        // Create in-app notification
        await supabase.from("notifications").insert({
          user_id: task.responsible_id,
          task_id: task.id,
          title: "⏰ Lembrete de tarefa",
          message: `A tarefa "${task.title}" para ${clientName} está agendada para ${timeStr}. Prepare-se para o retorno!`,
          type: "reminder",
        });

        // Get user email for sending email notification
        const { data: user } = await supabase
          .from("internal_users")
          .select("name, email")
          .eq("id", task.responsible_id)
          .single();

        if (user?.email) {
          // Send email via Lovable AI Gateway
          const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
          if (lovableApiKey) {
            try {
              const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: #1a365d; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 20px;">⏰ Lembrete de Tarefa</h1>
                  </div>
                  <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="color: #2d3748; font-size: 16px;">Olá, <strong>${user.name}</strong>!</p>
                    <p style="color: #4a5568; font-size: 14px;">Você tem uma tarefa agendada para daqui a aproximadamente <strong>1 hora</strong>:</p>
                    <div style="background: #f7fafc; border-left: 4px solid #1a365d; padding: 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
                      <p style="margin: 0 0 8px; font-weight: bold; color: #2d3748;">${task.title}</p>
                      <p style="margin: 0 0 4px; color: #718096; font-size: 13px;">📋 Cliente: ${clientName}</p>
                      <p style="margin: 0; color: #718096; font-size: 13px;">🕐 Horário: ${timeStr}</p>
                    </div>
                    <p style="color: #718096; font-size: 13px; margin-top: 24px;">— Equipe CS</p>
                  </div>
                </div>
              `;

              // Use Supabase built-in email or a simple approach
              console.log(`Email reminder would be sent to ${user.email} for task ${task.id}`);
              // For now, log the email. Full email integration can be added later.
            } catch (emailError) {
              console.error("Error sending email:", emailError);
            }
          }
        }

        notifiedCount++;
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${tasks.length} tasks, notified ${notifiedCount}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
