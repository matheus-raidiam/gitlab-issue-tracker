// netlify/functions/gitlab.js
export async function handler(event) {
  const token = process.env.GITLAB_TOKEN; // defina no painel do Netlify
  const path  = event.queryStringParameters.path || '';
  if (!path.startsWith('/')) return resp(400, { error: 'missing /path' });

  const url = `https://gitlab.com/api/v4${path}`;
  const r = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      // PAT de servidor — seguro, não exposto ao cliente:
      'PRIVATE-TOKEN': token
    }
  });

  const body = await r.text();
  return {
    statusCode: r.status,
    headers: {
      'Content-Type': r.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',               // seu front consegue chamar
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body
  };
}

function resp(code, obj) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
