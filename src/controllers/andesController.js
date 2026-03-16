import AndesService from '../services/andesService.js';

export const verificarEstado = async (req, res) => {
    try {
        const estado = await AndesService.verificarEstadoServicio();
        res.status(200).json({ success: true, data: estado });
    } catch (error) {
        console.error('Error verificando estado Andes:', error);
        res.status(500).json({ success: false, error: 'Error interno en WS Andes' });
    }
};

export const solicitarFirma = async (req, res) => {
    try {
        const { datosFirmante } = req.body;
        
        // Paso 1: Solicitar la emisión del certificado (Esto deberia generar el OTP)
        if (!datosFirmante) {
            return res.status(400).json({ success: false, error: 'Datos del firmante son obligatorios.' });
        }

        const respuesta = await AndesService.solicitarCertificado(datosFirmante);
        
        // Estado 0 es ok en Andes
        if (respuesta.estado === 0) {
            return res.status(200).json({ success: true, data: respuesta });
        } else {
            return res.status(400).json({ success: false, error: respuesta.mensaje, estadoAndes: respuesta.estado });
        }
    } catch (error) {
        console.error('Error al solicitar certificado/OTP:', error);
        res.status(500).json({ success: false, error: 'Error procesando solicitud de certificado Andes' });
    }
};

export const confirmarFirma = async (req, res) => {
    try {
         const { documentoBase64, datosFirmante, codigoOTP } = req.body;
         
         if (!documentoBase64 || !datosFirmante || !codigoOTP) {
            return res.status(400).json({ success: false, error: 'El documento, código OTP y datos del firmante son obligatorios.' });
         }

         // Añadir el código OTP a los datos para la firma final
         const firmaDatos = { ...datosFirmante, codigoOTP };

         const respuesta = await AndesService.firmarDocumento(
             documentoBase64,
             firmaDatos
         );

         if (respuesta.estado === 0) {
             return res.status(200).json({ success: true, data: respuesta });
         } else {
             return res.status(400).json({ success: false, error: respuesta.mensaje, estadoAndes: respuesta.estado });
         }
    } catch (error) {
        console.error('Error confirmando firma OTP:', error);
        res.status(500).json({ success: false, error: 'Error confirmando firma Andes' });
    }
};

export const consultarTestigo = async (req, res) => {
    try {
        const { idSolicitud } = req.params;
        
        if (!idSolicitud) {
            return res.status(400).json({ success: false, error: 'Id de solicitud requerido' });
        }

        const respuesta = await AndesService.descargarCertificado(idSolicitud);
        
        if (respuesta.estado === 0) {
             // La base 64 del testigo de firma viene en la llave mensaje
             return res.status(200).json({ success: true, testigoBase64: respuesta.mensaje });
        } else {
             return res.status(400).json({ success: false, error: respuesta.mensaje });
        }
    } catch (error) {
        console.error('Error al descargar certificado:', error);
        res.status(500).json({ success: false, error: 'Error consultando testigo de Andes' });
    }
};