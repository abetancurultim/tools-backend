import axios from 'axios';
import { FLAMINGO_USER, FLAMINGO_PASS, ADMINFO_URL } from '../config/env.js';

let flamingoToken = null;
let tokenExpirationTime = null;

/**
 * Obtiene el token de autenticación de Adminfo para Flamingo.
 * Si el token actual es válido y no ha expirado, lo reutiliza.
 */
async function getFlamingoAuthToken() {
    const now = Date.now();
    if (!flamingoToken || (tokenExpirationTime && now >= tokenExpirationTime)) {
        return refreshFlamingoToken();
    }
    return flamingoToken;
}

/**
 * Realiza la petición de autenticación para obtener un nuevo token.
 */
async function refreshFlamingoToken() {
    const usuario = FLAMINGO_USER;
    const contrasena = FLAMINGO_PASS;
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
            throw new Error('No se recibió un token en la respuesta de autenticación de Flamingo');
        }

        flamingoToken = token;
        
        // Establecer un tiempo de expiración por defecto (ej. 1 hora menos 5 minutos de margen)
        tokenExpirationTime = Date.now() + (55 * 60 * 1000); 

        return flamingoToken;
    } catch (error) {
        console.error('Error al autenticar en Adminfo (Flamingo):', error?.response?.data || error.message);
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
 * Consulta la información de un cliente (titular) usando credenciales Flamingo.
 * Corresponde al endpoint: GET /v2/deudores/titulares
 */
export async function consultaClientesFlamingo(tipoIdentificacion, identificacion) {
    const token = await getFlamingoAuthToken();
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
        console.error('Error en consultaClientesFlamingo:', error?.response?.data || error.message);
        throw error;
    }
}

/**
 * Realiza el seguimiento de una gestión usando credenciales Flamingo.
 * Corresponde al endpoint: POST /v5/seguimientos
 */
export async function realizarSeguimientoFlamingo(data) {
    const token = await getFlamingoAuthToken();
    const url = `${ADMINFO_URL}/v5/seguimientos`;

    // Mapeo selectivo de campos comunes usados en las herramientas del agente
    // para asegurar compatibilidad con los nombres esperados por el API Legacy de Adminfo (v5)
    const normalizedData = {
        ...data,
        nrodoc: data.numCredito || data.nrodoc, // v5 suele usar nrodoc para el # de crédito
        consrefer: data.idDatoContacto || data.consrefer // v5 usa consrefer para el ID de contacto
    };

    // Asegurar que el tipo de identificación sea el código numérico y establecer defaults para opcionales
    const body = {
        codigoCausal: '',
        idCampana: '',
        ...normalizedData, // Sobrescribe defaults si data trae valores
        tipoIdentificacion: mapTipoIdentificacion(normalizedData.tipoIdentificacion)
    };

    console.log('Enviando seguimiento a Adminfo (Flamingo):', JSON.stringify(body, null, 2));

    try {
        const response = await axios.post(url, body, {
            headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent': 'PostmanRuntime/7.36.0',
                'Accept': '*/*, application/json',
                'Content-Type': 'application/json'
            }
        });
        console.log('Seguimiento realizado con éxito en Adminfo (Flamingo)');
        return response.data;
    } catch (error) {
        console.error('Error en realizarSeguimientoFlamingo:', error?.response?.data || error.message);
        throw error;
    }
}
