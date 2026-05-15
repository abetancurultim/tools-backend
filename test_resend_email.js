import { resend } from './src/config/clients.js';
import { ANDES_ALERT_EMAIL, RESEND_FROM_EMAIL } from './src/config/env.js';

async function testResendConnection() {
  console.log('--- Iniciando prueba de Resend ---');
  console.log(`Remitente configurado: ${RESEND_FROM_EMAIL}`);
  console.log(`Destinatario configurado: ${ANDES_ALERT_EMAIL}`);
  
  if (!resend) {
    console.error('❌ Error: El cliente de Resend no está inicializado.');
    process.exit(1);
  }

  try {
    const response = await resend.emails.send({
      from: `Test Alertas Andes <${RESEND_FROM_EMAIL}>`,
      to: [ANDES_ALERT_EMAIL],
      subject: '🚨 Test de Notificación Resend - Sistema Andes',
      html: `
        <h2>⚠️ Prueba Exitosa de Resend</h2>
        <p>Este es un mensaje automático de prueba generado para verificar que las credenciales de Resend funcionan y tu dominio <strong>@ultim.pro</strong> está operativo.</p>
        <p>Si estás leyendo esto, las alertas en producción para el servicio de Andes llegarán correctamente.</p>
        <hr/>
        <p><small>Fecha de generación: ${new Date().toISOString()}</small></p>
      `,
    });
    
    console.log('✅ ¡Correo enviado con éxito!');
    console.log('Respuesta de Resend:', response);
  } catch (error) {
    console.error('❌ Ocurrió un error al enviar el correo:', error);
  }
}

testResendConnection();
