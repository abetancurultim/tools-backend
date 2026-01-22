import axios from 'axios';
import { ADMINFO_USER, ADMINFO_PASS, ADMINFO_URL } from '../config/env.js';

let adminfoToken = null;
let tokenExpirationTime = null;

/**
 * Obtiene el token de autenticación de Adminfo.
 * Si el token actual es válido y no ha expirado, lo reutiliza.
 */
async function getAdminfoAuthToken() {
    const now = Date.now();
    if (!adminfoToken || (tokenExpirationTime && now >= tokenExpirationTime)) {
        return refreshAdminfoToken();
    }
    return adminfoToken;
}

/**
 * Realiza la petición de autenticación para obtener un nuevo token.
 */
async function refreshAdminfoToken() {
    const usuario = ADMINFO_USER;
    const contrasena = ADMINFO_PASS;
    const url = `${ADMINFO_URL}/auths/autenticacion`;

    try {
        const response = await axios.post(url, {
            usuario,
            contrasena
        }, {
            headers: {
                'User-Agent': 'PostmanRuntime/7.36.0',
                'Accept': '*/*',
                'Content-Type': 'application/json'
            }
        });

        const token = response.data.token || response.data.access_token || response.data.datos?.token;
        
        if (!token) {
            throw new Error('No se recibió un token en la respuesta de autenticación');
        }

        adminfoToken = token;
        
        // Establecer un tiempo de expiración por defecto (ej. 1 hora menos 5 minutos de margen)
        tokenExpirationTime = Date.now() + (55 * 60 * 1000); 

        return adminfoToken;
    } catch (error) {
        console.error('Error al autenticar en Adminfo:', error?.response?.data || error.message);
        throw error;
    }
}

/**
 * Mapea el tipo de identificación al código numérico requerido por Adminfo.
 */
function mapTipoIdentificacion(tipo) {
    if (!tipo) return tipo;
    const map = {
        'CC': '1',
        'CE': '2',
        'NIT': '3',
        'TI': '4',
        'PP': '5',
        'IDC': '6',
        'DE': '7',
    };
    return map[tipo.toUpperCase()] || tipo;
}

/**
 * Consulta la información de un cliente (titular).
 * Corresponde al endpoint: GET /v2/deudores/titulares
 */
export async function consultaClientes(tipoIdentificacion, identificacion) {
    const token = await getAdminfoAuthToken();
    const url = `${ADMINFO_URL}/v2/deudores/titulares`;

    try {
        const response = await axios.get(url, {
            params: {
                tipoIdentificacion: mapTipoIdentificacion(tipoIdentificacion),
                identificacion
            },
            headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent': 'PostmanRuntime/7.36.0',
                'Accept': '*/*'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error en consultaClientes:', error?.response?.data || error.message);
        throw error;
    }
}

/**
 * Realiza el seguimiento de una gestión.
 * Corresponde al endpoint: POST /v5/seguimientos
 */
export async function realizarSeguimiento(data) {
    const token = await getAdminfoAuthToken();
    const url = `${ADMINFO_URL}/v5/seguimientos`;

    // Asegurar que el tipo de identificación sea el código numérico y establecer defaults para opcionales
    const body = {
        codigoCausal: '',
        idCampana: '',
        ...data, // Sobrescribe defaults si data trae valores
        tipoIdentificacion: mapTipoIdentificacion(data.tipoIdentificacion)
    };

    try {
        const response = await axios.post(url, body, {
            headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent': 'PostmanRuntime/7.36.0',
                'Accept': '*/*, application/json',
                'Content-Type': 'application/json'
            }
        });
        console.log('Seguimiento realizado con éxito en Adminfo');
        return response.data;
    } catch (error) {
        console.error('Error en realizarSeguimiento Adminfo:', error?.response?.data || error.message);
        throw error;
    }
}
