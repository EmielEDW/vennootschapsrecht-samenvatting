// Stripe webhook handler: on successful checkout, pop a fresh code from the
// Upstash 'unused-codes' list and email it to the buyer via Resend.
//
// Endpoint: POST /api/stripe-webhook (configure in Stripe dashboard)
// Listens for: checkout.session.completed
//
// Required env vars:
//   STRIPE_WEBHOOK_SECRET — from Stripe Dashboard → Webhooks → "Signing secret"
//   RESEND_API_KEY        — from resend.com (free 100 mails/day)
//   FROM_EMAIL            — e.g. "Examen-pack <onboarding@resend.dev>"
//   SITE_URL              — e.g. "https://vennootschapsrecht-samenvatting.vercel.app"
//   KV_REST_API_URL, KV_REST_API_TOKEN — for the code pool
//
// IMPORTANT: this endpoint disables Vercel's body parser because Stripe needs
// the raw body to verify the signature.

const { createHmac } = require('crypto');

// Disable Vercel's default JSON body parser — we need the raw body
module.exports.config = {
  api: { bodyParser: false },
};

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Examen-pack <onboarding@resend.dev>';
const REPLY_TO = process.env.REPLY_TO_EMAIL || 'emieldewaele@gmail.com';
const SITE_URL = process.env.SITE_URL || 'https://vennootschapsrecht-samenvatting.vercel.app';
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const POOL_KEY = process.env.UNUSED_CODES_KEY || 'unused-codes';

