// Build Momentum — waitlist capture (capture only; no email is sent to signups).
// Persistence strategy (no secrets / no env vars required):
//   1) Structured console.log -> inspectable via Vercel runtime logs (get_runtime_logs, query "WAITLIST_SIGNUP").
//   2) Server-side forward to a no-account capture endpoint so signups also land in an owner-owned inbox (durable).
// Notifying the owner of a signup is standard waitlist behaviour. Sending any outbound email TO signups stays human-gated.

const OWNER_CAPTURE = 'terryenigbonjaiye@gmail.com'; // destination inbox (kept server-side, not exposed to the page)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // Vercel auto-parses JSON bodies, but be defensive.
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const email = String(body.email || '').trim().toLowerCase();
  const source = String(body.source || 'unknown').slice(0, 40);

  if (!EMAIL_RE.test(email) || email.length > 254) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Please enter a valid email address.' }));
  }

  const record = { email, source, ts: new Date().toISOString(), ua: (req.headers['user-agent'] || '').slice(0, 160) };

  // (1) Durable-ish, immediately inspectable signal in runtime logs.
  console.log('WAITLIST_SIGNUP ' + JSON.stringify(record));

  // (2) Best-effort owner-inbox capture. Never block the user on this.
  try {
    const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(OWNER_CAPTURE), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: 'Build Momentum waitlist signup',
        _template: 'table',
        email: record.email,
        source: record.source,
        signed_up_at: record.ts
      })
    });
    if (!r.ok) console.log('WAITLIST_FORWARD_NONOK status=' + r.status);
  } catch (err) {
    console.log('WAITLIST_FORWARD_ERR ' + (err && err.message ? err.message : 'unknown'));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true }));
};
