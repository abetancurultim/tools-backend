/**
 * Test Script: Crear Compromiso de Pago - Adminfo (Coltefinanciera)
 * 
 * Modos de uso:
 *   1. Llamada directa al servicio (sin servidor):
 *      node test_payment_agreement.js
 *
 *   2. Llamada HTTP al endpoint del servidor (servidor debe estar corriendo):
 *      node test_payment_agreement.js --http
 *
 * Asegúrate de que las variables de entorno estén configuradas en .env
 */

import dotenv from 'dotenv';
dotenv.config();

// ─── Payload de prueba ────────────────────────────────────────────────────────
const payload = {
  tipoIdentificacion: "1",
  identificacion: "123456789",
  idDatoContacto: "77630533",
  idObligacion: "999999999",
  grabador: "gestor_api",
  nota: "Prueba de gestion de compromisos",
  fechaPago: "2026-25-02",
  valorTotalPactado: "300000",
  cuotas: "3",
  codigoCausal: "",
  codigoGestion: "70084",
  codAbogado: "",
  canalGestion: "",
  tipoContacto: "ENT",
  canalActual: "TEL",
  acuerdo_pago: [
    { monto: "100000", fechaCompromiso: "2026-25-02" },
    { monto: "100000", fechaCompromiso: "2026-26-02" },
    { monto: "100000", fechaCompromiso: "2026-27-02" }
  ]
};

// ─── Modo 1: Llamada directa al servicio ─────────────────────────────────────
async function testDirectService() {
  console.log('\n========================================');
  console.log('  TEST DIRECTO AL SERVICIO adminfoService');
  console.log('========================================\n');

  const { crearCompromisoPago } = await import('./src/services/adminfoService.js');

  console.log('📤 Payload enviado:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n⏳ Llamando a crearCompromisoPago...\n');

  try {
    const result = await crearCompromisoPago(payload);
    console.log('\n✅ Respuesta exitosa de Adminfo:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ Error al crear compromiso de pago:');
    if (error?.response?.data) {
      console.error('Respuesta de Adminfo:', JSON.stringify(error.response.data, null, 2));
      console.error('Status HTTP:', error.response.status);
    } else {
      console.error(error.message);
    }
  }
}

// ─── Modo 2: Llamada HTTP al endpoint ────────────────────────────────────────
async function testHttpEndpoint() {
  const PORT = process.env.PORT || 3002;
  const API_KEY = process.env.API_KEY;
  const url = `http://localhost:${PORT}/api/adminfo/payment-agreement`;

  console.log('\n========================================');
  console.log('  TEST HTTP AL ENDPOINT');
  console.log(`  POST ${url}`);
  console.log('========================================\n');

  if (!API_KEY) {
    console.warn('⚠️  No se encontró API_KEY en .env. La petición puede ser rechazada.');
  }

  const { default: axios } = await import('axios');

  console.log('📤 Payload enviado:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n⏳ Enviando petición HTTP...\n');

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY || ''
      }
    });
    console.log('\n✅ Respuesta del servidor:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('\n❌ Error en la petición HTTP:');
    if (error?.response?.data) {
      console.error('Respuesta del servidor:', JSON.stringify(error.response.data, null, 2));
      console.error('Status HTTP:', error.response.status);
    } else {
      console.error(error.message);
    }
  }
}

// ─── Punto de entrada ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes('--http')) {
  testHttpEndpoint();
} else {
  testDirectService();
}
