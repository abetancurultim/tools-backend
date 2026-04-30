import dotenv from 'dotenv';
import { handleGetFlamingoDebts } from './src/controllers/flamingoController.js';

dotenv.config();

const runTest = async () => {
  console.log('Consultando deudas Flamingo para la cédula 1005093339...\n');

  const req = {
    body: {
      tipoIdentificacion: "1",
      identificacion: "1005093339"
    }
  };

  const res = {
    status: function(code) {
      console.log(`Status Code: ${code}`);
      return this;
    },
    json: function(data) {
      console.log('--- RESPUESTA DEL ENDPOINT ---');
      console.log(JSON.stringify(data, null, 2));
    }
  };

  try {
    await handleGetFlamingoDebts(req, res);
  } catch (error) {
    console.error('Error ejecutando la prueba:', error);
  }
};

runTest();
