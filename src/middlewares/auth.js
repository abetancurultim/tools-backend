import crypto from 'crypto';
import { ELEVENLABS_WEBHOOK_SECRET, ELEVENLABS_WEBHOOK_SECRET_COLTEFINANCIERA_RECORDATORIOS } from '../config/env.js';

export const protectRoute = (req, res, next) => {
  next();
};

export const verifyElevenLabsSignature = (req, res, next) => {
  const signature = req.headers['elevenlabs-signature'];
  console.log('[Auth] Verificando firma ElevenLabs...');
  console.log(`[Auth] Header 'elevenlabs-signature': ${signature}`);
  
  if (!signature) {
    console.warn('[Auth] Falta el header elevenlabs-signature');
    return res.status(401).json({ error: 'Missing signature header' });
  }

  if (!ELEVENLABS_WEBHOOK_SECRET) {
    console.error('[Auth] ELEVENLABS_WEBHOOK_SECRET is not defined in .env');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // El header viene formato: t=TIMESTAMP,v0=HASH
  // Estandar común (ej. Svix/Stripe): HMAC(secret, timestamp + "." + body)
  
  const tMatch = signature.match(/t=([0-9]+)/);
  const v0Match = signature.match(/v0=([a-f0-9]+)/);

  if (!tMatch || !v0Match) {
     console.error('[Auth] Formato de firma inválido (no se encontró t= o v0=)');
     return res.status(401).json({ error: 'Invalid signature format' });
  }

  const timestamp = tMatch[1];
  const receivedHash = v0Match[1];
  
  // Construir el payload a firmar: timestamp + "." + body
  // Nota: req.rawBody es un Buffer, lo convertimos a string para concatenar
  const signedPayload = `${timestamp}.${req.rawBody.toString()}`;

  const hmac = crypto.createHmac('sha256', ELEVENLABS_WEBHOOK_SECRET);
  const computedSignature = hmac.update(signedPayload).digest('hex');

  console.log(`[Auth] Timestamp: ${timestamp}`);
  console.log(`[Auth] Firma calculada (t + . + body): ${computedSignature}`);
  console.log(`[Auth] Hash recibido: ${receivedHash}`);

  if (receivedHash !== computedSignature) {
    console.error('[Auth] Error: Las firmas NO coinciden.');
    return res.status(401).json({ error: 'Invalid signature', expected: computedSignature, received: receivedHash });
  }

  console.log('[Auth] Firma válida. Procediendo...');
  next();
};

export const verifyElevenLabsSignatureColtefinanciera = (req, res, next) => {
  const signature = req.headers['elevenlabs-signature'];
  console.log('[Auth-Coltefinanciera] Verificando firma ElevenLabs...');
  console.log(`[Auth-Coltefinanciera] Header 'elevenlabs-signature': ${signature}`);
  
  if (!signature) {
    console.warn('[Auth-Coltefinanciera] Falta el header elevenlabs-signature');
    return res.status(401).json({ error: 'Missing signature header' });
  }

  if (!ELEVENLABS_WEBHOOK_SECRET_COLTEFINANCIERA_RECORDATORIOS) {
    console.error('[Auth-Coltefinanciera] ELEVENLABS_WEBHOOK_SECRET_COLTEFINANCIERA_RECORDATORIOS is not defined in .env');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // El header viene formato: t=TIMESTAMP,v0=HASH
  // Estandar común (ej. Svix/Stripe): HMAC(secret, timestamp + "." + body)
  
  const tMatch = signature.match(/t=([0-9]+)/);
  const v0Match = signature.match(/v0=([a-f0-9]+)/);

  if (!tMatch || !v0Match) {
     console.error('[Auth-Coltefinanciera] Formato de firma inválido (no se encontró t= o v0=)');
     return res.status(401).json({ error: 'Invalid signature format' });
  }

  const timestamp = tMatch[1];
  const receivedHash = v0Match[1];
  
  // Construir el payload a firmar: timestamp + "." + body
  // Nota: req.rawBody es un Buffer, lo convertimos a string para concatenar
  const signedPayload = `${timestamp}.${req.rawBody.toString()}`;

  const hmac = crypto.createHmac('sha256', ELEVENLABS_WEBHOOK_SECRET_COLTEFINANCIERA_RECORDATORIOS);
  const computedSignature = hmac.update(signedPayload).digest('hex');

  console.log(`[Auth-Coltefinanciera] Timestamp: ${timestamp}`);
  console.log(`[Auth-Coltefinanciera] Firma calculada (t + . + body): ${computedSignature}`);
  console.log(`[Auth-Coltefinanciera] Hash recibido: ${receivedHash}`);

  if (receivedHash !== computedSignature) {
    console.error('[Auth-Coltefinanciera] Error: Las firmas NO coinciden.');
    return res.status(401).json({ error: 'Invalid signature', expected: computedSignature, received: receivedHash });
  }

  console.log('[Auth-Coltefinanciera] Firma válida. Procediendo...');
  next();
};
