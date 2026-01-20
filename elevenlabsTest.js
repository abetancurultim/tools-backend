/**
 * Script de prueba para el endpoint de ElevenLabs.
 * Ejecución: node elevenlabsTest.js <CONVERSATION_ID>
 */
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3002;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

// El primer argumento es el conversation_id
const conversationId = 'conv_1101kfedyybtfshvcxecw3d864wx';

console.log(`--- Test ElevenLabs Endpoint ---`);
console.log(`Base URL: ${BASE_URL}`);
console.log(`Conversation ID: ${conversationId}\n`);

async function runTest() {
  try {
    const url = `${BASE_URL}/elevenlabs/conversation/${conversationId}`;
    console.log(`Probando GET ${url}...`);

    const response = await axios.get(url);

    console.log('\n✅ ÉXITO: Respuesta recibida');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('\n❌ ERROR:');
    if (error.response) {
      // El servidor respondió con un status con el que no se puede trabajar
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // La petición se hizo pero no hubo respuesta
      console.error('No se recibió respuesta del servidor. ¿Está el servidor corriendo?');
    } else {
      // Algo pasó al configurar la petición
      console.error('Mensaje:', error.message);
    }
    console.error('\nNota: Asegúrate de que el servidor esté corriendo (' + PORT + ') y que el conversationId sea válido.');
  }
}

runTest();
