import { corsHeaders } from "npm:@supabase/supabase-js/cors"
import { createClient } from "npm:@supabase/supabase-js"

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const DIGISAC_API_TOKEN = Deno.env.get('DIGISAC_API_TOKEN')
    if (!DIGISAC_API_TOKEN) throw new Error('DIGISAC_API_TOKEN is not configured')

    const DIGISAC_BASE_URL = Deno.env.get('DIGISAC_BASE_URL')
    if (!DIGISAC_BASE_URL) throw new Error('DIGISAC_BASE_URL is not configured')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const baseUrl = DIGISAC_BASE_URL.replace(/\/$/, '')
    const headers = {
      'Authorization': `Bearer ${DIGISAC_API_TOKEN}`,
      'Content-Type': 'application/json',
    }

    // Step 1: Fetch contacts
    const contactsRes = await fetch(`${baseUrl}/api/v1/contacts?limit=100`, { headers })
    if (!contactsRes.ok) {
      const err = await contactsRes.text()
      throw new Error(`DIGISAC contacts API error [${contactsRes.status}]: ${err}`)
    }
    const contactsData = await contactsRes.json()
    const contacts = contactsData.data || contactsData || []
    console.log(`[DIGISAC] Found ${contacts.length} contacts`)

    // Step 2: Fetch recent messages
    const messagesRes = await fetch(`${baseUrl}/api/v1/messages?limit=100&sort=-createdAt`, { headers })
    if (!messagesRes.ok) {
      const err = await messagesRes.text()
      throw new Error(`DIGISAC messages API error [${messagesRes.status}]: ${err}`)
    }
    const messagesData = await messagesRes.json()
    const messages = messagesData.data || messagesData || []

    // Build contact lookup by ID
    const contactMap = new Map<string, string>()
    for (const c of contacts) {
      const name = c.name || c.pushName || c.displayName || ''
      const id = c.id || c._id || ''
      if (id && name) contactMap.set(String(id), name)
    }

    // Log all messages with resolved contact names
    for (const msg of messages) {
      const contactId = msg.contactId || msg.contact_id || ''
      const contactName = contactMap.get(String(contactId)) || msg.contact?.name || msg.contactName || msg.from?.name || 'N/A'
      const text = msg.text || msg.body || msg.message || ''
      const fromMe = msg.fromMe || msg.from_me || false
      console.log(`[DIGISAC MSG] Contact: ${contactName} (id:${contactId}) | fromMe: ${fromMe} | Text: ${text.substring(0, 150)}`)
    }

    // Complaint keywords
    const complaintKeywords = [
      'reclamação', 'reclamacao', 'problema', 'erro', 'falha', 'insatisf',
      'urgente', 'crítico', 'critico', 'não funciona', 'nao funciona',
      'demora', 'atraso', 'péssimo', 'pessimo', 'horrível', 'horrivel',
      'absurdo', 'inaceitável', 'inaceitavel', 'resolver', 'solução', 'solucao',
      'atendimento', 'ruim', 'chatead', 'decepcion', 'frustr',
      'descaso', 'negligên', 'negligen', 'abandono', 'desrespeito', 'falta de',
      'insatisfeito', 'insatisfeita', 'mal atend', 'péssima', 'terrível', 'terrivel',
      'cobran', 'caro', 'valor', 'preço', 'preco'
    ]

    const complaints = messages.filter((msg: any) => {
      const text = (msg.text || msg.body || msg.message || '').toLowerCase()
      return complaintKeywords.some(kw => text.includes(kw))
    })

    console.log(`[DIGISAC] Complaints found: ${complaints.length}`)

    let imported = 0

    for (const complaint of complaints) {
      const externalId = String(complaint.id || complaint._id || complaint.messageId)
      const contactId = complaint.contactId || complaint.contact_id || ''
      const contactName = contactMap.get(String(contactId)) || complaint.contact?.name || complaint.contactName || complaint.from?.name || 'Desconhecido'
      const message = complaint.text || complaint.body || complaint.message || ''
      const receivedAt = complaint.createdAt || complaint.timestamp || new Date().toISOString()

      // Upsert complaint
      const { error: upsertError } = await supabase
        .from('digisac_complaints')
        .upsert(
          { external_id: externalId, contact_name: contactName, message, received_at: receivedAt },
          { onConflict: 'external_id' }
        )

      if (upsertError) {
        console.error('Error upserting complaint:', upsertError)
        continue
      }

      // Try to match with existing client
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
      JSON.stringify({ success: true, total_contacts: contacts.length, total_messages: messages.length, complaints_found: complaints.length, imported }),
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
