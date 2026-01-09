import { jest } from '@jest/globals';

// Mockear el cliente de Supabase específico para call logs
const mockSupabaseColtefinancieraRecordatorios = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
};

jest.unstable_mockModule('../src/config/clients.js', () => ({
  supabaseColtefinancieraRecordatorios: mockSupabaseColtefinancieraRecordatorios,
}));

const { processElevenLabsWebhook, insertCallLog } = await import('../src/services/callLogsService.js');

describe('CallLogsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processElevenLabsWebhook', () => {
    it('should process ElevenLabs payload successfully', async () => {
      const mockPayload = {
        data: {
          conversation_id: 'conv_123456789',
          agent_id: 'agent_abc123',
          status: 'completed',
          analysis: {
            call_successful: true,
            rationale: 'Cliente mostró alto interés',
            evaluation_criteria_results: {
              engagement: true,
              information_collected: true
            }
          }
        }
      };

      // Mockear que no existe registro previo
      mockSupabaseColtefinancieraRecordatorios.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows' }
      });

      // Mockear inserción exitosa
      mockSupabaseColtefinancieraRecordatorios.single.mockResolvedValueOnce({
        data: {
          conversation_id: 'conv_123456789',
          agent_id: 'agent_abc123',
          is_successful: true,
          evaluation_rationale: 'Cliente mostró alto interés',
          call_status: 'completed'
        },
        error: null
      });

      const result = await processElevenLabsWebhook(mockPayload);

      expect(result.success).toBe(true);
      expect(result.data.conversation_id).toBe('conv_123456789');
      expect(mockSupabaseColtefinancieraRecordatorios.from).toHaveBeenCalledWith('call_logs');
    });

    it('should handle missing conversation_id', async () => {
      const mockPayload = {
        data: {
          agent_id: 'agent_abc123',
          status: 'completed'
          // conversation_id faltante
        }
      };

      const result = await processElevenLabsWebhook(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('conversation_id es requerido');
    });

    it('should handle missing agent_id', async () => {
      const mockPayload = {
        data: {
          conversation_id: 'conv_123456789',
          status: 'completed'
          // agent_id faltante
        }
      };

      const result = await processElevenLabsWebhook(mockPayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('agent_id es requerido');
    });

    it('should handle duplicate conversation_id', async () => {
      const mockPayload = {
        data: {
          conversation_id: 'conv_existing',
          agent_id: 'agent_abc123',
          status: 'completed',
          analysis: {
            call_successful: false,
            rationale: 'Cliente no respondió'
          }
        }
      };

      // Mockear que ya existe el registro
      mockSupabaseColtefinancieraRecordatorios.single.mockResolvedValueOnce({
        data: { conversation_id: 'conv_existing' },
        error: null
      });

      const result = await processElevenLabsWebhook(mockPayload);

      expect(result.success).toBe(true);
      expect(result.existed).toBe(true);
      expect(result.message).toContain('ya existente');
    });
  });

  describe('Data extraction', () => {
    it('should extract call success from different payload structures', async () => {
      const testCases = [
        {
          payload: { analysis: { call_successful: true } },
          expected: true
        },
        {
          payload: { analysis: { evaluation_criteria_results: { successful: false } } },
          expected: false
        },
        {
          payload: { analysis: { success: true } },
          expected: true
        },
        {
          payload: { analysis: {} },
          expected: false // default
        }
      ];

      for (const testCase of testCases) {
        const fullPayload = {
          data: {
            conversation_id: 'test_conv',
            agent_id: 'test_agent',
            status: 'completed',
            ...testCase.payload
          }
        };

        // Mockear respuestas de Supabase
        mockSupabaseColtefinancieraRecordatorios.single
          .mockResolvedValueOnce({ data: null, error: { message: 'No rows' } })
          .mockResolvedValueOnce({
            data: { conversation_id: 'test_conv', is_successful: testCase.expected },
            error: null
          });

        const result = await processElevenLabsWebhook(fullPayload);
        expect(result.success).toBe(true);
        expect(result.data.is_successful).toBe(testCase.expected);
      }
    });
  });
});