import { jest } from '@jest/globals';
import crypto from 'node:crypto';

let row;
const mockGetSession = jest.fn(async () => row);
const mockTransition = jest.fn(async (_id, expected, changes) => {
  if (row.status !== expected) return null;
  row = { ...row, ...changes };
  return row;
});
const mockSolicitarCertificado = jest.fn(async () => ({ estado: 0, mensaje: 'OK' }));
const mockFirmarDocumento = jest.fn(async () => ({
  estado: 0, id: 999, mensaje: Buffer.from('%PDF-1.4\nfirmado').toString('base64'),
}));
const mockDescargarCertificado = jest.fn(async () => ({
  estado: 0, mensaje: Buffer.from('%PDF-1.4\ncertificado').toString('base64'),
}));
const mockLoadPdf = jest.fn(async () => Buffer.from('%PDF-1.4\npreparado'));
const mockSavePdf = jest.fn(async () => {});
const mockDeletePdf = jest.fn();
const mockResendSend = jest.fn(async () => ({ data: { id: 'email_123' }, error: null }));

jest.unstable_mockModule('../src/services/elevenLabsLibranzaRepository.js', () => ({
  getSession: mockGetSession,
  transitionSession: mockTransition,
  insertSession: jest.fn(), nextLibranzaNumber: jest.fn(),
}));
jest.unstable_mockModule('../src/services/andesService.js', () => ({
  default: { solicitarCertificado: mockSolicitarCertificado, firmarDocumento: mockFirmarDocumento, descargarCertificado: mockDescargarCertificado },
}));
jest.unstable_mockModule('../src/config/clients.js', () => ({ resend: { emails: { send: mockResendSend } } }));
jest.unstable_mockModule('../src/services/elevenLabsLibranzaStorage.js', () => ({
  loadPdf: mockLoadPdf, savePdf: mockSavePdf, deletePdf: mockDeletePdf,
  PdfNotAvailableError: class PdfNotAvailableError extends Error {},
}));

const { solicitarOtpSms, firmarLibranza, entregarLibranza } = await import('../src/services/elevenLabsLibranzaService.js');

beforeEach(() => {
  jest.clearAllMocks();
  row = {
    conversation_id: 'conv_12345678', status: 'READY', libranza_number: '0000042',
    client_data: {
      numeroIdentificacion: '12345678', primerNombre: 'Ana', segundoNombre: '',
      primerApellido: 'Pérez', segundoApellido: '', correo: 'ana@example.com',
      celular: '3001234567', fondoPension: 'CASUR', nombresApellidos: 'Ana Pérez',
    },
    otp_attempts: 0,
  };
});

it('solicita el OTP por SMS al celular confirmado en la llamada y no reenvía durante su vigencia', async () => {
  const first = await solicitarOtpSms('conv_12345678');
  expect(first.estado).toBe('OTP_SENT');
  expect(mockSolicitarCertificado).toHaveBeenCalledWith(expect.objectContaining({
    idTipoDocumento: 1, documento: '12345678', celular: '3001234567',
    correo: 'alejandro.b@ultimmarketing.com', notificacion: 2,
  }));
  expect(first.celularDestino).toBe('******4567');
  expect(first.modoPrueba).toBe(true);
  await solicitarOtpSms('conv_12345678');
  expect(mockSolicitarCertificado).toHaveBeenCalledTimes(1);
});

it('usa el celular de cada sesión, no un número fijo de pruebas', async () => {
  row.client_data.celular = '3045655669';
  await solicitarOtpSms('conv_12345678');
  expect(mockSolicitarCertificado).toHaveBeenCalledWith(expect.objectContaining({ celular: '3045655669' }));
});

it('firma exactamente el PDF preparado y conserva el ID de Andes', async () => {
  row.status = 'OTP_SENT';
  row.otp_sent_at = new Date().toISOString();
  row.prepared_pdf_key = 'prepared.pdf';
  row.prepared_sha256 = crypto.createHash('sha256').update('%PDF-1.4\npreparado').digest('hex');
  const result = await firmarLibranza('conv_12345678', '87654321');
  expect(mockFirmarDocumento).toHaveBeenCalledWith(
    Buffer.from('%PDF-1.4\npreparado').toString('base64'),
    expect.objectContaining({ documento: '12345678', codigoOTP: '87654321', idTipoDocumento: 1 }),
  );
  expect(mockSavePdf).toHaveBeenCalledTimes(2);
  expect(result.estado).toBe('SIGNED');
  expect(result.idSolicitudAndes).toBe('999');
  expect(JSON.stringify(result)).not.toContain('87654321');
});

