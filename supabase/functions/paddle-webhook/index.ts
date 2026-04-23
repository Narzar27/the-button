import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PADDLE_WEBHOOK_SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Click amounts per price ID (-1 = unlimited24h, -2 = unlimitedMonth, handled client-side)
const CLICK_GRANTS: Record<string, number> = {
  pri_01knkm1txrj4apeh0tcx4m0p7f: 10,   // clicks10
  pri_01knkm331exk8fjyc7hgwbndrd: 100,  // clicks100
  pri_01knkm48htnz5qjxr3w1ds0j6w: -1,   // unlimited24h
  pri_01knkm506r192ejfp1gajq67aw: -2,   // unlimitedMonth
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();

  // Verify Paddle signature
  const signatureHeader = req.headers.get('paddle-signature');
  if (!signatureHeader || !PADDLE_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const isValid = await verifyPaddleSignature(rawBody, signatureHeader, PADDLE_WEBHOOK_SECRET);
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const { event_type, data } = event;

  if (event_type !== 'transaction.completed') {
    return new Response('OK', { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const transactionId = data.id;
  const customerId = data.customer_id;
  const customData = data.custom_data ?? {};
  // paddle.service.ts sends { userId } (camelCase)
  const userId: string | null = customData.userId ?? customData.user_id ?? null;

  // Deduplicate: skip if we already processed this transaction
  const { data: existing } = await supabase
    .from('purchases')
    .select('id')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (existing) {
    return new Response('Already processed', { status: 200 });
  }

  const items: any[] = data.items ?? [];

  for (const item of items) {
    const priceId: string = item.price?.id ?? '';
    const quantity: number = item.quantity ?? 1;
    const clickGrant = CLICK_GRANTS[priceId];

    await supabase.from('purchases').insert({
      transaction_id: transactionId,
      user_id: userId,
      paddle_customer_id: customerId,
      price_id: priceId,
      quantity,
      status: 'completed',
    });

    if (userId && clickGrant !== undefined) {
      if (clickGrant > 0) {
        const totalClicks = clickGrant * quantity;
        await supabase.rpc('add_extra_clicks', { uid: userId, amount: totalClicks });
      }
      // unlimited24h and unlimitedMonth are handled client-side via purchase record lookup
    }
  }

  return new Response('OK', { status: 200 });
});

async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    // Header format: ts=1234567890;h1=abc123...
    const parts = Object.fromEntries(
      signatureHeader.split(';').map(p => p.split('=') as [string, string])
    );
    const ts = parts['ts'];
    const h1 = parts['h1'];
    if (!ts || !h1) return false;

    const payload = `${ts}:${rawBody}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const computed = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return computed === h1;
  } catch {
    return false;
  }
}
