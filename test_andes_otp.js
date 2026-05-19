/**
 * Script manual para probar la solicitud de OTP a Andes SCD.
 * Uso: node test_andes_otp.js
 *
 * Requiere en .env:
 *   ANDES_USER, ANDES_PASSWORD_SHA1, ANDES_WSDL_PROD (URL WSDL de producción)
 */

import dotenv from 'dotenv';
dotenv.config();

import AndesService from './src/services/andesService.js';

// Ajusta estos datos al firmante de prueba
const datosFirmante = {
  idTipoDocumento: 1,       // 1 = Cédula de Ciudadanía
  documento: '1143939192',   // <-- cambia al documento real de prueba
  primerNombre: 'Alejandro',
  segundoNombre: '',
  primerApellido: 'Betancur',
  segundoApellido: '',
  correo: 'alejandro.b@ultimmarketing.com',
  celular: '3045655669',
  notificacion: 1,          // 1 = SMS, 2 = Email (según docs de Andes)
};

console.log('WSDL activo:', AndesService.wsdl);
console.log('Usuario Andes:', process.env.ANDES_USER);
console.log('Enviando solicitud de OTP...\n');

try {
  const respuesta = await AndesService.solicitarCertificado(datosFirmante);
  console.log('Respuesta Andes:', JSON.stringify(respuesta, null, 2));

  if (respuesta.estado === 0) {
    console.log('\n✓ OTP solicitado exitosamente. El firmante debería recibir el código.');
  } else {
    console.log('\n✗ Andes respondió con error. Revisar estado y mensaje arriba.');
  }
} catch (err) {
  console.error('\nError al conectar con Andes:', err.message);
  if (err.body) console.error('SOAP body:', err.body);
}
