import crypto from 'node:crypto';
import AndesService from './andesService.js';
import { resend } from '../config/clients.js';
import { buildElevenLabsLibranza } from './elevenLabsLibranzaPdf.js';
import { libranzaEmailPayloads } from './elevenLabsLibranzaNotifications.js';
import { getSession, insertSession, nextLibranzaNumber, transitionSession } from './elevenLabsLibranzaRepository.js';
import { deletePdf, loadPdf, savePdf, PdfNotAvailableError } from './elevenLabsLibranzaStorage.js';
import { TEST_EMAIL } from './elevenLabsLibranzaTestRouting.js';

const FUNDS = new Set(['CASUR', 'CREMIL', 'FIDUPREVISORA']);
const isSuccess = response => Number(response?.estado) === 0;
const pdfKey = (id, kind) => `elevenlabs-libranzas/${encodeURIComponent(id)}/${kind}.pdf`;

export class LibranzaFlowError extends Error {
  constructor(message, status = 400, code = 'invalid_request') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function required(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new LibranzaFlowError(`${label} es obligatorio`);
  return result;
}

function normalizeInput(raw) {
  const conversationId = required(raw.conversationId, 'conversationId');
  if (!/^[\w-]{8,128}$/.test(conversationId)) throw new LibranzaFlowError('conversationId inválido');
  const primerNombre = required(raw.primerNombre, 'primerNombre');
  const primerApellido = required(raw.primerApellido, 'primerApellido');
  if (/^(pensionad[oa]|cliente|usuario|desconocido)$/i.test(primerNombre) ||
      /^(pensionad[oa]|cliente|usuario|desconocido)$/i.test(primerApellido)) {
    throw new LibranzaFlowError('Confirma los nombres reales del cliente');
  }
  const segundoNombre = String(raw.segundoNombre ?? '').trim();
  const segundoApellido = String(raw.segundoApellido ?? '').trim();
  const numeroIdentificacion = required(raw.numeroIdentificacion, 'numeroIdentificacion').replace(/\D/g, '');
  if (!/^\d{5,15}$/.test(numeroIdentificacion)) throw new LibranzaFlowError('Número de identificación inválido');
  if (String(raw.tipoIdentificacion ?? 'CC').toUpperCase() !== 'CC') {
    throw new LibranzaFlowError('Este piloto de Andes solo admite cédula de ciudadanía');
  }
  let celular = required(raw.celular, 'celular').replace(/\D/g, '');
  if (celular.startsWith('57') && celular.length === 12) celular = celular.slice(2);
  if (!/^3\d{9}$/.test(celular)) throw new LibranzaFlowError('Celular colombiano inválido');
  const correo = required(raw.correo, 'correo').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new LibranzaFlowError('Correo inválido');
  const fondoPension = required(raw.fondoPension, 'fondoPension').toUpperCase();
  if (!FUNDS.has(fondoPension)) throw new LibranzaFlowError('Fondo de pensión no soportado');
  if (raw.aceptacionVerbalConfirmada !== true) {
    throw new LibranzaFlowError('La aceptación verbal debe estar confirmada antes de preparar la libranza');
  }
  const direccionResidencia = required(raw.direccionResidencia, 'direccionResidencia');
  return {
    conversationId, primerNombre, segundoNombre, primerApellido, segundoApellido,
    nombresApellidos: [primerNombre, segundoNombre, primerApellido, segundoApellido].filter(Boolean).join(' '),
    numeroIdentificacion, tipoIdentificacion: 'CC', celular, correo, fondoPension,
    direccionResidencia,
  };
}

function publicSession(row) {
  return {
    conversationId: row.conversation_id,
    estado: row.status,
    numeroLibranza: row.libranza_number,
    fondoPension: row.client_data?.fondoPension,
    celularDestino: row.client_data?.celular ? `******${row.client_data.celular.slice(-4)}` : undefined,
    modoPrueba: true,
    otpEnviadoEn: row.otp_sent_at,
    idSolicitudAndes: row.andes_id,
    documentoEntregadoEn: row.delivered_at,
    intentosOtp: row.otp_attempts,
  };
}

async function sessionOr404(conversationId) {
  const row = await getSession(conversationId);
  if (!row) throw new LibranzaFlowError('Sesión no encontrada', 404, 'not_found');
  return row;
}

function requireStatus(row, allowed) {
  if (!allowed.includes(row.status)) {
    throw new LibranzaFlowError(`La sesión está en estado ${row.status}`, 409, 'invalid_state');
  }
}

function lockOrConflict(row) {
  if (!row) throw new LibranzaFlowError('La sesión cambió de estado; consulta su estado actual', 409, 'state_changed');
  return row;
}

function isPdfBase64(value) {
  return typeof value === 'string' && value.startsWith('JVBERi0');
}

async function preparedPdf(row) {
  let bytes;
  try {
    bytes = await loadPdf(row.prepared_pdf_key);
  } catch (error) {
    if (!(error instanceof PdfNotAvailableError)) throw error;
    // Tras un reinicio se puede reconstruir el mismo PDF con los datos y fecha de la sesión.
    bytes = await buildElevenLabsLibranza(row.client_data, row.libranza_number, new Date(row.consent_at));
  }
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== row.prepared_sha256) {
    throw new LibranzaFlowError('El PDF preparado no coincide con su huella; requiere revisión', 409, 'prepared_pdf_mismatch');
  }
  await savePdf(row.prepared_pdf_key, bytes);
  return bytes;
}

export async function prepararLibranza(raw) {
  const data = normalizeInput(raw);
  let row = await getSession(data.conversationId);
  if (row) {
    if (Object.entries(data).some(([key, value]) => row.client_data?.[key] !== value)) {
      throw new LibranzaFlowError('La conversación ya tiene una libranza con datos diferentes', 409);
    }
    if (row.status !== 'PREPARATION_FAILED') return publicSession(row);
    row = lockOrConflict(await transitionSession(data.conversationId, 'PREPARATION_FAILED', { status: 'PREPARING' }));
  } else {
    // La función RPC es el contador secuencial compartido con WhatsApp.
    const number = await nextLibranzaNumber();
    const inserted = await insertSession({
      conversation_id: data.conversationId,
      status: 'PREPARING', libranza_number: number, client_data: data,
      consent_at: new Date().toISOString(), otp_attempts: 0,
    });
    row = inserted.row;
    if (!inserted.created) return publicSession(row);
  }

  try {
    const bytes = await buildElevenLabsLibranza(row.client_data, row.libranza_number, new Date(row.consent_at));
    const key = pdfKey(data.conversationId, 'prepared');
    await savePdf(key, bytes);
    const result = lockOrConflict(await transitionSession(data.conversationId, 'PREPARING', {
      status: 'READY', prepared_pdf_key: key,
      prepared_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    }));
    return publicSession(result);
  } catch (error) {
    await transitionSession(data.conversationId, 'PREPARING', { status: 'PREPARATION_FAILED' });
    throw error;
  }
}

export async function solicitarOtpSms(conversationId) {
  const row = await sessionOr404(conversationId);
  requireStatus(row, ['READY', 'OTP_SENT', 'OTP_EXPIRED']);
  if (row.status === 'OTP_SENT' && row.otp_sent_at && Date.now() - Date.parse(row.otp_sent_at) < 5 * 60_000) {
    return publicSession(row);
  }
  const claimed = lockOrConflict(await transitionSession(conversationId, row.status, { status: 'OTP_REQUESTING' }));
  const d = claimed.client_data;
  try {
    const response = await AndesService.solicitarCertificado({
      idTipoDocumento: 1, documento: d.numeroIdentificacion,
      primerNombre: d.primerNombre, segundoNombre: d.segundoNombre,
      primerApellido: d.primerApellido, segundoApellido: d.segundoApellido,
      correo: TEST_EMAIL, celular: d.celular,
      notificacion: 2, // El canal actual de WhatsApp usa 1 para email; 2 es SMS.
      pilotElevenLabsLibranza: true,
    });
    if (!isSuccess(response)) {
      await transitionSession(conversationId, 'OTP_REQUESTING', { status: 'READY' });
      throw new LibranzaFlowError(response?.mensaje || 'Andes rechazó la solicitud de OTP', 502, 'andes_error');
    }
    const sent = lockOrConflict(await transitionSession(conversationId, 'OTP_REQUESTING', {
      status: 'OTP_SENT', otp_sent_at: new Date().toISOString(), otp_attempts: 0,
    }));
    return publicSession(sent);
  } catch (error) {
    // Ante un timeout no sabemos si Andes envió el SMS. Se deja estado incierto para conciliación.
    if (!(error instanceof LibranzaFlowError)) {
      throw new LibranzaFlowError('No se pudo confirmar si Andes envió el SMS; revisa la sesión antes de reintentar', 502, 'otp_delivery_uncertain');
    }
    throw error;
  }
}

export async function firmarLibranza(conversationId, rawOtp) {
  const row = await sessionOr404(conversationId);
  requireStatus(row, ['OTP_SENT']);
  const otp = String(rawOtp ?? '').replace(/\s/g, '');
  if (!/^\d{6,8}$/.test(otp)) throw new LibranzaFlowError('El código OTP debe tener entre 6 y 8 dígitos');
  if (row.otp_attempts >= 3) throw new LibranzaFlowError('Se agotaron los intentos del OTP', 409, 'otp_attempts_exhausted');
  if (!row.otp_sent_at || !row.prepared_pdf_key || !row.prepared_sha256) {
    throw new LibranzaFlowError('La sesión de firma está incompleta', 409, 'incomplete_session');
  }
  if (Date.now() - Date.parse(row.otp_sent_at) >= 5 * 60_000) {
    await transitionSession(conversationId, 'OTP_SENT', { status: 'OTP_EXPIRED' });
    throw new LibranzaFlowError('El OTP venció; solicita uno nuevo', 409, 'otp_expired');
  }
  const prepared = await preparedPdf(row);
  lockOrConflict(await transitionSession(conversationId, 'OTP_SENT', { status: 'SIGNING' }));
  try {
    const response = await AndesService.firmarDocumento(prepared.toString('base64'), {
      idTipoDocumento: 1, documento: row.client_data.numeroIdentificacion, codigoOTP: otp,
      nombreAdjunto: `LIBRANZA_${row.libranza_number}`,
      firmaVisible: '1', coordenadasFirma: '80,20,150,60', pagina: 0,
      observaciones: 'Firma electrónica de libranza', tipoFirmaVis: 1, imagenFirma: '',
      pilotElevenLabsLibranza: true,
    });
    if (!isSuccess(response)) {
      const code = Number(response?.estado);
      const attempts = row.otp_attempts + (code === 144 ? 0 : 1);
      // Un PDF rechazado por Andes no se corrige reingresando el OTP.
      const status = code === 121 ? 'OTP_EXPIRED' : code === 144 ? 'SIGNATURE_FAILED' : 'OTP_SENT';
      await transitionSession(conversationId, 'SIGNING', { status, otp_attempts: attempts });
      throw new LibranzaFlowError(response?.mensaje || 'Andes rechazó la firma', 400,
        code === 144 ? 'invalid_pdf' : 'andes_signature_rejected');
    }
    if (!isPdfBase64(response.mensaje) || !response.id) {
      throw new Error('Andes respondió sin PDF firmado o sin identificador');
    }
    const signed = Buffer.from(response.mensaje, 'base64');
    const key = pdfKey(conversationId, 'signed');
    await savePdf(key, signed);
    const result = lockOrConflict(await transitionSession(conversationId, 'SIGNING', {
      status: 'SIGNED', signed_pdf_key: key, andes_id: String(response.id),
      signed_sha256: crypto.createHash('sha256').update(signed).digest('hex'),
      signed_at: new Date().toISOString(),
    }));
    deletePdf(row.prepared_pdf_key);
    return publicSession(result);
  } catch (error) {
    // Si hubo fallo de red o almacenamiento tras llamar a Andes, no repetimos la firma a ciegas.
    if (!(error instanceof LibranzaFlowError)) {
      throw new LibranzaFlowError('Resultado de firma incierto; requiere conciliación antes de reintentar', 502, 'signature_uncertain');
    }
    throw error;
  }
}

export async function entregarLibranza(conversationId) {
  const row = await sessionOr404(conversationId);
  if (row.status === 'DELIVERED') return publicSession(row);
  requireStatus(row, ['SIGNED']);
  if (!row.signed_pdf_key || !row.andes_id) {
    throw new LibranzaFlowError('La firma no tiene documento o ID de Andes', 409, 'incomplete_signature');
  }
  lockOrConflict(await transitionSession(conversationId, 'SIGNED', { status: 'DELIVERING' }));
  let sendingStarted = false;
  try {
    const signed = await loadPdf(row.signed_pdf_key);
    if (!row.signed_sha256 || crypto.createHash('sha256').update(signed).digest('hex') !== row.signed_sha256) {
      throw new Error('El PDF firmado no coincide con su huella');
    }
    const certificate = await AndesService.descargarCertificado(row.andes_id, { pilotElevenLabsLibranza: true });
    if (!isSuccess(certificate) || !isPdfBase64(certificate.mensaje)) {
      throw new Error('Andes no devolvió el certificado de firma');
    }
    const witness = Buffer.from(certificate.mensaje, 'base64');
    const witnessKey = pdfKey(conversationId, 'testigo');
    await savePdf(witnessKey, witness);
    lockOrConflict(await transitionSession(conversationId, 'DELIVERING', { witness_pdf_key: witnessKey }));

    const messages = libranzaEmailPayloads(row, signed, witness);
    sendingStarted = true;
    const clientEmail = await resend.emails.send(messages.client, {
      idempotencyKey: `elevenlabs-libranza/prueba/${conversationId}/cliente`,
    });
    if (clientEmail.error) throw new Error(clientEmail.error.message || 'Falló el correo al cliente');
    const internalEmail = await resend.emails.send(messages.internal, {
      idempotencyKey: `elevenlabs-libranza/prueba/${conversationId}/interno`,
    });
    if (internalEmail.error) throw new Error(internalEmail.error.message || 'Falló la notificación interna');
    const delivered = lockOrConflict(await transitionSession(conversationId, 'DELIVERING', {
      status: 'DELIVERED', delivered_at: new Date().toISOString(),
    }));
    deletePdf(row.signed_pdf_key);
    deletePdf(witnessKey);
    return publicSession(delivered);
  } catch (error) {
    // Tras iniciar cualquier envío, un timeout puede significar que sí llegó el correo.
    // Se deja DELIVERING para conciliación, sin repetir automáticamente al cliente.
    if (!sendingStarted) await transitionSession(conversationId, 'DELIVERING', { status: 'SIGNED' });
    throw new LibranzaFlowError(
      sendingStarted
        ? 'La firma existe, pero no se confirmó la entrega de ambos correos; requiere conciliación'
        : `La firma existe, pero no se pudieron preparar los correos: ${error.message}`,
      502, sendingStarted ? 'delivery_uncertain' : 'delivery_failed',
    );
  }
}

export async function consultarEstadoLibranza(conversationId) {
  return publicSession(await sessionOr404(conversationId));
}
