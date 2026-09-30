import { jest } from '@jest/globals';
import request from 'supertest';

const mockSolicitarOtpSms = jest.fn(async conversationId => ({
  conversationId, estado: 'OTP_SENT', celularDestino: '******5669', modoPrueba: true,
}));
const mockConsultarEstado = jest.fn(async conversationId => ({ conversationId, estado: 'OTP_SENT' }));

jest.unstable_mockModule('strong-soap', () => ({
  default: { soap: { createClient: jest.fn() }, WSSecurity: jest.fn() },
}));
jest.unstable_mockModule('../src/services/elevenLabsLibranzaService.js', () => ({
  prepararLibranza: jest.fn(),
  solicitarOtpSms: mockSolicitarOtpSms,
  firmarLibranza: jest.fn(),
  entregarLibranza: jest.fn(),
  consultarEstadoLibranza: mockConsultarEstado,
  LibranzaFlowError: class LibranzaFlowError extends Error {},
}));

const { default: app } = await import('../src/app.js');
const previousKey = process.env.ELEVENLABS_LIBRANZA_API_KEY;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ELEVENLABS_LIBRANZA_API_KEY = 'test-secret';
});

afterAll(() => {
  if (previousKey === undefined) delete process.env.ELEVENLABS_LIBRANZA_API_KEY;
  else process.env.ELEVENLABS_LIBRANZA_API_KEY = previousKey;
});

it('la ruta HTTP de OTP exige la clave y entrega el conversationId al servicio', async () => {
  await request(app).post('/api/v1/elevenlabs/libranzas/solicitar-otp-sms')
    .send({ conversationId: 'conv_test_12345678' }).expect(401);
  expect(mockSolicitarOtpSms).not.toHaveBeenCalled();

  const result = await request(app).post('/api/v1/elevenlabs/libranzas/solicitar-otp-sms')
    .set('x-elevenlabs-libranza-key', 'test-secret')
    .send({ conversationId: 'conv_test_12345678' }).expect(200);
  expect(mockSolicitarOtpSms).toHaveBeenCalledWith('conv_test_12345678');
  expect(result.body.data).toMatchObject({ estado: 'OTP_SENT', celularDestino: '******5669' });
});

it('la tool de estado consulta por cuerpo sin volver a solicitar un SMS', async () => {
  const result = await request(app).post('/api/v1/elevenlabs/libranzas/estado')
    .set('x-elevenlabs-libranza-key', 'test-secret')
    .send({ conversationId: 'conv_test_12345678' }).expect(200);
  expect(mockConsultarEstado).toHaveBeenCalledWith('conv_test_12345678');
  expect(mockSolicitarOtpSms).not.toHaveBeenCalled();
  expect(result.body.data.estado).toBe('OTP_SENT');
});
