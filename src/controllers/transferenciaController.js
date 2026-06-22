import { marcarAbogadoConAMD } from '../services/twilioService.js';
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
  const { numero_abogado, lead_call_sid, nombre_lead, telefono_lead, motivo } = req.body;

  if (!numero_abogado) {
    return res.status(400).json({ error: 'numero_abogado es requerido' });
  }

  try {
    const callbackUrl = `${BASE_URL}/webhooks/twilio-amd`;
    const callSid = await marcarAbogadoConAMD({ numeroAbogado: numero_abogado, callbackUrl });
    const conferenceName = `transfer-${callSid}`;

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

    console.log(`[Transferencia] Respondiendo al agente: ${JSON.stringify(resultado)}`);
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('Error iniciando transferencia:', error);
    return res.status(500).json({ resultado: 'no_disponible', motivo: 'error_interno' });
  }
}
