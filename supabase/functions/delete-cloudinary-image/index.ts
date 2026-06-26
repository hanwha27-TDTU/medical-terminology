const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha1Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { publicId } = await req.json();
    const normalizedPublicId = String(publicId || '').trim();
    if (!normalizedPublicId) {
      return jsonResponse({ ok: false, error: 'publicId is required' }, 400);
    }

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME') || '';
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY') || '';
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET') || '';
    if (!cloudName || !apiKey || !apiSecret) {
      console.error('Cloudinary env missing', {
        hasCloudName: Boolean(cloudName),
        hasApiKey: Boolean(apiKey),
        hasApiSecret: Boolean(apiSecret),
      });

      return jsonResponse(
        {
          ok: false,
          error: 'Cloudinary environment variables are missing',
          hasCloudName: Boolean(cloudName),
          hasApiKey: Boolean(apiKey),
          hasApiSecret: Boolean(apiSecret),
        },
        500
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await sha1Hex(`invalidate=true&public_id=${normalizedPublicId}&timestamp=${timestamp}${apiSecret}`);
    const params = new URLSearchParams({
      public_id: normalizedPublicId,
      api_key: apiKey,
      timestamp,
      signature,
      invalidate: 'true',
    });

    const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const result = await cloudinaryRes.json().catch(() => ({}));
    const cloudinaryOk = cloudinaryRes.ok && (result.result === 'ok' || result.result === 'not found');
    if (!cloudinaryOk) {
      console.error('Cloudinary destroy failed', {
        publicId: normalizedPublicId,
        status: cloudinaryRes.status,
        statusText: cloudinaryRes.statusText,
        result,
      });
    }

    return jsonResponse(
      {
        ok: cloudinaryOk,
        publicId: normalizedPublicId,
        cloudinaryStatus: cloudinaryRes.status,
        cloudinaryStatusText: cloudinaryRes.statusText,
        result,
      },
      cloudinaryOk ? 200 : 502
    );
  } catch (error) {
    console.error('delete-cloudinary-image failed', error);
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
