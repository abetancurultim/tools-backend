/**
 * Test Script: Crear Compromiso de Pago - Adminfo (Flamingo)
 *
 * Uso:
 *   node test_flamingo_payment_agreement.js
 *
 * Asegúrate de que las variables de entorno estén configuradas en .env
 */

import dotenv from 'dotenv';
dotenv.config();

// ─── Payload de prueba ────────────────────────────────────────────────────────
const payload = {
  tipoIdentificacion: "1",
  identificacion: "21849246",
  idDatoContacto: "9477959",
  idObligacion: "7800833",
  grabador: "gestor_api",
  nota: "Prueba de gestion de compromisos Flamingo",
  fechaPago: "2026-02-25",
  valorTotalPactado: "300000",
  cuotas: "3",
  codigoCausal: "",
  codigoGestion: "11111",
  codAbogado: "",
  canalGestion: "",
  tipoContacto: "ENT",
  canalActual: "TEL",
  acuerdo_pago: [
    { monto: "100000", fechaCompromiso: "2026-02-25" },
    { monto: "100000", fechaCompromiso: "2026-03-25" },
    { monto: "100000", fechaCompromiso: "2026-04-25" }
  ]
};

// ─── Modo 1: Llamada directa al servicio ─────────────────────────────────────
async function testDirectService() {
  console.log('\n========================================');
  console.log('  TEST DIRECTO AL SERVICIO flamingoService');
  console.log('========================================\n');

  const { crearCompromisoPagoFlamingo } = await import('./src/services/flamingoService.js');

  console.log('📤 Payload enviado:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n⏳ Llamando a crearCompromisoPagoFlamingo...\n');

  try {
    const result = await crearCompromisoPagoFlamingo(payload);
    console.log('\n✅ Respuesta exitosa de Adminfo (Flamingo):');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ Error al crear compromiso de pago (Flamingo):');
    if (error?.response?.data) {
      console.error('Respuesta de Adminfo:', JSON.stringify(error.response.data, null, 2));
      console.error('Status HTTP:', error.response.status);
    } else {
      console.error(error.message);
    }
  }
}

// ─── Punto de entrada ─────────────────────────────────────────────────────────
testDirectService();
