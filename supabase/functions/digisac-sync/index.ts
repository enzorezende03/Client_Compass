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
    const authHeaders = {
      'Authorization': `Bearer ${DIGISAC_API_TOKEN}`,
      'Content-Type': 'application/json',
    }

    // Try multiple endpoints to find messages
    const endpoints = [
      '/api/v1/tickets?limit=100&sort=-createdAt',
      '/api/v1/messages?limit=100&sort=-createdAt',
      '/api/v1/messages?limit=100',
    ]

    let allMessages: any[] = []
    let contactMap = new Map<string, string>()

    // Fetch contacts first
    try {
      const contactsRes = await fetch(`${baseUrl}/api/v1/contacts?limit=200`, { headers: authHeaders })
      if (contactsRes.ok) {
        const contactsData = await contactsRes.json()
        const contacts = contactsData.data || contactsData.rows || contactsData || []
        // Log first contact raw structure
        if (Array.isArray(contacts) && contacts.length > 0) {
          console.log(`[CONTACT RAW KEYS] ${JSON.stringify(Object.keys(contacts[0]))}`)
          console.log(`[CONTACT RAW SAMPLE] ${JSON.stringify(contacts[0]).substring(0, 500)}`)
        }
        for (const c of (Array.isArray(contacts) ? contacts : [])) {
          const name = c.name || c.pushName || c.displayName || ''
          const id = c.id || c._id || ''
          if (id && name) {
            contactMap.set(String(id), name)
            console.log(`[CONTACT] ${id} -> ${name}`)
          }
        }
        console.log(`[DIGISAC] Loaded ${contactMap.size} contacts`)
      } else {
        const err = await contactsRes.text()
        console.error(`[DIGISAC] Contacts fetch failed: ${contactsRes.status} - ${err}`)
      }
    } catch (e) {
      console.error('[DIGISAC] Contacts error:', e)
    }

    // Try tickets endpoint
    try {
      const ticketsRes = await fetch(`${baseUrl}/api/v1/tickets?limit=100&sort=-createdAt`, { headers: authHeaders })
      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json()
        const tickets = ticketsData.data || ticketsData.rows || ticketsData || []
        const ticketArr = Array.isArray(tickets) ? tickets : []
        console.log(`[DIGISAC] Tickets endpoint returned ${ticketArr.length} items`)
        // Log first ticket raw structure
        if (ticketArr.length > 0) {
          console.log(`[TICKET RAW KEYS] ${JSON.stringify(Object.keys(ticketArr[0]))}`)
          console.log(`[TICKET RAW SAMPLE] ${JSON.stringify(ticketArr[0]).substring(0, 500)}`)
        }
        for (const ticket of ticketArr) {
          const contactId = ticket.contactId || ticket.contact_id || ''
          const contactName = ticket.contact?.name || contactMap.get(String(contactId)) || ''
          const lastMsg = ticket.lastMessage || ticket.last_message || ticket.message || ''
          const text = typeof lastMsg === 'object' ? (lastMsg.text || lastMsg.body || JSON.stringify(lastMsg)) : lastMsg
          
          console.log(`[TICKET] Contact: ${contactName || 'N/A'} (id:${contactId}) | Text: ${String(text).substring(0, 150)}`)
          
          allMessages.push({
            id: ticket.id,
            contactId,
            contactName,
            text: String(text),
            createdAt: ticket.createdAt || ticket.created_at || ticket.updatedAt,
            source: 'ticket'
          })
        }
      } else {
        const err = await ticketsRes.text()
        console.log(`[DIGISAC] Tickets endpoint: ${ticketsRes.status} - ${err.substring(0, 200)}`)
      }
    } catch (e) {
      console.error('[DIGISAC] Tickets error:', e)
    }

    // Also fetch messages with pagination
    let page = 0
    let hasMore = true
    while (hasMore && page < 5) {
      try {
        const skip = page * 100
        const msgRes = await fetch(`${baseUrl}/api/v1/messages?limit=100&skip=${skip}&sort=-createdAt`, { headers: authHeaders })
        if (msgRes.ok) {
          const msgData = await msgRes.json()
          const msgs = msgData.data || msgData.rows || msgData || []
          const msgArr = Array.isArray(msgs) ? msgs : []
          
          if (msgArr.length === 0) {
            hasMore = false
          } else {
            console.log(`[DIGISAC] Messages page ${page}: ${msgArr.length} items`)
            for (const msg of msgArr) {
              const contactId = msg.contactId || msg.contact_id || ''
              const contactName = msg.contact?.name || contactMap.get(String(contactId)) || ''
              const text = msg.text || msg.body || msg.message || ''
              
              allMessages.push({
                id: msg.id || msg._id,
                contactId,
                contactName,
                text,
                createdAt: msg.createdAt || msg.timestamp,
                source: 'message'
              })
            }
            page++
            if (msgArr.length < 100) hasMore = false
          }
        } else {
          const err = await msgRes.text()
          console.log(`[DIGISAC] Messages page ${page}: ${msgRes.status} - ${err.substring(0, 200)}`)
          hasMore = false
        }
      } catch (e) {
        console.error(`[DIGISAC] Messages page ${page} error:`, e)
        hasMore = false
      }
    }

    console.log(`[DIGISAC] Total messages collected: ${allMessages.length}`)

    // Search for Ana Braga specifically
    const anaMessages = allMessages.filter(m => 
      m.contactName?.toLowerCase().includes('ana') || 
      m.text?.toLowerCase().includes('ana braga')
    )
    console.log(`[DIGISAC] Messages mentioning Ana: ${anaMessages.length}`)
    for (const m of anaMessages) {
      console.log(`[ANA] ${m.contactName} | ${m.text?.substring(0, 200)}`)
    }

    // Complaint keywords
    const complaintKeywords = [
      'reclamação', 'reclamacao', 'problema', 'falha', 'insatisf',
      'urgente', 'crítico', 'critico', 'não funciona', 'nao funciona',
      'demora', 'atraso', 'péssimo', 'pessimo', 'horrível', 'horrivel',
      'absurdo', 'inaceitável', 'inaceitavel', 'solução', 'solucao',
      'atendimento', 'ruim', 'chatead', 'decepcion', 'frustr',
      'descaso', 'negligên', 'negligen', 'abandono', 'desrespeito',
      'insatisfeito', 'insatisfeita', 'mal atend', 'péssima', 'terrível', 'terrivel'
    ]

    // Deduplicate by id
    const seen = new Set<string>()
    const unique = allMessages.filter(m => {
      const key = String(m.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const complaints = unique.filter(m => {
      const text = (m.text || '').toLowerCase()
      return complaintKeywords.some(kw => text.includes(kw))
    })

    console.log(`[DIGISAC] Complaints found: ${complaints.length}`)

    let imported = 0

    for (const complaint of complaints) {
      const externalId = String(complaint.id)
      const contactName = complaint.contactName || 'Desconhecido'
      const message = complaint.text || ''
      const receivedAt = complaint.createdAt || new Date().toISOString()

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

      // Match with existing client
      if (contactName !== 'Desconhecido') {
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
      }

      imported++
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_contacts: contactMap.size,
        total_messages: unique.length,
        complaints_found: complaints.length,
        ana_messages: anaMessages.length,
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
