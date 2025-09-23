// netlify/functions/gitlab.js
export async function handler(event) {
  try {
    const envToken = process.env.GITLAB_TOKEN; // defina no Netlify (read_api)
    if (!envToken) {
      return json(500, { error: 'Missing GITLAB_TOKEN on server' });
    }

    const qp = event.multiValueQueryStringParameters || event.queryStringParameters || {};
    const path = (qp.path || '').toString();
    if (!path.startsWith('/')) {
      return json(400, { error: 'Query param "path" must start with /api v4 path' });
    }

    // Reconstrói QS completo (além de path)
    const { path: _drop, ...rest } = qp;
    const qs = new URLSearchParams();

    // multiValueQueryStringParameters pode ter arrays; normaliza:
    for (const k of Object.keys(rest)) {
      const v = rest[k];
      if (Array.isArray(v)) v.forEach(x => qs.append(k, x));
      else if (v != null)    qs.append(k, v);
    }

    const base = `https://gitlab.com/api/v4${path}`;
    const url  = qs.toString()
      ? `${base}${path.includes('?') ? '&' : '?'}${qs.toString()}`
      : base;

    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'PRIVATE-TOKEN': envToken
      }
    });

    const bodyText = await r.text();
    return {
      statusCode: r.status,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: bodyText
    };
  } catch (err) {
    return json(502, { error: 'Proxy failed', detail: String(err) });
  }
}

function json(status, obj) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