// === Helpers ===
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Verify Stripe signature header per https://stripe.com/docs/webhooks/signatures
function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  if (!header) return false;
  const parts = header.split(',').reduce((acc, p) => {
    const [k, v] = p.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const age = Math.abs(Date.now() / 1000 - parseInt(t, 10));
  if (age > toleranceSec) return false;
  const signed = `${t}.${rawBody.toString('utf8')}`;
  const expected = createHmac('sha256', secret).update(signed).digest('hex');
  // Constant-time comparison
  if (expected.length !== v1.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return mismatch === 0;
}

async function kvCmd(args) {
  // Generic Upstash REST command via pipeline-style path
  // e.g. ['LPOP', 'unused-codes']  →  POST {URL}/LPOP/unused-codes
  if (!KV_URL || !KV_TOKEN) return null;
  const path = args.map(encodeURIComponent).join('/');
  const r = await fetch(`${KV_URL}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!r.ok) {
    console.error('KV cmd failed:', args, r.status);
    return null;
  }
  const data = await r.json();
  return data.result === undefined ? null : data.result;
}

async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set — email NOT sent');
    return { ok: false, error: 'no-api-key' };
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
        text,
        reply_to: replyTo || REPLY_TO,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('Resend error:', r.status, data);
      return { ok: false, error: data };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    console.error('Email fetch error:', e);
    return { ok: false, error: String(e) };
  }
}

function buildEmail(code, customerName) {
  const greeting = customerName ? `Hey ${customerName},` : 'Hey,';
  const unlockUrl = `${SITE_URL}/?code=${encodeURIComponent(code)}`;
  const html = `<!DOCTYPE html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #fbfaf7; padding: 20px; color: #1a1a1a;">
  <div style="max-width: 540px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
    <h1 style="font-family: Lora, Georgia, serif; color: #6b1f2b; font-size: 24px; margin: 0 0 16px;">Bedankt voor je aankoop! 🎉</h1>
    <p style="font-size: 16px; line-height: 1.6;">${greeting}</p>
    <p style="font-size: 16px; line-height: 1.6;">Hier is je persoonlijke toegangscode voor het <strong>Examen-pack Vennootschapsrecht</strong>:</p>
    <div style="background: linear-gradient(135deg, #f3e6e8, #fbfaf7); border: 2px solid #6b1f2b; padding: 20px; border-radius: 10px; text-align: center; margin: 24px 0;">
      <div style="font-family: 'JetBrains Mono', Menlo, monospace; font-size: 28px; font-weight: 700; color: #6b1f2b; letter-spacing: 4px;">${code}</div>
    </div>
    <p style="font-size: 16px; line-height: 1.6;">Of klik gewoon op deze link om alles automatisch te ontgrendelen:</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${unlockUrl}" style="display: inline-block; background: #6b1f2b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Open en activeer mijn pack →</a>
    </p>
    <p style="font-size: 14px; color: #666; line-height: 1.5;">Je code werkt op max 3 apparaten (laptop + telefoon + tablet bv.). Limit bereikt? Antwoord op deze mail.</p>
    <p style="font-size: 16px; line-height: 1.6; margin-top: 24px;">Succes met studeren! 📚<br>— Emiel</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="font-size: 12px; color: #999; line-height: 1.4;">Vragen of problemen? Antwoord gewoon op deze mail. Site: <a href="${SITE_URL}" style="color: #6b1f2b;">${SITE_URL.replace('https://', '')}</a></p>
  </div>
</body></html>`;
  const text = `${greeting}

Bedankt voor je aankoop! Hier is je code voor het Examen-pack Vennootschapsrecht:

    ${code}

Of klik direct: ${unlockUrl}

Je code werkt op max 3 apparaten. Limit bereikt? Antwoord op deze mail.

Succes met studeren!
— Emiel`;
  return { html, text };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (e) {
    return res.status(400).json({ error: 'Could not read body' });
  }

  // Verify Stripe signature
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured!');
    return res.status(500).json({ error: 'Webhook secret missing' });
  }
  const sigHeader = req.headers['stripe-signature'];
  if (!verifyStripeSignature(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET)) {
    console.error('Invalid Stripe signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Parse the event
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // We only care about successful checkouts
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ ok: true, ignored: event.type });
  }

  const session = event.data && event.data.object;
  if (!session) {
    return res.status(400).json({ error: 'Missing session object' });
  }

  // Pull email from session
  const customerEmail =
    session.customer_email ||
    (session.customer_details && session.customer_details.email);
  const customerName = session.customer_details && session.customer_details.name;

  if (!customerEmail) {
    console.error('No customer email in session', session.id);
    // Log to KV so Emiel can chase manually
    await kvCmd(['SET', `failed-no-email:${session.id}`, JSON.stringify({ ts: Date.now(), session: session.id })]);
    return res.status(200).json({ ok: true, warning: 'no-email' });
  }

  // Idempotency: did we already process this session?
  const dedupKey = `processed:${session.id}`;
  const already = await kvCmd(['GET', dedupKey]);
  if (already) {
    return res.status(200).json({ ok: true, idempotent: true });
  }

  // Pop a code from the pool
  const code = await kvCmd(['LPOP', POOL_KEY]);
  if (!code) {
    console.error('Code pool is EMPTY! Session:', session.id, 'Email:', customerEmail);
    // Tell Emiel via fallback email
    await sendEmail({
      to: REPLY_TO,
      subject: '⚠ Examen-pack code pool LEEG',
      html: `<p>Een betaling kwam binnen maar er zijn geen codes meer in de pool.</p>
             <p>Customer: <strong>${customerEmail}</strong> (${customerName || 'geen naam'})</p>
             <p>Session: ${session.id}</p>
             <p>Refill de pool en stuur de koper handmatig een code.</p>`,
      text: `Code pool LEEG! Customer ${customerEmail} betaalde, geen code beschikbaar. Session ${session.id}.`,
    });
    // Log so we don't lose this
    await kvCmd(['SET', `failed-no-code:${session.id}`, JSON.stringify({ ts: Date.now(), email: customerEmail, name: customerName })]);
    // Return 200 to Stripe (they will not retry, we'll handle manually)
    return res.status(200).json({ ok: false, error: 'no-codes-left' });
  }

  // Send the code to the buyer
  const { html, text } = buildEmail(code, customerName);
  const emailResult = await sendEmail({
    to: customerEmail,
    subject: '🎉 Je Examen-pack toegangscode',
    html,
    text,
  });

  if (!emailResult.ok) {
    // Put the code back at the front of the list (so the next attempt or
    // manual retry can use it) and alert Emiel.
    await kvCmd(['LPUSH', POOL_KEY, code]);
    await sendEmail({
      to: REPLY_TO,
      subject: '⚠ Examen-pack email failed',
      html: `<p>Stripe-betaling ontvangen maar email kon niet verzonden worden.</p>
             <p>Customer: <strong>${customerEmail}</strong></p>
             <p>Code (manueel sturen): <strong>${code}</strong></p>
             <p>Session: ${session.id}</p>
             <p>Fout: <pre>${JSON.stringify(emailResult.error)}</pre></p>`,
      text: `Email failed for ${customerEmail}. Code to send manually: ${code}. Session ${session.id}.`,
    });
    return res.status(200).json({ ok: false, error: 'email-failed' });
  }

  // Mark this session as processed (90-day TTL)
  await kvCmd(['SET', dedupKey, JSON.stringify({ code, email: customerEmail, ts: Date.now() }), 'EX', '7776000']);

  // Record code → buyer (for audit / refunds)
  await kvCmd(['SET', `sold:${code}`, JSON.stringify({ email: customerEmail, name: customerName, session: session.id, ts: Date.now() })]);

  console.log(`✓ Sent code ${code} to ${customerEmail}`);
  return res.status(200).json({ ok: true, code: code.slice(0, 3) + '***' });
};
