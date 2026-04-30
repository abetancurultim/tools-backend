import { jest } from '@jest/globals';

// 1. Definir Mocks antes de importar la app
const mockS3 = {
  upload: jest.fn().mockReturnThis(),
  promise: jest.fn().mockResolvedValue({ Location: 'https://s3.aws.com/file' }),
};

const mockTransporter = {
  sendMail: jest.fn().mockResolvedValue({ messageId: '123' }),
};

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: { document_id: '830120063', name: 'JUAN PEREZ', email: 'juan@example.com' }, error: null }),
  insert: jest.fn().mockReturnThis(),
};

const mockAxios = {
  post: jest.fn(),
};

// 2. Mockear módulos (ESM requiere unstable_mockModule)
jest.unstable_mockModule('strong-soap', () => ({
  default: { soap: { createClientAsync: jest.fn() } },
  soap: { createClientAsync: jest.fn() }
}));
jest.unstable_mockModule('axios', () => ({ default: mockAxios }));
jest.unstable_mockModule('../src/services/userService.js', () => ({
  fetchUser: jest.fn().mockResolvedValue({ document_id: '830120063', name: 'JUAN PEREZ', email: 'juan@example.com' })
}));
jest.unstable_mockModule('../src/services/authService.js', () => ({
  getAuthToken: jest.fn().mockResolvedValue('fake-jwt-token')
}));
jest.unstable_mockModule('../src/services/flamingoService.js', () => ({
  consultaClientesFlamingo: jest.fn()
}));
jest.unstable_mockModule('../src/middlewares/auth.js', () => ({
  protectRoute: jest.fn((req, res, next) => next()),
  verifyElevenLabsSignature: jest.fn((req, res, next) => next()),
  verifyElevenLabsSignatureColtefinanciera: jest.fn((req, res, next) => next())
}));
jest.unstable_mockModule('../src/config/clients.js', () => ({
  s3: mockS3,
  transporterColectora: mockTransporter,
  transporterVidaDeudor: mockTransporter,
  supabaseVidaDeudor: mockSupabase,
  supabaseColtefinancieraRecordatorios: {}, 
  supabaseColectora: {}, 
}));

// 3. Importar dinámicamente app y supertest
const { default: request } = await import('supertest');
const { default: app } = await import('../src/app.js');

