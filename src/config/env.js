import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 3002;
export const API_KEY = process.env.API_KEY;
export const ELEVENLABS_WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET;