import { supabaseVidaDeudor, transporterVidaDeudor } from '../config/clients.js';

// --- LÓGICA DE BASE DE DATOS ---
export const saveInterestedClient = async (clientData) => {
  const { name, phone_number, email, document_id } = clientData;
  console.log(`[SUPABASE] Guardando cliente interesado: ${name} (${document_id})`);

  try {
    // 1. Verificar existencia
    const { data: existingClient } = await supabaseVidaDeudor
      .from('interesados_vida_deudor')
      .select('*')
      .eq('document_id', document_id)
      .single();

    if (existingClient) {
      return { success: true, existed: true, data: existingClient, message: 'Cliente ya registrado previamente' };
    }

    // 2. Insertar nuevo
    const currentDate = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseVidaDeudor
      .from('interesados_vida_deudor')
      .insert([{
        name, phone_number, email, document_id,
        date: currentDate
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);

    return { success: true, existed: false, data, message: 'Cliente registrado exitosamente' };

  } catch (error) {
    console.error(`[SUPABASE] Error:`, error);
    return { success: false, error: error.message };
  }
};

// --- ORQUESTADORES DE PROCESOS ---

// Caso A: Solo notificar interés (Lead)
export const processInterestNotification = async (interestData) => {
  return await sendInsuranceInterestNotification(interestData);
};

// Caso B: Registro completo y Activación (Venta cerrada)
export const processClientRegistration = async (clientData) => {
  const { name, phone_number, email, document_id, timestamp } = clientData;
  
  console.log(`[REGISTRATION] Procesando registro: ${name}`);

  // 1. Guardar en DB
  const saveResult = await saveInterestedClient({ name, phone_number, email, document_id });
  
  if (!saveResult.success) {
    return { success: false, error: 'Error guardando en BD', details: saveResult.error };
  }

  // 2. Enviar correos de activación
  const emailResults = await sendActivationEmails({
    name, phone_number, email, document_id, timestamp, wasExisting: saveResult.existed
  });

  return {
    success: true,
    data: { client: saveResult.data, existed: saveResult.existed, emailResults },
    message: saveResult.existed ? 'Cliente reactivado' : 'Cliente registrado y activado'
  };
};

// --- LÓGICA DE EMAILS (INTERNA) ---

const sendInsuranceInterestNotification = async (interestData) => {
  const { clientName, clientPhone, interestLevel = 'alto', notes = '', contactPreference } = interestData;
  const supervisorEmail = process.env.SUPERVISOR_EMAIL_VIDADEUDOR;

  // Configuración visual según interés
  const interestConfig = {
    'alto': { emoji: '🔥', color: '#dc3545', label: 'ALTO INTERÉS' },
    'medio': { emoji: '⚡', color: '#fd7e14', label: 'INTERÉS MEDIO' },
    'bajo': { emoji: '💡', color: '#ffc107', label: 'INTERÉS INICIAL' }
  };
  const config = interestConfig[interestLevel] || interestConfig['alto'];

  const htmlContent = `
    <div style="font-family: Arial; border: 1px solid #ddd; padding: 20px; max-width: 600px;">
      <h2 style="color: ${config.color}; text-align: center;">${config.emoji} ${config.label} - SEGURO VIDA</h2>
      <p><strong>Cliente:</strong> ${clientName}</p>
      <p><strong>Teléfono:</strong> ${clientPhone}</p>
      <p><strong>Preferencia:</strong> ${contactPreference}</p>
      <div style="background: #f0f0f0; padding: 10px; margin: 10px 0;">
        <strong>Notas:</strong> ${notes}
      </div>
    </div>
  `;

  try {
    await sendMailHelper(supervisorEmail, `${config.emoji} INTERÉS SEGURO - ${clientName}`, htmlContent);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const sendActivationEmails = async (data) => {
  const { name, email, wasExisting } = data;
  const results = { supervisor: false, client: false };

  // 1. Email Supervisor
  try {
    const subjectSup = `${wasExisting ? '🔄 REACTIVACIÓN' : '🎉 NUEVA ACTIVACIÓN'} - Vida Deudor - ${name}`;
    const htmlSup = getSupervisorActivationTemplate(data);
    await sendMailHelper(process.env.SUPERVISOR_EMAIL_VIDADEUDOR, subjectSup, htmlSup);
    console.log('[EMAILS] Supervisor notificado OK.');
    results.supervisor = true;
  } catch (e) { console.error('Error email supervisor:', e); }

  // 2. Email Cliente (Bienvenida)
  // Verificamos que exista email y enviamos SIEMPRE el template de bienvenida
  if (email) {
    try {
      console.log('[EMAILS] Intentando enviar bienvenida a cliente:', email);
      const subjectClient = `🎉 ¡Bienvenido a Asistencia Vida Deudor!`;
      const htmlClient = getClientWelcomeTemplate(data);
      await sendMailHelper(email, subjectClient, htmlClient);
      console.log('[EMAILS] Cliente notificado OK.');
      results.client = true;
    } catch (e) { console.error('Error email cliente:', e); }
  } else {
    console.warn('[EMAILS] No email para cliente, omitiendo bienvenida.');
  }

  return results;
};

// --- HELPERS (ENVÍO Y TEMPLATES) ---

const sendMailHelper = async (to, subject, html) => {
  const ccList = process.env.SUPERVISOR_CC_VIDADEUDOR ? process.env.SUPERVISOR_CC_VIDADEUDOR.split(',') : [];
  return await transporterVidaDeudor.sendMail({
    from: process.env.EMAIL_FROM_VIDADEUDOR || '"Seguros IA" <grow@ultimmarketing.com>',
    to,
    cc: "andres.c@ultimmarketing.com",
    subject,
    html
  });
};

// Template HTML para Supervisor
const getSupervisorActivationTemplate = ({ name, phone_number, email, document_id, transcript, wasExisting }) => `
  <div style="font-family: Arial; padding: 20px; border: 1px solid #ddd;">
    <h2 style="color: #28a745;">${wasExisting ? 'Cliente Reactivado' : 'Nuevo Cliente Activado'}</h2>
    <ul>
      <li><strong>Nombre:</strong> ${name}</li>
      <li><strong>Teléfono:</strong> ${phone_number}</li>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Cédula:</strong> ${document_id}</li>
    </ul>
  </div>
`;

// Template HTML para Cliente
const getClientWelcomeTemplate = ({ name, document_id }) => `
  <div style="font-family: Arial; padding: 20px; border: 1px solid #ddd;">
    <h2 style="color: #17a2b8;">¡Felicidades ${name}!</h2>
    <p>Tu <strong>Asistencia Vida Deudor</strong> ha sido activada exitosamente.</p>
    <div style="background: #e9ecef; padding: 15px; margin: 15px 0;">
      <strong>Qué incluye:</strong>
      <ul>
        <li>Teleconsulta medicina general (2/año)</li>
        <li>Telepsicología (2/año)</li>
        <li>Telenutrición ilimitada</li>
        <li>Descuento en farmacias</li>
      </ul>
    </div>
    <p>Para solicitar servicios llama al <strong>(601) 4320020</strong>.</p>
  </div>
`;

// --- SECCIÓN BIENESTAR PLUS ---

// 1. BD Bienestar Plus
export const saveInterestedClientBienestar = async (clientData) => {
  const { name, phone_number, email, document_id } = clientData;
  console.log(`[SUPABASE] Guardando cliente Bienestar Plus: ${name} (${document_id})`);

  try {
    // Verificar existencia
    const { data: existingClient } = await supabaseVidaDeudor
      .from('interesados_bienestar_plus')
      .select('*')
      .eq('document_id', document_id)
      .single();

    if (existingClient) {
      return { success: true, existed: true, data: existingClient, message: 'Cliente Bienestar Plus ya registrado previamente' };
    }

    // Insertar nuevo
    const currentDate = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseVidaDeudor
      .from('interesados_bienestar_plus') // Nueva tabla
      .insert([{
        name, phone_number, email, document_id,
        date: currentDate
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);

    return { success: true, existed: false, data, message: 'Cliente Bienestar Plus registrado exitosamente' };

  } catch (error) {
    console.error(`[SUPABASE] Error Bienestar Plus:`, error);
    return { success: false, error: error.message };
  }
};

// 2. Orquestadores Bienestar Plus

// Caso A: Solo notificar interés (Lead) - Bienestar Plus
export const processInterestNotificationBienestar = async (interestData) => {
  return await sendInsuranceInterestNotificationBienestar(interestData);
};

// Caso B: Registro completo y Activación (Venta cerrada) - Bienestar Plus
export const processClientRegistrationBienestar = async (clientData) => {
  const { name, phone_number, email, document_id, timestamp } = clientData;
  
  console.log(`[REGISTRATION] Procesando registro Bienestar Plus: ${name}`);

  // 1. Guardar en DB
  const saveResult = await saveInterestedClientBienestar({ name, phone_number, email, document_id });
  
  if (!saveResult.success) {
    return { success: false, error: 'Error guardando en BD (Bienestar)', details: saveResult.error };
  }

  // 2. Enviar correos de activación
  const emailResults = await sendActivationEmailsBienestar({
    name, phone_number, email, document_id, timestamp, wasExisting: saveResult.existed
  });

  return {
    success: true,
    data: { client: saveResult.data, existed: saveResult.existed, emailResults },
    message: saveResult.existed ? 'Cliente Bienestar Plus reactivado' : 'Cliente Bienestar Plus registrado y activado'
  };
};

// 3. Emails Bienestar Plus

const sendInsuranceInterestNotificationBienestar = async (interestData) => {
  const { clientName, clientPhone, interestLevel = 'alto', notes = '', contactPreference } = interestData;
  // Usamos el mismo email de supervisor o uno específico si existiera
  const supervisorEmail = process.env.SUPERVISOR_EMAIL_BIENESTARPLUS || process.env.SUPERVISOR_EMAIL_VIDADEUDOR;

  const interestConfig = {
    'alto': { emoji: '🔥', color: '#dc3545', label: 'ALTO INTERÉS' },
    'medio': { emoji: '⚡', color: '#fd7e14', label: 'INTERÉS MEDIO' },
    'bajo': { emoji: '💡', color: '#ffc107', label: 'INTERÉS INICIAL' }
  };
  const config = interestConfig[interestLevel] || interestConfig['alto'];

  const htmlContent = `
    <div style="font-family: Arial; border: 1px solid #ddd; padding: 20px; max-width: 600px;">
      <h2 style="color: ${config.color}; text-align: center;">${config.emoji} ${config.label} - BIENESTAR PLUS</h2>
      <p><strong>Cliente:</strong> ${clientName}</p>
      <p><strong>Teléfono:</strong> ${clientPhone}</p>
      <p><strong>Preferencia:</strong> ${contactPreference}</p>
      <div style="background: #f0f0f0; padding: 10px; margin: 10px 0;">
        <strong>Notas:</strong> ${notes}
      </div>
    </div>
  `;

  try {
    await sendMailHelper(supervisorEmail, `${config.emoji} INTERÉS BIENESTAR - ${clientName}`, htmlContent);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const sendActivationEmailsBienestar = async (data) => {
  const { name, email, wasExisting } = data;
  const results = { supervisor: false, client: false };
  const supervisorEmail = process.env.SUPERVISOR_EMAIL_BIENESTARPLUS || process.env.SUPERVISOR_EMAIL_VIDADEUDOR;

  // 1. Email Supervisor
  try {
    const subjectSup = `${wasExisting ? '🔄 REACTIVACIÓN' : '🎉 NUEVA ACTIVACIÓN'} - Bienestar Plus - ${name}`;
    const htmlSup = getSupervisorActivationTemplateBienestar(data);
    await sendMailHelper(supervisorEmail, subjectSup, htmlSup);
    results.supervisor = true;
  } catch (e) { console.error('Error email supervisor (Bienestar):', e); }

  // 2. Email Cliente (Bienvenida)
  try {
    const subjectClient = `🎉 ¡Bienvenido a Bienestar Plus!`;
    const htmlClient = getClientWelcomeTemplateBienestar(data);
    await sendMailHelper(email, subjectClient, htmlClient);
    results.client = true;
  } catch (e) { console.error('Error email cliente (Bienestar):', e); }

  return results;
};

// Templates Bienestar Plus

const getSupervisorActivationTemplateBienestar = ({ name, phone_number, email, document_id, wasExisting }) => `
  <div style="font-family: Arial; padding: 20px; border: 1px solid #ddd;">
    <h2 style="color: #28a745;">${wasExisting ? 'Cliente Reactivado (Bienestar Plus)' : 'Nuevo Cliente Activado (Bienestar Plus)'}</h2>
    <ul>
      <li><strong>Nombre:</strong> ${name}</li>
      <li><strong>Teléfono:</strong> ${phone_number}</li>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Cédula:</strong> ${document_id}</li>
    </ul>
  </div>
`;

const getClientWelcomeTemplateBienestar = ({ name }) => `
  <div style="font-family: Arial; padding: 20px; border: 1px solid #ddd;">
    <h2 style="color: #17a2b8;">¡Felicidades ${name}!</h2>
    <p>Tu plan <strong>Bienestar Plus</strong> ha sido activado exitosamente.</p>
    <div style="background: #e9ecef; padding: 15px; margin: 15px 0;">
      <strong>Beneficios incluidos:</strong>
      <ul>
        <li>Cobertura ampliada de salud</li>
        <li>Descuentos exclusivos en red aliada</li>
        <li>Asistencia domiciliaria preferencial</li>
        <li>Atención prioritaria 24/7</li>
      </ul>
    </div>
    <p>Para solicitar servicios llama al <strong>(601) 4320020</strong> o contáctanos por WhatsApp.</p>
  </div>
`;