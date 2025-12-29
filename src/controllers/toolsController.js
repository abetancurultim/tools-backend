import * as debtService from '../services/debtService.js';
import * as reportingService from '../services/reportingService.js';
import * as insuranceService from '../services/insuranceService.js';

// Tool 1: Consultar Deudas
export const handleGetDebts = async (req, res) => {
  try {
    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: 'documentId es requerido' });
    }

    const result = await debtService.fetchDebts(documentId);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno consultando deudas' });
  }
};

// Tool 2: Procesar Llamada Exitosa (Log + Email)
export const handleProcessCall = async (req, res) => {
  try {
    const callData = req.body; // ElevenLabs envía el JSON completo aquí
    
    // Validaciones básicas
    if (!callData.callSid || !callData.name) {
      return res.status(400).json({ error: 'Faltan datos de la llamada (callSid, name)' });
    }

    const result = await reportingService.processCallLog(callData);
    res.json({ message: 'Proceso completado', details: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error procesando logs de llamada' });
  }
};

// Tool 3 & 4: Proceso Unificado de Seguro (Interés + Registro)
// Ahora ambos endpoints ejecutan la misma lógica: notificar interés y registrar cliente
export const handleInsuranceRegistration = async (req, res) => {
  try {
    const data = req.body;
    
    // Normalizar datos para soportar ambos formatos de payload (interest y registration)
    const normalizedData = {
      name: data.name || data.clientName,
      phone_number: data.phone_number || data.clientPhone,
      email: data.email,
      document_id: data.document_id,
      callSid: data.callSid,
      transcript: data.transcript,
      timestamp: data.timestamp,
      interestLevel: data.interestLevel || 'alto'
    };

    // Validación de campos críticos para el proceso completo
    const required = ['name', 'phone_number', 'email', 'document_id'];
    const missing = required.filter(field => !normalizedData[field]);

    if (missing.length > 0) {
      return res.status(400).json({ 
        error: `Faltan campos requeridos para el proceso unificado: ${missing.join(', ')}`,
        ayuda: 'Asegúrese de enviar name/clientName, phone_number/clientPhone, email y document_id'
      });
    }

    const result = await insuranceService.processClientRegistration(normalizedData);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el proceso unificado de seguro' });
  }
};

// Mantener el export para compatibilidad con las rutas, pero usando la misma lógica
export const handleInsuranceInterest = handleInsuranceRegistration;