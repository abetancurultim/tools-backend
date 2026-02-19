import * as debtService from '../services/debtService.js';
import * as reportingService from '../services/reportingService.js';
import * as insuranceService from '../services/insuranceService.js';
import * as callLogsService from '../services/callLogsService.js';
import * as elevenLabsService from '../services/elevenLabsService.js';
import * as adminfoService from '../services/adminfoService.js';

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

// Tool 5: Post-call Webhook - ElevenLabs Call Logs
export const handleCallWebhook = async (req, res) => {
  try {
    console.log('[Webhook] Recibido post-call webhook de ElevenLabs');
    
    const payload = req.body;
    
    // Log del payload recibido (sin exponer datos sensibles en producción)
    console.log('[Webhook] Payload keys:', Object.keys(payload));
    
    // Procesar el webhook usando el servicio
    const result = await callLogsService.processElevenLabsWebhook(payload);
    
    if (!result.success) {
      console.error('[Webhook] Error procesando:', result.error);
      return res.status(400).json({ 
        error: 'Error procesando webhook',
        details: result.error 
      });
    }
    
    // Respuesta rápida a ElevenLabs
    console.log('[Webhook] ✅ Webhook procesado exitosamente');
    res.status(200).json({ 
      message: 'Webhook recibido y procesado',
      conversation_id: result.data?.conversation_id,
      existed: result.existed || false
    });
    
  } catch (error) {
    console.error('[Webhook] Error inesperado:', error);
    res.status(500).json({ error: 'Error interno procesando webhook' });
  }
};

// Tool 6: Consultar Call Logs (para debugging y monitoreo)
export const handleGetCallLogs = async (req, res) => {
  try {
    const { agent_id, call_successful, call_status, call_name, limit } = req.query;
    
    const filters = {};
    if (agent_id) filters.agent_id = agent_id;
    if (call_successful !== undefined) filters.call_successful = call_successful;
    if (call_status) filters.call_status = call_status;
    if (call_name) filters.call_name = call_name;
    
    const limitNum = limit ? parseInt(limit) : 50;
    
    const result = await callLogsService.getCallLogs(filters, limitNum);
    
    if (!result.success) {
      return res.status(500).json({ 
        error: 'Error consultando logs',
        details: result.error 
      });
    }
    
    res.json({
      success: true,
      count: result.count,
      logs: result.data
    });
    
  } catch (error) {
    console.error('[CallLogs] Error consultando:', error);
    res.status(500).json({ error: 'Error interno consultando logs' });
  }
};

// Tool 5: Obtener detalles de conversación de ElevenLabs
export const handleGetConversationDetails = async (req, res) => {
  try {
    const { conversation_id } = req.params;

    if (!conversation_id) {
      return res.status(400).json({ error: 'conversation_id es requerido' });
    }

    const data = await elevenLabsService.getConversationDetails(conversation_id);
    res.json(data);
  } catch (error) {
    console.error(error);
    const status = error.message.includes('No encontrado') || error.message.includes('Not Found') ? 404 : 500;
    res.status(status).json({ 
        error: 'Error obteniendo detalles de la conversación', 
        details: error.message 
    });
  }
};

// Tool 6: Proceso Bienestar Plus (Registro)
export const handleBienestarRegistration = async (req, res) => {
  console.log("Data Bienestar:", req.body);
  try {
    const data = req.body;
    
    // Normalizar datos
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

    console.log("Normalized Data Bienestar:", normalizedData);

    const required = ['name', 'phone_number', 'email', 'document_id'];
    const missing = required.filter(field => !normalizedData[field]);

    if (missing.length > 0) {
      return res.status(400).json({ 
        error: `Faltan campos requeridos para Bienestar Plus: ${missing.join(', ')}`,
        ayuda: 'Asegúrese de enviar name/clientName, phone_number/clientPhone, email y document_id'
      });
    }

    const result = await insuranceService.processClientRegistrationBienestar(normalizedData);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el proceso de Bienestar Plus' });
  }
};

export const handleBienestarInterest = async (req, res) => {
    // Reutilizamos la lógica, similar a handleInsuranceInterest = handleInsuranceRegistration
    // Pero si quisiéramos solo notificar sin guardar, llamaríamos a processInterestNotificationBienestar
    // Como en el original handleInsuranceInterest = handleInsuranceRegistration, seguiré ese patrón.
    return handleBienestarRegistration(req, res);
};