it('bloquea nuevos intentos cuando Andes rechaza el PDF con estado 144', async () => {
  row.status = 'OTP_SENT';
  row.otp_sent_at = new Date().toISOString();
  row.prepared_pdf_key = 'prepared.pdf';
  row.prepared_sha256 = crypto.createHash('sha256').update('%PDF-1.4\npreparado').digest('hex');
  mockFirmarDocumento.mockResolvedValueOnce({ estado: 144, mensaje: 'PDF inválido' });

  await expect(firmarLibranza('conv_12345678', '87654321'))
    .rejects.toMatchObject({ code: 'invalid_pdf' });
  expect(row.status).toBe('SIGNATURE_FAILED');
  expect(row.otp_attempts).toBe(0);
  await expect(firmarLibranza('conv_12345678', '87654321'))
    .rejects.toMatchObject({ code: 'invalid_state' });
  expect(mockFirmarDocumento).toHaveBeenCalledTimes(1);
});

it('envía ambos correos solo al destino de prueba, con libranza y certificado según corresponde', async () => {
  const signed = Buffer.from('%PDF-1.4\nfirmado');
  row = {
    ...row, status: 'SIGNED', signed_pdf_key: 'signed.pdf', andes_id: '999',
    signed_sha256: crypto.createHash('sha256').update(signed).digest('hex'),
  };
  mockLoadPdf.mockResolvedValueOnce(signed);

  const result = await entregarLibranza('conv_12345678');

  expect(result.estado).toBe('DELIVERED');
  expect(mockDescargarCertificado).toHaveBeenCalledWith('999', { pilotElevenLabsLibranza: true });
  expect(mockResendSend).toHaveBeenCalledTimes(2);
  const client = mockResendSend.mock.calls[0][0];
  const internal = mockResendSend.mock.calls[1][0];
  expect(client.to).toBe('alejandro.b@ultimmarketing.com');
  expect(client.attachments).toHaveLength(1);
  expect(internal.to).toBe('alejandro.b@ultimmarketing.com');
  expect(client.cc).toBeUndefined();
  expect(client.bcc).toBeUndefined();
  expect(internal.cc).toBeUndefined();
  expect(internal.bcc).toBeUndefined();
  expect(internal.attachments).toHaveLength(2);
  expect(internal.attachments[0].content).toBe(signed.toString('base64'));
  expect(internal.attachments[1].content).toBe(Buffer.from('%PDF-1.4\ncertificado').toString('base64'));
  expect(internal.html).toContain('Contactar al cliente lo antes posible');
  expect(internal.html).toContain('otros documentos pendientes');
  expect(mockResendSend.mock.calls[0][1].idempotencyKey).not.toBe(mockResendSend.mock.calls[1][1].idempotencyKey);
  expect(mockResendSend.mock.calls[0][1].idempotencyKey).toContain('/prueba/');
  expect(mockDeletePdf).toHaveBeenCalledWith('signed.pdf');
});

it('no envía correos si Andes no entrega el certificado de firma', async () => {
  const signed = Buffer.from('%PDF-1.4\nfirmado');
  row = {
    ...row, status: 'SIGNED', signed_pdf_key: 'signed.pdf', andes_id: '999',
    signed_sha256: crypto.createHash('sha256').update(signed).digest('hex'),
  };
  mockLoadPdf.mockResolvedValueOnce(signed);
  mockDescargarCertificado.mockResolvedValueOnce({ estado: 500, mensaje: 'Error' });

  await expect(entregarLibranza('conv_12345678')).rejects.toMatchObject({ code: 'delivery_failed' });
  expect(row.status).toBe('SIGNED');
  expect(mockResendSend).not.toHaveBeenCalled();
});

it('no reenvía automáticamente al cliente si el correo interno queda incierto', async () => {
  const signed = Buffer.from('%PDF-1.4\nfirmado');
  row = {
    ...row, status: 'SIGNED', signed_pdf_key: 'signed.pdf', andes_id: '999',
    signed_sha256: crypto.createHash('sha256').update(signed).digest('hex'),
  };
  mockLoadPdf.mockResolvedValueOnce(signed);
  mockResendSend.mockResolvedValueOnce({ data: { id: 'email_client' }, error: null });
  mockResendSend.mockRejectedValueOnce(new Error('timeout'));

  await expect(entregarLibranza('conv_12345678')).rejects.toMatchObject({ code: 'delivery_uncertain' });
  expect(row.status).toBe('DELIVERING');
  await expect(entregarLibranza('conv_12345678')).rejects.toMatchObject({ code: 'invalid_state' });
  expect(mockResendSend).toHaveBeenCalledTimes(2);
});
