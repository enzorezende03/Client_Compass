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

    // Helper to fetch paginated - DIGISAC API uses page/pageSize, default pageSize=15
    const PAGE_SIZE = 15 // API ignores larger values
    async function fetchAll(endpoint: string, maxItems = 500): Promise<any[]> {
      const results: any[] = []
      const maxPages = Math.ceil(maxItems / PAGE_SIZE)
      for (let page = 1; page <= maxPages; page++) {
        const separator = endpoint.includes('?') ? '&' : '?'
        const url = `${baseUrl}${endpoint}${separator}page=${page}&pageSize=${PAGE_SIZE}`
        const res = await fetch(url, { headers: authHeaders })
        if (!res.ok) {
          console.error(`[FETCH] page ${page} failed: ${res.status}`)
          break
        }
        const data = await res.json()
        const items = data.data || data.rows || data.results || (Array.isArray(data) ? data : [])
        if (!Array.isArray(items) || items.length === 0) break
        results.push(...items)
        if (data.total && results.length >= Math.min(data.total, maxItems)) break
        if (items.length < PAGE_SIZE) break
      }
      console.log(`[FETCH] ${endpoint}: fetched ${results.length} items total`)
      return results
    }

    // 1. Fetch contacts (enough to find Ana Braga among 1492 total)
    const contacts = await fetchAll('/api/v1/contacts', 1500)
    
    const contactMap = new Map<string, string>()
    for (const c of contacts) {
      const name = c.name || c.internalName || c.alternativeName || c.pushName || ''
      if (c.id && name) contactMap.set(String(c.id), name)
    }
    console.log(`[DIGISAC] Loaded ${contactMap.size} unique contacts`)

    // Log contacts with "braga" in the name
    for (const [id, name] of contactMap) {
      if (name.toLowerCase().includes('braga')) {
        console.log(`[DIGISAC] Found Braga contact: ${name} (id: ${id})`)
      }
    }

    // 2. Fetch recent tickets
    const tickets = await fetchAll('/api/v1/tickets?sort=-updatedAt', 300)
    console.log(`[DIGISAC] Loaded ${tickets.length} tickets`)

    // 3. Collect messages from tickets
    const allMessages: Array<{
      id: string; contactName: string; text: string; createdAt: string;
    }> = []

    for (const ticket of tickets) {
      const contactId = ticket.contactId || ''
      const contactName = contactMap.get(String(contactId)) || ''
      
      // Extract lastMessage
      const lm = ticket.lastMessage
      let text = ''
      if (lm && typeof lm === 'object') {
        text = lm.text || lm.body || lm.message || ''
      } else if (typeof lm === 'string') {
        text = lm
      }

      // Also check firstMessage
      const fm = ticket.firstMessage
      let firstText = ''
      if (fm && typeof fm === 'object') {
        firstText = fm.text || fm.body || fm.message || ''
      }

      if (text || firstText) {
        if (text) {
          allMessages.push({
            id: `${ticket.id}-last`,
            contactName,
            text,
            createdAt: ticket.updatedAt || ticket.createdAt || new Date().toISOString(),
          })
        }
        if (firstText && firstText !== text) {
          allMessages.push({
            id: `${ticket.id}-first`,
            contactName,
            text: firstText,
            createdAt: ticket.createdAt || new Date().toISOString(),
          })
        }
      }

      // Log if contact is Ana
      if (contactName.toLowerCase().includes('ana')) {
        console.log(`[ANA TICKET] ${contactName} | last: ${text.substring(0, 150)} | first: ${firstText.substring(0, 150)}`)
      }
    }

    // 4. Also fetch standalone messages
    const messages = await fetchAll('/api/v1/messages?sort=-createdAt')
    console.log(`[DIGISAC] Loaded ${messages.length} standalone messages`)

    for (const msg of messages) {
      const contactId = msg.contactId || msg.contact_id || ''
      const contactName = contactMap.get(String(contactId)) || ''
      const text = msg.text || msg.body || msg.message || ''

      if (contactName.toLowerCase().includes('ana')) {
        console.log(`[ANA MSG] ${contactName} | ${text.substring(0, 200)}`)
      }

      allMessages.push({
        id: String(msg.id || msg._id),
        contactName,
        text,
        createdAt: msg.createdAt || msg.timestamp || new Date().toISOString(),
      })
    }

    console.log(`[DIGISAC] Total messages: ${allMessages.length}`)

    // 5. Filter complaints
    const complaintKeywords = [
      'reclamação', 'reclamacao', 'problema', 'falha', 'insatisf',
      'urgente', 'crítico', 'critico', 'não funciona', 'nao funciona',
      'demora', 'atraso', 'péssimo', 'pessimo', 'horrível', 'horrivel',
      'absurdo', 'inaceitável', 'inaceitavel', 'solução', 'solucao',
      'atendimento', 'ruim', 'chatead', 'decepcion', 'frustr',
      'descaso', 'negligên', 'negligen', 'insatisfeito', 'insatisfeita',
      'mal atend', 'péssima', 'terrível', 'terrivel'
    ]

    const seen = new Set<string>()
    const unique = allMessages.filter(m => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })

    const complaints = unique.filter(m => {
      const text = (m.text || '').toLowerCase()
      return complaintKeywords.some(kw => text.includes(kw))
    })

    console.log(`[DIGISAC] Complaints: ${complaints.length}`)

    let imported = 0
    for (const c of complaints) {
      console.log(`[COMPLAINT] ${c.contactName || 'N/A'}: ${c.text.substring(0, 150)}`)

      const { error } = await supabase
        .from('digisac_complaints')
        .upsert(
          { external_id: c.id, contact_name: c.contactName || 'Desconhecido', message: c.text, received_at: c.createdAt },
          { onConflict: 'external_id' }
        )
      if (error) { console.error('Upsert error:', error); continue }

      if (c.contactName) {
        const { data: matched } = await supabase
          .from('clients').select('id').ilike('name', `%${c.contactName}%`).limit(1)

        if (matched?.length) {
          await supabase.from('digisac_complaints')
            .update({ matched_client_id: matched[0].id, processed: true })
            .eq('external_id', c.id)

          await supabase.from('timeline_entries').insert({
            client_id: matched[0].id, date: c.createdAt, type: 'complaint',
            description: `[DIGISAC] ${c.text}`, responsible: 'Sistema DIGISAC',
            sector: 'commercial', origin: 'client', demand_status: 'open',
            is_relevant_event: true, relevant_event_type: 'Reclamação DIGISAC',
          })
        }
      }
      imported++
    }

    return new Response(
      JSON.stringify({ success: true, total_contacts: contactMap.size, total_messages: unique.length, complaints_found: complaints.length, imported }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('DIGISAC sync error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
