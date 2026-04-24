/**
 * Simula el body exacto que manda ElevenLabs al endpoint /adminfo/save-tracking
 * Ejecutar: node test_elevenlabs_tracking.js
 *
 * Asegúrate de tener el servidor corriendo: npm run dev
 */

const SERVER_URL = 'http://localhost:3002/api/v1';

const elevenLabsBody = {
  identificacion: "71333558",
  numCredito: "102068464",
  descripcion: "PLAN DE PAGO TOTAL - Pago total 277420 el 23 abril",
  idDatoContacto: "68031015",
  grabador: "Maria Luisa TEST",
  codigoGestion: "70091"
};

async function post(label, body) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${label}`);
  console.log('Body enviado:', JSON.stringify(body, null, 2));
  console.log('-'.repeat(60));

  try {
    const res = await fetch(`${SERVER_URL}/adminfo/save-tracking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => null);
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log('Respuesta:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error de red:', err.message);
  }
}

(async () => {
  await post('Body de ElevenLabs (incompleto)', elevenLabsBody);
  await post('Body de Postman (completo)', postmanBody);
})();
