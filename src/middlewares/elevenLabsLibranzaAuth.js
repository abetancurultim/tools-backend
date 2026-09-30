import crypto from 'node:crypto';

export function requireElevenLabsLibranzaKey(req, res, next) {
  const expected = process.env.ELEVENLABS_LIBRANZA_API_KEY;
  if (!expected) return res.status(503).json({ success: false, error: 'Herramienta de libranza sin configurar' });

  const supplied = req.get('x-elevenlabs-libranza-key') || '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }
  next();
}
