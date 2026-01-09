import { supabaseColtefinancieraRecordatorios } from '../config/clients.js';

/**
 * Extrae datos del payload de ElevenLabs y los estructura para la base de datos
 * @param {Object} payload - Payload completo de ElevenLabs
 * @returns {Object} Datos estructurados para la tabla call_logs
 */
const extractCallLogData = (payload) => {
  console.log('[CallLogs] Extrayendo datos del payload ElevenLabs...');
  
  // Navegar el payload para extraer datos clave
  const payloadData = payload.data || payload; // Manejar wrapper 'data' si existe
  
  const conversationId = payloadData.conversation_id;
  const agentId = payloadData.agent_id;
  const status = payloadData.status || payloadData.call_status || 'unknown';
  const analysis = payloadData.analysis || {};
  
  // Extraer call_name de dynamic_variables
  const dynamicVariables = payloadData.conversation_initiation_client_data?.dynamic_variables || payloadData.dynamic_variables || {};
  const callName = dynamicVariables.call_name || '';
  
  // Extraer datos de éxito del analysis
  let callSuccessful = '';
  let evaluationRationale = '';
  
  // Buscar call_successful en diferentes posibles ubicaciones y guardar como string
  if (analysis.call_successful !== undefined) {
    callSuccessful = String(analysis.call_successful);
  } else if (analysis.evaluation_criteria_results && analysis.evaluation_criteria_results.call_successful !== undefined) {
    callSuccessful = String(analysis.evaluation_criteria_results.call_successful);
  } else if (analysis.success !== undefined) {
    callSuccessful = String(analysis.success);
  } else if (analysis.successful !== undefined) {
    callSuccessful = String(analysis.successful);
  }
  
  // Extraer rationale/explicación
  if (analysis.rationale) {
    evaluationRationale = String(analysis.rationale);
  } else if (analysis.evaluation_rationale) {
    evaluationRationale = String(analysis.evaluation_rationale);
  } else if (analysis.explanation) {
    evaluationRationale = String(analysis.explanation);
  } else if (analysis.reason) {
    evaluationRationale = String(analysis.reason);
  }
  
  console.log(`[CallLogs] Datos extraídos - ID: ${conversationId}, Éxito: ${callSuccessful}, Agente: ${agentId}, Nombre: ${callName}`);
  
  return {
    conversation_id: conversationId,
    agent_id: agentId,
    call_successful: callSuccessful,
    evaluation_rationale: evaluationRationale.substring(0, 1000), // Limitar longitud
    full_analysis_data: payload,
    call_status: status,
    call_name: callName
  };
};

/**
 * Inserta un registro de call log en Supabase
 * @param {Object} callLogData - Datos estructurados del call log
 * @returns {Object} Resultado de la inserción
 */
export const insertCallLog = async (callLogData) => {
  try {
    console.log(`[CallLogs] Insertando log para conversación: ${callLogData.conversation_id}`);
    
    // Verificar si ya existe el registro
    const { data: existingRecord } = await supabaseColtefinancieraRecordatorios
      .from('call_logs')
      .select('conversation_id')
      .eq('conversation_id', callLogData.conversation_id)
      .single();
    
    if (existingRecord) {
      console.warn(`[CallLogs] El registro ${callLogData.conversation_id} ya existe`);
      return { 
        success: true, 
        existed: true, 
        message: 'Registro ya existente',
        data: existingRecord 
      };
    }
    
    // Insertar nuevo registro
    const { data, error } = await supabaseColtefinancieraRecordatorios
      .from('call_logs')
      .insert([callLogData])
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error de Supabase: ${error.message}`);
    }
    
    console.log(`[CallLogs] ✅ Log insertado exitosamente: ${data.conversation_id}`);
    
    return {
      success: true,
      existed: false,
      message: 'Log insertado exitosamente',
      data: data
    };
    
  } catch (error) {
    console.error(`[CallLogs] ❌ Error insertando log:`, error.message);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
};

/**
 * Procesa el payload completo de ElevenLabs y guarda en la base de datos
 * @param {Object} payload - Payload completo de ElevenLabs
 * @returns {Object} Resultado del procesamiento
 */
export const processElevenLabsWebhook = async (payload) => {
  console.log('[CallLogs] Procesando webhook de ElevenLabs...');
  
  try {
    // Validar que el payload tenga los campos mínimos requeridos
    const payloadData = payload.data || payload;
    
    if (!payloadData.conversation_id) {
      throw new Error('conversation_id es requerido en el payload');
    }
    
    if (!payloadData.agent_id) {
      throw new Error('agent_id es requerido en el payload');
    }
    
    // Extraer y estructurar los datos
    const callLogData = extractCallLogData(payload);
    
    // Insertar en la base de datos
    const result = await insertCallLog(callLogData);
    
    console.log(`[CallLogs] Procesamiento completado - Éxito: ${result.success}`);
    
    return result;
    
  } catch (error) {
    console.error(`[CallLogs] Error procesando webhook:`, error.message);
    return {
      success: false,
      error: `Error procesando webhook: ${error.message}`,
      data: null
    };
  }
};

/**
 * Obtiene logs de llamadas con filtros opcionales
 * @param {Object} filters - Filtros de búsqueda (agent_id, is_successful, etc.)
 * @param {number} limit - Límite de registros (default: 50)
 * @returns {Object} Lista de call logs
 */
export const getCallLogs = async (filters = {}, limit = 50) => {
  try {
    let query = supabaseColtefinancieraRecordatorios
      .from('call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // Aplicar filtros si están presentes
    if (filters.agent_id) {
      query = query.eq('agent_id', filters.agent_id);
    }
    
    if (filters.call_successful !== undefined) {
      query = query.eq('call_successful', filters.call_successful);
    }
    
    if (filters.call_status) {
      query = query.eq('call_status', filters.call_status);
    }
    
    if (filters.call_name) {
      query = query.eq('call_name', filters.call_name);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Error consultando logs: ${error.message}`);
    }
    
    return {
      success: true,
      data: data,
      count: data.length
    };
    
  } catch (error) {
    console.error('[CallLogs] Error consultando logs:', error.message);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};