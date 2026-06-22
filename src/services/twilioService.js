import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from '../config/env.js';

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const conferenceTwiml = (conferenceName) =>
  `<Response><Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true">${conferenceName}</Conference></Dial></Response>`;

/**
 * Marca al abogado con AMD. Mientras AMD decide, escucha silencio.
 * Si resulta humano, redirigimos esta pata (y la del lead) a una conferencia.
 */
export async function marcarAbogadoConAMD({ numeroAbogado, callbackUrl }) {
  const llamada = await client.calls.create({
    to: numeroAbogado,
    from: TWILIO_PHONE_NUMBER,
    machineDetection: 'Enable',
    asyncAmd: 'true',
    asyncAmdStatusCallback: callbackUrl,
    asyncAmdStatusCallbackMethod: 'POST',
    twiml: '<Response><Pause length="60"/></Response>',
    statusCallback: callbackUrl,
    statusCallbackMethod: 'POST',
    statusCallbackEvent: ['completed'],
  });
  return llamada.sid;
}

/** Redirige una llamada en curso a una sala de conferencia. */
export async function moverAConferencia({ callSid, conferenceName }) {
  await client.calls(callSid).update({ twiml: conferenceTwiml(conferenceName) });
}

/** Cuelga una llamada en curso (ej: buzón de voz del abogado). */
export async function colgarLlamada(callSid) {
  await client.calls(callSid).update({ status: 'completed' });
}
