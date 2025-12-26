import { createClient } from '@supabase/supabase-js';
import AWS from 'aws-sdk';
import nodemailer from 'nodemailer';
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

// --- AWS S3 ---
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID_COLECTORA,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_COLECTORA,
  region: process.env.AWS_REGION_COLECTORA || 'us-east-1',
});
export const s3 = new AWS.S3();

// --- Nodemailer (SendGrid) ---
export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.sendgrid.net',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'apikey',
    pass: process.env.SENDGRID_API_KEY_COLECTORA,
  },
});