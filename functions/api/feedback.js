// Superchat feedback API — Pages Function
// In-memory store (persists within CF isolate lifetime, good for demo)
const feedback = [];

export async function onRequest(context) {
  const { request } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      feedback.push({
        text: (body.text || '').slice(0, 280),
        name: (body.name || 'Ghost').slice(0, 30),
        ts: Date.now(),
      });
      return Response.json({ ok: true, count: feedback.length }, { headers: cors });
    } catch {
      return Response.json({ error: 'bad json' }, { status: 400, headers: cors });
    }
  }

  // GET — return all feedback + stats
  const stats = {
    total: feedback.length,
    recent: feedback.slice(-50),
  };
  return Response.json(stats, { headers: cors });
}
