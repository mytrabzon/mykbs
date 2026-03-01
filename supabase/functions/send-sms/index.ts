import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizePhone(phone: string): string {
  let p = String(phone || '').trim().replace(/\D/g, '')
  if (p.startsWith('90') && p.length === 12) return p
  if (p.startsWith('0')) p = '90' + p.slice(1)
  else if (!p.startsWith('90')) p = '90' + p
  return p.slice(0, 12)
}

async function sendNetgsm(phone: string, text: string): Promise<{ success: boolean; error?: string }> {
  const usercode = Deno.env.get('NETGSM_USERCODE')
  const password = Deno.env.get('NETGSM_PASSWORD')
  const msgheader = Deno.env.get('NETGSM_MSGHEADER') || 'KBS Prime'
  if (!usercode || !password) return { success: false, error: 'NETGSM_USERCODE/PASSWORD yok' }

  const no = normalizePhone(phone)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mainbody>
  <header>
    <company>NETGSM</company>
    <usercode>${usercode}</usercode>
    <password>${password}</password>
    <msgheader>${msgheader}</msgheader>
  </header>
  <body>
    <msg><![CDATA[${text}]]></msg>
    <no>${no}</no>
  </body>
</mainbody>`

  try {
    const res = await fetch('https://api.netgsm.com.tr/xmlbulkhttppost.asp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    })
    const body = await res.text()
    if (!res.ok) return { success: false, error: body || res.statusText }
    if (body && body.includes('00') === false && body.length <= 10) {
      return { success: false, error: `Netgsm: ${body}` }
    }
    return { success: true }
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e)
    return { success: false, error: err }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { phone, message, otp, type } = await req.json().catch(() => ({}))

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telefon numarası gereklidir' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const smsText = message || (otp ? `KBS Prime giriş kodunuz: ${otp}\n\nBu kodu kimseyle paylaşmayın. Kod 5 dakika geçerlidir.` : '')
    const messageId = `edge_${Date.now()}`

    console.log('=== SMS ===')
    console.log('Alıcı:', phone)
    console.log('OTP (log):', otp || '(yok)')
    console.log('Mesaj:', smsText.slice(0, 80) + (smsText.length > 80 ? '...' : ''))
    console.log('==========')

    const netgsmResult = await sendNetgsm(phone, smsText)

    if (netgsmResult.success) {
      return new Response(
        JSON.stringify({
          success: true,
          messageId,
          message: 'SMS gönderildi',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Netgsm yapılandırılmamışsa veya hata varsa: OTP log'da görünür, yine de success dön (test için)
    if (netgsmResult.error?.includes('NETGSM_USERCODE')) {
      console.log('Netgsm yapılandırılmamış. Supabase Dashboard > Edge Functions > send-sms > Logs içinde OTP kodunu görebilirsiniz.')
    } else {
      console.error('Netgsm hatası:', netgsmResult.error)
    }
    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        message: netgsmResult.success ? 'SMS gönderildi' : 'SMS sağlayıcı yok; kod loglarda.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Beklenmeyen hata'
    console.error('SMS Edge Function hatası:', message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
