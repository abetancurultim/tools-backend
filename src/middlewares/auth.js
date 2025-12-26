import { API_KEY } from '../config/env.js';

export const protectRoute = (req, res, next) => {
  const apiKeyHeader = req.headers['x-api-key'];

  if (!apiKeyHeader || apiKeyHeader !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized access' });
  }
  next();
};
