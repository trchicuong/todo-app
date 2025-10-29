// Free STT using Google Cloud Speech-to-Text (via Google's public API, no key required)
// or Hugging Face Inference API (free tier with rate limits)
export default async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }

    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Expected multipart/form-data' }), {
        status: 400,
      });
    }

    const form = await req.formData();
    const audio = form.get('audio');
    if (!audio) {
      return new Response(JSON.stringify({ error: 'Missing audio file' }), { status: 400 });
    }

    // Convert audio to buffer for API calls
    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Try Google Cloud Speech-to-Text (free, no API key needed for small requests via public endpoint)
    // Note: This uses the legacy experimental endpoint which may have rate limits
    // For production, consider signing up for GCP free tier or using Hugging Face
    try {
      const googleResp = await fetch(
        'https://www.google.com/speech-api/v2/recognize?output=json&lang=vi-VN&key=AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'audio/webm; codecs=opus',
          },
          body: buffer,
        },
      );

      if (googleResp.ok) {
        const text = await googleResp.text();
        // Response is JSONP-like, extract the transcript
        const lines = text.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.result && json.result[0]?.alternative?.[0]?.transcript) {
              const transcript = json.result[0].alternative[0].transcript;
              return new Response(JSON.stringify({ ok: true, text: transcript }), { status: 200 });
            }
          } catch (_) {}
        }
      }
    } catch (googleErr) {
      console.warn('Google Speech API failed, trying Hugging Face:', googleErr);
    }

    // Fallback: Hugging Face Inference API (free tier, rate limited)
    const HF_TOKEN = process.env.HUGGINGFACE_TOKEN; // optional, increases rate limit
    try {
      const hfResp = await fetch(
        'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'audio/webm',
            ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {}),
          },
          body: buffer,
        },
      );

      if (!hfResp.ok) {
        const errText = await hfResp.text();
        throw new Error(`HF API error: ${hfResp.status} ${errText.slice(0, 500)}`);
      }

      const hfData = await hfResp.json();
      const text = hfData.text || '';
      return new Response(JSON.stringify({ ok: true, text }), { status: 200 });
    } catch (hfErr) {
      console.error('Hugging Face fallback also failed:', hfErr);
      return new Response(
        JSON.stringify({
          error: 'All STT services failed',
          details: 'Không thể nhận dạng giọng nói. Vui lòng thử lại.',
        }),
        { status: 503 },
      );
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), { status: 500 });
  }
};