// New Adminfo Tools
export const handleGetAdminfoDebts = async (req, res) => {
  try {
    let { tipoIdentificacion, identificacion } = req.body;
    
    // Default a Cédula (1) si no se especifica
    if (!tipoIdentificacion) tipoIdentificacion = "1";

    if (!identificacion) {
      return res.status(400).json({ error: 'identificacion es requerido' });
    }

    const rawData = await adminfoService.consultaClientes(tipoIdentificacion, identificacion);

    // --- Lógica de Parseo (Adaptado de consultAdminfoObligationsTool) ---
    
    // Validar si existe la propiedad 'obligaciones'
    const obligationsRaw = rawData.obligaciones || [];
    const infoBasica = rawData['informacion basica'] || {};
    const datosContacto = rawData['datos contacto'] || {};
    
    const celularReplegal = infoBasica.celular_replegal || '';

    const obligaciones = obligationsRaw.map(obs => ({
        nrodoc: obs.nrodoc || 'N/A',
        nombredoc: obs.nombredoc || 'Obligación',
        saldo_vencido: Number(obs.saldo_vencido) || 0,
        noctasvenc: Number(obs.noctasvenc) || 0,
        nrocuotas: Number(obs.nrocuotas) || 0,
        cuotas_pendientes: Number(obs.cuotas_pendientes) || 0,
        fechvenci: obs.fechvenci || 'N/A',
        descripcion: obs.descripcion || '',
        diasMora: Number(obs.total_ges) || 0 // Mapeo solicitado
    }));

    const obligacionesVencidas = obligaciones.filter(obs => obs.saldo_vencido > 0);

    // Obtener IDs necesarios para el seguimiento (idDatoContacto y numCredito)
    const telefonos = datosContacto.telefonos || [];

    // Buscar preferiblemente un celular para obtener el consrefer (que actúa como idDatoContacto)
    const telefonoCelular = telefonos.find(t => t.tipo === 'CEL' || t.tiporeal === 'CEL');
    const contactoSeleccionado = telefonoCelular || (telefonos.length > 0 ? telefonos[0] : null);
    
    const primerIdContacto = contactoSeleccionado ? (contactoSeleccionado.consrefer || '') : '';

    // Obtener el número de crédito de la primera obligación si existe
    const primerNumCredito = obligaciones.length > 0 ? (obligaciones[0].nrodoc || '') : '';

    const result = {
        cliente: infoBasica.nombres || rawData.razonsocial || 'Cliente',
        celular_registrado: celularReplegal,
        id_dato_contacto_obligatorio: primerIdContacto,
        numero_credito_obligatorio: primerNumCredito,
        total_obligaciones: obligaciones.length,
        obligaciones_vencidas: obligacionesVencidas.length > 0 ? obligacionesVencidas : "El cliente se encuentra al día.",
        detalle_obligaciones: obligaciones
    };

    res.json(result);
  } catch (error) {
    console.error('Error in handleGetAdminfoDebts:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Error consultando deudas en Adminfo' });
  }
};

export const handleAdminfoTracking = async (req, res) => {
  try {
    const input = req.body;
    
    // --- Lógica de Validación (Adaptado de registerAdminfoFollowUpTool) ---

    // Default a Cédula (1) si no se especifica
    const tipoIdentificacion = input.tipoIdentificacion || "1";

    // Validar y priorizar el código de gestión entrante
    let gestionCode = input.codigoGestion || input.management_code;
    
    // Si no llega un código válido (numérico), usar el default 70084 (Gestión efectiva)
    // Esto permite que ElevenLabs envíe códigos específicos como 70106, 70091, etc.
    if (!gestionCode || !/^\d+$/.test(gestionCode)) {
        gestionCode = "70084"; 
    }

    // Priorizar descripción entrante
    const descripcion = input.descripcion || input.description || "Gestión realizada por Agente IA";

    // Forzar valores de canal y tipo de contacto aceptados por el API Legacy
    const followUpData = {
        ...input,
        tipoIdentificacion,
        idDatoContacto: input.idDatoContacto || "0",
        canalActual: "TEL",
        tipoContacto: "ENT",
        codigoGestion: gestionCode,
        descripcion: descripcion,
        // Limpiar codigoCausal si el agente envía texto descriptivo no vacío o inválido
        codigoCausal: (input.codigoCausal && !/^\d+$/.test(input.codigoCausal)) ? "" : (input.codigoCausal || "")
    };

    // Validar campos mínimos requeridos (después de aplicar defaults)
    const required = ['identificacion', 'grabador', 'descripcion', 'numCredito']; // Reducidos ya que otros tienen defaults
    const missing = required.filter(field => !followUpData[field]);

    if (missing.length > 0) {
      return res.status(400).json({ 
        error: `Faltan campos requeridos para el seguimiento: ${missing.join(', ')}`
      });
    }

    const result = await adminfoService.realizarSeguimiento(followUpData);
    res.json({ message: 'Seguimiento registrado con éxito', result });
  } catch (error) {
    console.error('Error in handleAdminfoTracking:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Error registrando seguimiento en Adminfo' });
  }
};

// Tool 12: Adminfo - Crear Compromiso de Pago - Coltefinanciera
export const handleAdminfoPaymentAgreement = async (req, res) => {
  try {
    const input = req.body;

    // Validar campos mínimos requeridos
    const required = ['tipoIdentificacion', 'identificacion', 'idObligacion', 'grabador', 'fechaPago', 'valorTotalPactado', 'cuotas', 'codigoGestion', 'acuerdo_pago'];
    const missing = required.filter(field => !input[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Faltan campos requeridos para el compromiso de pago: ${missing.join(', ')}`
      });
    }

    if (!Array.isArray(input.acuerdo_pago) || input.acuerdo_pago.length === 0) {
      return res.status(400).json({
        error: 'El campo acuerdo_pago debe ser un arreglo con al menos una cuota'
      });
    }

    const result = await adminfoService.crearCompromisoPago(input);
    res.json({ message: 'Compromiso de pago creado con éxito', result });
  } catch (error) {
    console.error('Error in handleAdminfoPaymentAgreement:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Error creando compromiso de pago en Adminfo' });
  }
};
