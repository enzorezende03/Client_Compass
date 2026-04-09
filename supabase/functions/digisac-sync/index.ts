import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const DIGISAC_API_TOKEN = Deno.env.get('DIGISAC_API_TOKEN')
    if (!DIGISAC_API_TOKEN) {
      throw new Error('DIGISAC_API_TOKEN is not configured')
    }

    const DIGISAC_BASE_URL = Deno.env.get('DIGISAC_BASE_URL')
    if (!DIGISAC_BASE_URL) {
      throw new Error('DIGISAC_BASE_URL is not configured')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch messages from DIGISAC API
    const baseUrl = DIGISAC_BASE_URL.replace(/\/$/, '')
    const messagesRes = await fetch(`${baseUrl}/api/v1/messages?limit=50&sort=-createdAt`, {
      headers: {
        'Authorization': `Bearer ${DIGISAC_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!messagesRes.ok) {
      const errorText = await messagesRes.text()
      throw new Error(`DIGISAC API error [${messagesRes.status}]: ${errorText}`)
    }

    const messagesData = await messagesRes.json()
    const messages = messagesData.data || messagesData || []

    // Filter for complaints/problems - keywords in Portuguese
    const complaintKeywords = [
      'reclamação', 'reclamacao', 'problema', 'erro', 'falha', 'insatisf',
      'urgente', 'crítico', 'critico', 'não funciona', 'nao funciona',
      'demora', 'atraso', 'péssimo', 'pessimo', 'horrível', 'horrivel',
      'absurdo', 'inaceitável', 'inaceitavel', 'resolver', 'solução', 'solucao'
    ]

    const complaints = messages.filter((msg: any) => {
      const text = (msg.text || msg.body || msg.message || '').toLowerCase()
      return complaintKeywords.some(kw => text.includes(kw))
    })

    let imported = 0

    for (const complaint of complaints) {
      const externalId = String(complaint.id || complaint._id || complaint.messageId)
      const contactName = complaint.contact?.name || complaint.contactName || complaint.from?.name || 'Desconhecido'
      const message = complaint.text || complaint.body || complaint.message || ''
      const receivedAt = complaint.createdAt || complaint.timestamp || new Date().toISOString()

      // Upsert to avoid duplicates
      const { error: upsertError } = await supabase
        .from('digisac_complaints')
        .upsert(
          {
            external_id: externalId,
            contact_name: contactName,
            message: message,
            received_at: receivedAt,
          },
          { onConflict: 'external_id' }
        )

      if (upsertError) {
        console.error('Error upserting complaint:', upsertError)
        continue
      }

      // Try to match with existing client by name
      const { data: matchedClients } = await supabase
        .from('clients')
        .select('id')
        .ilike('name', `%${contactName}%`)
        .limit(1)

      if (matchedClients && matchedClients.length > 0) {
        await supabase
          .from('digisac_complaints')
          .update({ matched_client_id: matchedClients[0].id, processed: true })
          .eq('external_id', externalId)

        // Create timeline entry for the matched client
        await supabase
          .from('timeline_entries')
          .insert({
            client_id: matchedClients[0].id,
            date: receivedAt,
            type: 'complaint',
            description: `[DIGISAC] ${message}`,
            responsible: 'Sistema DIGISAC',
            sector: 'commercial',
            origin: 'client',
            demand_status: 'open',
            is_relevant_event: true,
            relevant_event_type: 'Reclamação DIGISAC',
          })
      }

      imported++
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_messages: messages.length,
        complaints_found: complaints.length,
        imported,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('DIGISAC sync error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
