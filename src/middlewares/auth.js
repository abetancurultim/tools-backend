import crypto from 'crypto';
import { API_KEY, ELEVENLABS_WEBHOOK_SECRET } from '../config/env.js';

export const protectRoute = (req, res, next) => {
  const apiKeyHeader = req.headers['x-api-key'];

  if (!apiKeyHeader || apiKeyHeader !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized access' });
  }
  next();
};

export const verifyElevenLabsSignature = (req, res, next) => {
  const signature = req.headers['x-elevenlabs-signature-256'];
  
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  if (!ELEVENLABS_WEBHOOK_SECRET) {
    console.error('ELEVENLABS_WEBHOOK_SECRET is not defined');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const hmac = crypto.createHmac('sha256', ELEVENLABS_WEBHOOK_SECRET);
  const computedSignature = hmac.update(req.rawBody).digest('hex');

  if (signature !== computedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};
