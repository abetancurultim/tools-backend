import { marcarAbogadoConAMD } from '../services/twilioService.js';
import { registrarTransferencia } from '../services/transferLogService.js';
import { obtenerDirectorio } from '../services/directorioService.js';
import { BASE_URL } from '../config/env.js';

// callSid (del abogado) -> { resolve, timer, leadCallSid, conferenceName, ...datos }
export const transferenciasPendientes = new Map();

// Si Twilio no entrega veredicto antes de esto, respondemos "no_disponible".
// Debe ser MENOR al timeout del webhook tool de ElevenLabs (máx 120s).
const TIMEOUT_VEREDICTO_MS = 110000;

/**
 * Server tool (síncrono) invocado por el agente de ElevenLabs.
 * Marca al abogado con AMD, ESPERA el veredicto y lo devuelve al agente.
 *   { resultado: 'conectado' }                    → abogado contestó; lead + abogado unidos en conferencia
 *   { resultado: 'no_disponible', motivo: '...' } → buzón / no contestó / timeout; el agente retoma
 */
export async function iniciarTransferencia(req, res) {
  const { numero_abogado, numero_lead, lead_call_sid, client_id, nombre_lead, telefono_lead, motivo } = req.body;

  if (!numero_abogado) {
    return res.status(400).json({ error: 'numero_abogado es requerido' });
  }

  let callSid = null;
  let conferenceName = null;

  try {
    const callbackUrl = `${BASE_URL}/webhooks/twilio-amd`;
    callSid = await marcarAbogadoConAMD({ numeroAbogado: numero_abogado, callbackUrl });
    conferenceName = `transfer-${callSid}`;

    console.log(`[Transferencia] Marcando al abogado — CallSid: ${callSid}, leadCallSid: ${lead_call_sid}`);

    // Espera el veredicto del AMD (lo resuelve el webhook de Twilio)
    const resultado = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        transferenciasPendientes.delete(callSid);
        console.warn(`[Transferencia] Timeout esperando veredicto — CallSid: ${callSid}`);
        resolve({ resultado: 'no_disponible', motivo: 'timeout' });
      }, TIMEOUT_VEREDICTO_MS);

      transferenciasPendientes.set(callSid, {
        resolve,
        timer,
        leadCallSid: lead_call_sid,
        conferenceName,
        nombre_lead,
        telefono_lead,
        motivo,
      });
    });

    // Registra el log (no bloquea ni rompe la transferencia si falla)
    registrarTransferencia({
      client_id,
      resultado: resultado.resultado,
      motivo_no_disponible: resultado.resultado === 'no_disponible' ? (resultado.motivo || null) : null,
      answered_by: resultado.answered_by || null,
      numero_abogado,
      numero_lead,
      telefono_lead,
      nombre_lead,
      motivo,
      lawyer_call_sid: callSid,
      lead_call_sid,
      conference_name: conferenceName,
    });

    const respuesta = { resultado: resultado.resultado, motivo: resultado.motivo };
    console.log(`[Transferencia] Respondiendo al agente: ${JSON.stringify(respuesta)}`);
    return res.status(200).json(respuesta);
  } catch (error) {
    console.error('Error iniciando transferencia:', error);
    registrarTransferencia({
      client_id,
      resultado: 'no_disponible',
      motivo_no_disponible: 'error_interno',
      numero_abogado,
      numero_lead,
      telefono_lead,
      nombre_lead,
      motivo,
      lead_call_sid,
      lawyer_call_sid: callSid,
      conference_name: conferenceName,
    });
    return res.status(500).json({ resultado: 'no_disponible', motivo: 'error_interno' });
  }
}

/**
 * Server tool invocado por el agente ANTES de transferir.
 * Devuelve el directorio de abogados por servicio del cliente para que el LLM elija
 * a qué número transferir según la necesidad del cliente.
 */
export async function consultarDirectorio(req, res) {
  const { client_id } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id es requerido' });

  try {
    const servicios = await obtenerDirectorio(client_id);
    return res.status(200).json({ servicios });
  } catch (error) {
    console.error('Error consultando directorio:', error);
    return res.status(500).json({ error: 'Error consultando el directorio' });
  }
}
