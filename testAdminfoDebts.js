import axios from 'axios';

const PORT = 3002; // Asegúrate de que este puerto coincida con el que usa tu servidor
const BASE_URL = `http://localhost:${PORT}/api/v1`;

const testEndpoint = async () => {
    try {
        console.log(`Conectando a ${BASE_URL}/adminfo/get-debts...`);
        
        const payload = {
            identificacion: "1042346575"
        };
        
        console.log('Enviando payload:', payload);

        const response = await axios.post(`${BASE_URL}/adminfo/get-debts`, payload);
        
        console.log('✅ Éxito! Respuesta recibida:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ Error en la petición:');
        if (error.response) {
            // El servidor respondió con un status fuera del rango 2xx
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            // La petición fue hecha pero no se recibió respuesta
            console.error('No se recibió respuesta del servidor. ¿Está el servidor corriendo?');
        } else {
            // Algo sucedió al configurar la petición
            console.error('Error Message:', error.message);
        }
    }
};

testEndpoint();
