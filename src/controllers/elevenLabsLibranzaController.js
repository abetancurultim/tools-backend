import {
  prepararLibranza, solicitarOtpSms, firmarLibranza, entregarLibranza,
  consultarEstadoLibranza, LibranzaFlowError,
} from '../services/elevenLabsLibranzaService.js';

const respond = fn => async (req, res) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (error) {
    if (!(error instanceof LibranzaFlowError)) console.error('[ElevenLabsLibranza]', error);
    res.status(error instanceof LibranzaFlowError ? error.status : 500).json({
      success: false,
      code: error instanceof LibranzaFlowError ? error.code : 'internal_error',
      error: error instanceof LibranzaFlowError ? error.message : 'Error interno de libranza',
    });
  }
};

export const preparar = respond(req => prepararLibranza(req.body));
export const solicitarOtp = respond(req => solicitarOtpSms(req.body.conversationId));
export const firmar = respond(req => firmarLibranza(req.body.conversationId, req.body.codigoOTP));
export const entregar = respond(req => entregarLibranza(req.body.conversationId));
export const estado = respond(req => consultarEstadoLibranza(req.params.conversationId));
export const estadoPorBody = respond(req => consultarEstadoLibranza(req.body.conversationId));
