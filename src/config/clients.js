import { createClient } from '@supabase/supabase-js';
import { S3Client } from '@aws-sdk/client-s3';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

// --- Supabase ---
const supabaseUrlColectora = process.env.SUPABASE_URL_COLECTORA;
const supabaseKeyColectora = process.env.SUPABASE_KEY_COLECTORA;
export const supabaseColectora = createClient(supabaseUrlColectora, supabaseKeyColectora);

// --- Supabase Vida Deudor ---
const supabaseUrlVidaDeudor = process.env.SUPABASE_URL_VIDADEUDOR;
const supabaseKeyVidaDeudor = process.env.SUPABASE_KEY_VIDADEUDOR;
export const supabaseVidaDeudor = createClient(supabaseUrlVidaDeudor, supabaseKeyVidaDeudor);

// --- Supabase Coltefinanciera Recordatorios ---
const supabaseUrlColtefinancieraRecordatorios = process.env.SUPABASE_URL_COLTEFINANCIERA_RECORDATORIOS;
const supabaseKeyColtefinancieraRecordatorios = process.env.SUPABASE_KEY_COLTEFINANCIERA_RECORDATORIOS;
export const supabaseColtefinancieraRecordatorios = createClient(supabaseUrlColtefinancieraRecordatorios, supabaseKeyColtefinancieraRecordatorios);

// --- Supabase Call Center (log de transferencias) ---
const supabaseUrlCallCenter = process.env.SUPABASE_URL_CALL_CENTER;
const supabaseKeyCallCenter = process.env.SUPABASE_KEY_CALL_CENTER;
export const supabaseCallCenter = createClient(supabaseUrlCallCenter, supabaseKeyCallCenter);

// --- AWS S3 ---
export const s3 = new S3Client({
  region: process.env.AWS_REGION_COLECTORA || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_COLECTORA,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_COLECTORA,
  },
});

// --- Nodemailer (SendGrid) ---
export const transporterColectora = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.sendgrid.net',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'apikey',
    pass: process.env.SENDGRID_API_KEY_COLECTORA,
  },
});

export const transporterVidaDeudor = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.sendgrid.net',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'apikey',
    pass: process.env.SENDGRID_API_KEY_VIDADEUDOR,
  },
});

// --- Resend ---
import { RESEND_KEY } from './env.js';
export const resend = new Resend(RESEND_KEY);
