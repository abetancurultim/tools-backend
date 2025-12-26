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

// Tool 3: Notificar Interés (Lead caliente, sin comprar aún)
export const handleInsuranceInterest = async (req, res) => {
  try {
    const interestData = req.body;
    // Validaciones básicas
    if (!interestData.clientName || !interestData.clientPhone) {
      return res.status(400).json({ error: 'Faltan datos del cliente (nombre, teléfono)' });
    }

    const result = await insuranceService.processInterestNotification(interestData);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error procesando interés de seguro' });
  }
};

// Tool 4: Registrar y Activar Cliente (Venta cerrada)
export const handleInsuranceRegistration = async (req, res) => {
  try {
    const registrationData = req.body;
    
    // Validación de campos críticos para la BD
    const required = ['name', 'phone_number', 'email', 'document_id'];
    const missing = required.filter(field => !registrationData[field]);

    if (missing.length > 0) {
      return res.status(400).json({ error: `Faltan campos requeridos: ${missing.join(', ')}` });
    }

    const result = await insuranceService.processClientRegistration(registrationData);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el proceso de registro de seguro' });
  }
};