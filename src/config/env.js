import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 3002;
export const API_KEY = process.env.API_KEY;
export const ELEVENLABS_WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET;
export const ELEVENLABS_WEBHOOK_SECRET_COLTEFINANCIERA_RECORDATORIOS = process.env.ELEVENLABS_WEBHOOK_SECRET_COLTEFINANCIERA_RECORDATORIOS;

// Supabase Coltefinanciera Recordatorios
export const SUPABASE_URL_COLTEFINANCIERA_RECORDATORIOS = process.env.SUPABASE_URL_COLTEFINANCIERA_RECORDATORIOS;
export const SUPABASE_KEY_COLTEFINANCIERA_RECORDATORIOS = process.env.SUPABASE_KEY_COLTEFINANCIERA_RECORDATORIOS;

// Adminfo
export const ADMINFO_USER = process.env.ADMINFO_USER || 'api_coltefinanciera_pdn';
export const ADMINFO_PASS = process.env.ADMINFO_PASS || '@cC3$04P1-c0lt3_10g2q0p0m5*';
export const ADMINFO_URL = process.env.ADMINFO_URL || 'https://api.adminfo.net';