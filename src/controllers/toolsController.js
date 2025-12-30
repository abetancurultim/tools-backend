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
    const rawData = req.body;
    // console.log('--> Payload recibido en /process-call:', JSON.stringify(rawData, null, 2));

    let callData = {};

    // Detectar si es payload de ElevenLabs (NUEVO FORMATO: wrapper "data")
    // El payload real tiene la info dentro de una propiedad 'data'
    const payloadData = rawData.data || rawData; // Fallback para pruebas planas

    if (payloadData.conversation_id) {
      console.log('Recibido Webhook de ElevenLabs:', payloadData.conversation_id);
      
      // Formatear transcripción
      let cleanTranscript = [];
      let formattedTranscript = '';
      
      if (Array.isArray(payloadData.transcript)) {
          // Versión Array para S3 (Limpia)
          cleanTranscript = payloadData.transcript.map(t => ({
              role: t.role,
              message: t.message
          }));

          // Versión String para Email (Legible)
          formattedTranscript = payloadData.transcript
            .map(t => `${t.role}: ${t.message}`)
            .join('\n');
      } else {
          formattedTranscript = payloadData.transcript || '';
      }

      // Extracción de metadatos basada en el JSON real recibido
      const dynamicVars = payloadData.conversation_initiation_client_data?.dynamic_variables || {};
      const metadataResult = payloadData.analysis?.data_collection_results || {};
      const phoneData = payloadData.metadata?.phone_call || {};

      callData = {
        callSid: payloadData.conversation_id,
        // Prioridad: 1. Data Collection Result, 2. Variable dinámica user_name, 3. Default
        name: metadataResult.name?.value || dynamicVars.user_name || 'Cliente ElevenLabs',
        // Prioridad: 1. Data Collection Result, 2. Número real de la llamada, 3. Variable dynamic
        number: metadataResult.phone_number?.value || phoneData.external_number || dynamicVars.system__called_number || 'Desconocido',
        
        // Datos específicos solicitados
        document_id: dynamicVars.document_id || dynamicVars.identification_doc || '',
        pagaduria: dynamicVars.pagaduria || dynamicVars.entity || '', // Intentar leer pagaduria
        duration: payloadData.metadata?.call_duration_secs || payloadData.duration_seconds || 0,
        
        cleanTranscript: cleanTranscript, // Para S3
        transcript: formattedTranscript   // Para Email
      };

      console.log('Datos procesados:', JSON.stringify({
        name: callData.name,
        docs: callData.document_id,
        msgs: callData.cleanTranscript.length
      }, null, 2));

    } else {
      // Formato Legacy/Manual
      callData = rawData;
    }
    
    // Validaciones básicas actualizadas
    if (!callData.callSid) {
      return res.status(400).json({ error: 'Faltan datos críticos (callSid)' });
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
  console.log("Data:", req.body);
  try {
    const data = req.body;
    
    // Normalizar datos para soportar ambos formatos de payload (interest y registration)
    const normalizedData = {
      name: data.clientName || data.clientName,
      phone_number: data.clientPhone || data.clientPhone,
      email: data.clientEmail,
      document_id: data.clientDocumentId,
      callSid: data.callSid || null,
      transcript: data.transcript || null,
      timestamp: new Date().toISOString(),
      interestLevel: data.interestLevel || 'alto'
    };

    console.log("Normalized Data:", normalizedData);

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