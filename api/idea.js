// POST /api/idea — the contact receipt's order form.
// Files each order as an issue in a private GitHub repo.
// Env (Vercel project settings): IDEAS_GITHUB_TOKEN (fine-grained token, Issues: read/write on
// that one repo only) and IDEAS_REPO ("owner/name"). Without them the endpoint answers 503.
// Stores nothing itself; the visitor's IP is used only for an in-memory rate limit.

const KINDS = { idea: 'Idea', question: 'Question', bug: 'Bug', snack: 'Snack tip' };
const LIMIT = 5;                 // orders per IP per window (best effort, per instance)
const WINDOW_MS = 10 * 60 * 1000;
const MIN_ELAPSED_MS = 2500;     // faster than this from page load = bot
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > LIMIT;
}

function reply(req, res, status, body) {
  const html = (req.headers.accept || '').includes('text/html') &&
    !(req.headers['content-type'] || '').includes('application/json');
  if (html) {
    // No-JS form post: go back to the receipt.
    res.statusCode = 303;
    res.setHeader('Location', status === 200 ? '/?order=sent#contact' : '/?order=failed#contact');
    return res.end();
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function fence(text) {
  return '```text\n' + text.replace(/```/g, "'''") + '\n```';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(req, res, 405, { error: 'method' });
  }
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (e) { /* bad origin */ }
    if (host !== req.headers.host) return reply(req, res, 403, { error: 'origin' });
  }

  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const kind = KINDS[b.kind] ? b.kind : 'idea';
  const message = String(b.message || '').trim().slice(0, 2000);
  const contact = String(b.contact || '').trim().slice(0, 200);
  const lang = b.lang === 'ko' ? 'ko' : 'en';
  const elapsed = Number(b.elapsed);

  // Honeypot or instant submit: pretend success, file nothing.
  if (b.website || (Number.isFinite(elapsed) && elapsed > 0 && elapsed < MIN_ELAPSED_MS)) {
    return reply(req, res, 200, { ok: true });
  }
  if (message.length < 5) return reply(req, res, 400, { error: 'message' });
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return reply(req, res, 400, { error: 'contact' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return reply(req, res, 429, { error: 'rate' });

  const token = process.env.IDEAS_GITHUB_TOKEN;
  const repo = process.env.IDEAS_REPO;
  if (!token || !repo) return reply(req, res, 503, { error: 'not_configured' });

  const firstLine = message.split('\n')[0].replace(/\s+/g, ' ').slice(0, 60);
  const body = [
    fence(message),
    '',
    '| | |',
    '|---|---|',
    '| Type | ' + KINDS[kind] + ' |',
    '| Reply to | ' + (contact ? contact.replace(/\|/g, '') : '—') + ' |',
    '| Site language | ' + lang + ' |',
    '',
    '_Sent from the order form on fridaysnack.vercel.app_'
  ].join('\n');

  try {
    const gh = await fetch('https://api.github.com/repos/' + repo + '/issues', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'fridaysnack-site',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: '[' + KINDS[kind] + '] ' + firstLine, body: body, labels: [kind] })
    });
    if (!gh.ok) return reply(req, res, 502, { error: 'upstream' });
    return reply(req, res, 200, { ok: true });
  } catch (e) {
    return reply(req, res, 502, { error: 'upstream' });
  }
};
