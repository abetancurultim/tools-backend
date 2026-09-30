import { createClient } from '@supabase/supabase-js';

let client;
function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL_VIDADEUDOR;
    const key = process.env.SUPABASE_SERVICE_ROLE_VIDADEUDOR;
    if (!url || !key) throw new Error('Falta la URL de VIDA DEUDOR o la clave de servidor para libranzas ElevenLabs');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

const TABLE = 'elevenlabs_libranza_sessions';

export async function getSession(conversationId) {
  const { data, error } = await db().from(TABLE).select('*').eq('conversation_id', conversationId).maybeSingle();
  if (error) throw new Error(`No se pudo consultar la sesión: ${error.message}`);
  return data;
}

export async function insertSession(session) {
  const { data, error } = await db().from(TABLE).insert(session).select().single();
  if (error?.code === '23505') return { row: await getSession(session.conversation_id), created: false };
  if (error) throw new Error(`No se pudo crear la sesión: ${error.message}`);
  return { row: data, created: true };
}

export async function transitionSession(conversationId, expectedStatus, changes) {
  const { data, error } = await db().from(TABLE)
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('status', expectedStatus)
    .select().maybeSingle();
  if (error) throw new Error(`No se pudo actualizar la sesión: ${error.message}`);
  return data;
}

export async function nextLibranzaNumber() {
  // Se usa el MISMO contador de WhatsApp, en el mismo proyecto Supabase.
  const { data, error } = await db().rpc('increment_libranza_counter');
  if (error) throw new Error(`No se pudo asignar número de libranza: ${error.message}`);
  return String(data).padStart(7, '0');
}
