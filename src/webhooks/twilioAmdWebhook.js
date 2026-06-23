import { transferenciasPendientes } from '../controllers/transferenciaController.js';
import { moverAConferencia, colgarLlamada } from '../services/twilioService.js';

// Margen para que el agente diga su frase antes de mover las patas a la conferencia.
const DELAY_BRIDGE_MS = 2500;

/**
 * Webhook de Twilio. Recibe el veredicto del AMD (asyncAmdStatusCallback) y el
 * evento `completed`. Resuelve la petición del tool de ElevenLabs:
 *   - Humano  → une lead + abogado en conferencia, devuelve "conectado"
 *   - Buzón / no contestó → cuelga la pata del abogado, devuelve "no_disponible"
 */
export async function recibirResultadoAMD(req, res) {
  const { CallSid, AnsweredBy, CallStatus } = req.body;
  console.log(`AMD resultado — CallSid: ${CallSid}, AnsweredBy: ${AnsweredBy}, Status: ${CallStatus}`);

  const pendiente = transferenciasPendientes.get(CallSid);
  if (!pendiente) {
    // Ya resuelto, o evento tardío (ej: 'completed' tras un AMD ya procesado)
    return res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
  }

  const esHumano   = AnsweredBy === 'human';
  const esBuzon    = AnsweredBy?.startsWith('machine') || AnsweredBy === 'fax';
  const noContesto = ['no-answer', 'busy', 'failed'].includes(CallStatus);

  if (esHumano) {
    clearTimeout(pendiente.timer);
    transferenciasPendientes.delete(CallSid);
    console.log('[Transferencia] Abogado contestó — uniendo en conferencia');
    pendiente.resolve({ resultado: 'conectado', answered_by: AnsweredBy });

    // Tras un breve margen (para que el agente alcance a hablar), unimos ambas patas.
    setTimeout(async () => {
      try {
        await moverAConferencia({ callSid: CallSid, conferenceName: pendiente.conferenceName });
        if (pendiente.leadCallSid) {
          await moverAConferencia({ callSid: pendiente.leadCallSid, conferenceName: pendiente.conferenceName });
        }
        console.log('[Transferencia] Lead y abogado unidos en conferencia');
      } catch (err) {
        console.error('[Transferencia] Error uniendo en conferencia:', err?.message || err);
      }
    }, DELAY_BRIDGE_MS);

  } else if (esBuzon || noContesto) {
    clearTimeout(pendiente.timer);
    transferenciasPendientes.delete(CallSid);
    console.log(`[Transferencia] No disponible (${esBuzon ? 'buzón' : CallStatus}) — colgando pata del abogado`);
    try {
      await colgarLlamada(CallSid);
    } catch (err) {
      // La llamada ya pudo haber terminado (no-answer); no es un error real.
    }
    pendiente.resolve({
      resultado: 'no_disponible',
      motivo: esBuzon ? 'buzon' : (CallStatus || 'no_contesto'),
      answered_by: AnsweredBy || null,
    });
  }

  return res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');
}
