import { supabaseCallCenter } from '../config/clients.js';

/**
 * Registra un log de transferencia en el proyecto Supabase del call center.
 * Fire-and-forget: si falla, NO debe romper la transferencia (solo loguea el error).
 * @param {object} datos - Fila a insertar en cc_call_transfers. Requiere client_id.
 */
export async function registrarTransferencia(datos) {
  if (!datos.client_id) {
    console.warn('[Transferencia] Sin client_id — no se registra el log');
    return;
  }
  try {
    const { error } = await supabaseCallCenter.from('cc_call_transfers').insert([datos]);
    if (error) console.error('[Transferencia] Error guardando log:', error.message);
  } catch (e) {
    console.error('[Transferencia] Excepción guardando log:', e?.message || e);
  }
}
