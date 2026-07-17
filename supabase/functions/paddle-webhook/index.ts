import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PADDLE_WEBHOOK_SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Same live price IDs as src/environments/environment.prod.ts
interface PerkGrant {
  key: string;            // product_type recorded on the purchase row
  clicks?: number;        // extra clicks per unit
  unlimitedHours?: number;
  golden?: boolean;
  diamond?: boolean;
  badge?: boolean;
  eggName?: boolean;      // grant the buyer's display name on the egg
}

const PRICE_GRANTS: Record<string, PerkGrant> = {
  pri_01knkm1txrj4apeh0tcx4m0p7f: { key: 'clicks10', clicks: 10 },
  pri_01knkm331exk8fjyc7hgwbndrd: { key: 'clicks100', clicks: 100 },
  pri_01knkm48htnz5qjxr3w1ds0j6w: { key: 'unlimited24h', unlimitedHours: 24 },
  pri_01knkm506r192ejfp1gajq67aw: { key: 'unlimitedMonth', unlimitedHours: 24 * 30 },
  pri_01knkm5je3xarr8crc5fbtamka: { key: 'nameOnEgg', eggName: true },
  pri_01kpqk5ccxs3yreysrv53m0pf5: { key: 'goldenCursor', golden: true },
  pri_01kpqk6zz6kgh2vepepk59aqwz: { key: 'crackBadge', badge: true },
  pri_01kpqk8t53a836f29bnp3rpwce: { key: 'diamondSkin', diamond: true },
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();

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

  const transactionId: string = data.id;
  const customerId: string | null = data.customer_id ?? null;
  const customData = data.custom_data ?? {};
  // paddle.service.ts sends { userId } (camelCase)
  const userId: string | null = customData.userId ?? customData.user_id ?? null;

  const items: any[] = data.items ?? [];
  const firstGrant = PRICE_GRANTS[items[0]?.price?.id ?? ''];

  // Atomic dedupe: transaction_id is UNIQUE, so a Paddle retry inserts nothing
  const { data: inserted, error: insertError } = await supabase
    .from('purchases')
    .upsert(
      {
        transaction_id: transactionId,
        user_id: userId,
        paddle_customer_id: customerId,
        product_type: firstGrant?.key ?? (items[0]?.price?.id ?? 'unknown'),
        price_id: items[0]?.price?.id ?? '',
        quantity: items[0]?.quantity ?? 1,
        status: 'completed',
      },
      { onConflict: 'transaction_id', ignoreDuplicates: true },
    )
    .select('id');

  if (insertError) {
    console.error('purchase insert failed:', insertError.message);
    return new Response('Insert failed', { status: 500 });
  }
  if (!inserted || inserted.length === 0) {
    return new Response('Already processed', { status: 200 });
  }

  if (!userId) {
    // Purchase recorded, but no account to credit (shouldn't happen — store requires sign-in)
    console.warn('transaction without userId:', transactionId);
    return new Response('OK', { status: 200 });
  }

  // Aggregate all items into one credit
  let addClicks = 0;
  let unlimitedHours = 0;
  let golden = false, diamond = false, badge = false, wantsEggName = false;

  for (const item of items) {
    const grant = PRICE_GRANTS[item.price?.id ?? ''];
    if (!grant) continue;
    const qty: number = item.quantity ?? 1;
    if (grant.clicks) addClicks += grant.clicks * qty;
    if (grant.unlimitedHours) unlimitedHours += grant.unlimitedHours * qty;
    golden ||= !!grant.golden;
    diamond ||= !!grant.diamond;
    badge ||= !!grant.badge;
    wantsEggName ||= !!grant.eggName;
  }

  let eggName: string | null = null;
  if (wantsEggName) {
    const { data: userRow } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    eggName = userRow?.display_name ?? 'Anonymous Cracker';
  }

  const { error: creditError } = await supabase.rpc('credit_purchase', {
    uid: userId,
    add_clicks: addClicks,
    unlimited_hours: unlimitedHours,
    set_golden: golden,
    set_diamond: diamond,
    set_badge: badge,
    new_egg_name: eggName,
  });

  if (creditError) {
    // Non-200 makes Paddle retry; the purchases upsert dedupes the retry, so
    // delete our marker row first to let the retry re-credit
    console.error('credit_purchase failed:', creditError.message);
    await supabase.from('purchases').delete().eq('transaction_id', transactionId);
    return new Response('Credit failed', { status: 500 });
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

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${ts}:${rawBody}`));
    const computed = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison
    if (computed.length !== h1.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed.charCodeAt(i) ^ h1.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}
