/**
 * Same-origin proxy for DTF gang-sheet artwork (GCS / design API).
 * Lets the studio load remote images into canvas without CORS taint.
 *
 * GET /api/dtf-image-proxy?url=<https encoded url>
 *
 * @param {Route.LoaderArgs} args
 */
export async function loader({request}) {
  const incoming = new URL(request.url);
  const target = incoming.searchParams.get('url');
  if (!target) {
    return new Response('Missing url', {status: 400});
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('Invalid url', {status: 400});
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return new Response('Unsupported protocol', {status: 400});
  }

  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === 'storage.googleapis.com' ||
    host.endsWith('.storage.googleapis.com') ||
    host.endsWith('.googleapis.com') ||
    host.endsWith('.googleusercontent.com') ||
    host.endsWith('.cloudfunctions.net') ||
    host.endsWith('.run.app') ||
    host.endsWith('.appspot.com');

  if (!allowed) {
    return new Response('Host not allowed', {status: 403});
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      headers: {Accept: 'image/*,*/*'},
    });
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, {
        status: upstream.status === 404 ? 404 : 502,
      });
    }

    const contentType = upstream.headers.get('content-type') || 'image/png';
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    console.error('[dtf-image-proxy]', e);
    return new Response('Proxy fetch failed', {status: 502});
  }
}

/** @typedef {import('./+types/api.dtf-image-proxy').Route} Route */