describe('API Integration Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return welcome message', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Ultim Tools API is running');
    });
  });

  describe('POST /api/v1/get-debts', () => {
    it('should return debts list when API call is successful', async () => {
      // Mock de Axios para simular respuesta de Latam
      const mockData = {
        "resultado": true,
        "codigo": "0001",
        "mensaje": "documento con credito(s) activo(s)",
        "fecha_generacion": "2025-12-26T09:51:18-05:00",
        "cantidad_creditos": 1,
        "obligaciones": [
          {
            "numero_credito": 39249,
            "identificador_unico": "02725e045c1e93f2304e49468cf4f884",
            "tipo_servicio": "Pago en linea",
            "detalle": "PREPAGO OBLIGACION  39249",
            "origen": "COLTEFINANCIERA CORRIENTE",
            "detalle_pago": [
              {
                "identificador_unico_pago": "4d54adcbfd7597e40c9f019b06501396",
                "link": "checkout.payvalida.com?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNRVJDSEFOVF9DRUwiOiIzMjE2ODIzOTQ1IiwiTUVSQ0hBTlRfQ09ERSI6MzM0NjYsIk9SREVSX0NPREUiOjI3Njc1NTIzNiwiTUVSQ0hBTlRfRU1BSUwiOiJpbmZvQGxhdGFtY29sZWN0b3JhLmNvbSIsIk1FUkNIQU5UX1VSTAiOiJNRVJDSEFOVF9OQU1FIjoiQ09MRUNUT1JBIExBVEFNIChDTykiLCJFWFBJUkFUSU9OIjoiMjcvMTIvMjAyNSIsIk9SREVSX0JSSUVGIjoiUFJFUEFHTyBBTCBQQUdBUkUgMTAwNzA5MDk2IERvY3VtZW50byA4MzAxMjAwNjMiLCJNRVJDSEFOVF9URUwiOiIzMjE2ODIzOTQ1IiwiT1JERVJfQ1VSUkVOQ1kiOiJDT1AiLCJPUkRFUl9BTU9VVCI6IjI2MDYxMDQ2NjcuMCIsIk1FUkNIQU5UX0lEIjoiY29sZWN0b3JhbGF0aW5vYW1lcmljYW5hZGVjYXIiLCJPUkRFUl9SRUZFUkVOQ0UiOiIxMDExNjIyNyIsIk9SREVSX01FVEhPRCI6IiIsIlVTRVJfREkiOiIiLCJVU0VSX1RZUEVfREkiOiIiLCJVU0VSX05BTUUiOiIiLCJSRURJUkVDVF9USU1FT1VUIjoiIiwiTUVSQ0hBTlRfVEVNUExBVEUiOiJkZWZhdWx0IiwiQ09VTlRSWV9DT0RFIjoiMzQzIiwiVkVSU0lPTiI6Ijc3YTI4MWRkLTgzM2EtNGNlMC1hMTIwLWFmYTY2MGNhOTE3MSIsImlzcyI6ImF1dGgwIiwiZXhwIjoxNzY2ODk4MDAwfQ.quT-o3GscoPxrTzGSEwoA3rg6ftyOiPguKQ0qb_esFQ",
                "valor_cuenta": "2606104667",
                "dias_mora": "4988",
                "saldo_a_fecha": "2606104667",
                "oferta": 0
              }
            ],
            "pdf_base64": ""
          }
        ]
      };

      mockAxios.post.mockResolvedValueOnce({
        data: mockData
      });

      const res = await request(app)
        .post('/api/v1/get-debts')
        .set('x-api-key', process.env.API_KEY || '12345')
        .send({ documentId: '830120063' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        document_id: '830120063',
        name: 'JUAN PEREZ',
        email: 'juan@example.com',
        number_of_credits: 1,
        debts_list: [
          {
            debt_credit_number: 39249,
            debt_origin: "COLTEFINANCIERA CORRIENTE",
            debt_details: {
              amount: "2606104667",
              days_in_arrears: "4988"
            }
          }
        ]
      });
    });

    // Como debtService.js importa userService.js, la mejor forma es mockear userService también.
    // Esto requeriría re-hacer los imports.
    // Para simplificar este paso, probaremos el caso donde la API externa falla, que no toca la BD local.
    
    it('should handle external API failure', async () => {
        mockAxios.post.mockResolvedValueOnce({
            data: { resultado: false, mensaje: 'No encontrado' }
        });

        const res = await request(app)
            .post('/api/v1/get-debts')
            .set('x-api-key', process.env.API_KEY || '12345') // Asegurar API KEY
            .send({ documentId: '830120063' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('message', "Con la información proporcionada, no encontramos registros de opciones de pago. Te invitamos a comunicarte vía WhatsApp.");
    });
  });

  describe('POST /api/v1/process-call (Email & S3)', () => {
    it('should process call log, upload to S3 and send email', async () => {
      const payload = {
        name: 'Juan Perez',
        number: '3001234567',
        callSid: 'CA12345',
        transcript: 'Hola mundo'
      };

      const res = await request(app)
        .post('/api/v1/process-call')
        .set('x-api-key', process.env.API_KEY || '12345')
        .send(payload);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Proceso completado');
      expect(res.body.details).toHaveProperty('s3');
      expect(res.body.details).toHaveProperty('email');
      
      // Verificar llamadas a mocks
      expect(mockS3.upload).toHaveBeenCalled();
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/insurance-interest (Email)', () => {
    it('should send interest email', async () => {
        const payload = {
            clientName: 'Maria Lopez',
            clientPhone: '3109876543',
            interestLevel: 'alto'
        };

        const res = await request(app)
            .post('/api/v1/insurance-interest')
            .set('x-api-key', process.env.API_KEY || '12345')
            .send(payload);

        expect(res.statusCode).toBe(200);
        expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/flamingo/get-debts', () => {
    it('should pre-filter obligations with diasMora equal to 0, null, or empty string', async () => {
      const mockAdminfoResponse = {
        "informacion basica": {
          "nombres": "JUAN PEREZ",
          "celular_replegal": "3001234567"
        },
        "obligaciones": [
          {
            "numeroObligacion": "OBL-01",
            "pago_min": "1000",
            "diasMora": "10"
          },
          {
            "numeroObligacion": "OBL-02",
            "pago_min": "2000",
            "diasMora": "0" 
          },
          {
            "numeroObligacion": "OBL-03",
            "pago_min": "3000",
            "diasMora": "" 
          },
          {
            "numeroObligacion": "OBL-04",
            "pago_min": "4000"
          },
          {
            "numeroObligacion": "OBL-05",
            "pago_min": "0",
            "diasMora": "5"
          }
        ],
        "datos contacto": {
          "telefonos": [
            { "tipo": "CEL", "idContacto": "123", "telefono": "3001234567" }
          ]
        }
      };

      const { consultaClientesFlamingo } = await import('../src/services/flamingoService.js');
      consultaClientesFlamingo.mockResolvedValueOnce(mockAdminfoResponse);

      const res = await request(app)
        .post('/api/v1/flamingo/get-debts')
        .set('x-api-key', process.env.API_KEY || '12345')
        .send({ tipoIdentificacion: "1", identificacion: "12345678" });

      expect(res.statusCode).toBe(200);
      
      expect(res.body.total_obligaciones).toBe(2); // OBL-01 y OBL-05 cumplen diasMora>0
      
      // OBL-01 y OBL-05 cumplen >0 mora. Nhưng obligaciones_vencidas tambien evalua saldo > 0.
      expect(res.body.obligaciones_vencidas.length).toBe(1);
      expect(res.body.obligaciones_vencidas[0].idObligacion).toBe("OBL-01");
    });
  });

});
