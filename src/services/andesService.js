import soap from 'strong-soap';
import { ANDES_WSDL_TEST, ANDES_USER, ANDES_PASSWORD } from '../config/env.js';

const maskSoapPassword = (xml = '') => {
    return xml.replace(/(<wsse:Password[^>]*>)([\s\S]*?)(<\/wsse:Password>)/g, '$1***$3');
};

class AndesService {
    constructor() {
        this.client = null;
        this.wsdl = ANDES_WSDL_TEST;
    }

    async initClient() {
        if (!this.client) {
            const soapClient = soap.soap;
            return new Promise((resolve, reject) => {
                soapClient.createClient(this.wsdl, (err, client) => {
                    if (err) {
                        console.error('[AndesService] Error al inicializar el cliente SOAP:', err.message);
                        return reject(new Error('No se pudo inicializar el cliente SOAP para Andes'));
                    }

                    // Configurar WS-Security
                    const WSSecurity = soap.WSSecurity;
                    console.log(`[AndesService] Inicializando WSSecurity para usuario: ${ANDES_USER}`);
                    
                    const options = {
                        hasTimeStamp: false,
                        hasTokenCreated: false,
                        hasNonce: false,
                        passwordType: 'PasswordText'
                    };
                    
                    // Volvemos a ANDES_PASSWORD según tu instrucción
                    const wsSecurity = new WSSecurity(ANDES_USER, ANDES_PASSWORD, options);
                    
                    client.setSecurity(wsSecurity);

                    this.client = client;
                    
                    // debug request
                    client.on('request', (requestHtml) => {
                        const safeRequest = maskSoapPassword(requestHtml);
                        console.log('[SOAP-DEBUG] Request XML Enviado:\n', safeRequest);
                    });

                    console.log('[AndesService] SOAP Client inicializado para ambiente de pruebas.');
                    resolve(client);
                });
            });
        }
        return this.client;
    }

    async verificarEstadoServicio() {
        try {
            const client = await this.initClient();
            
            return new Promise((resolve, reject) => {
                // Restauramos el wrapper LoginRequest que sí era reconocido como procedimiento
                client.Login({ LoginRequest: { identificador: 'PruebaConexion' } }, (err, result, envelope, soapHeader) => {
                    if (err) {
                        console.error('[AndesService-LoginErro]', err.body || err);
                        return reject(err);
                    }
                    resolve({
                        estado: result.estado,
                        mensaje: result.mensaje
                    });
                });
            });
        } catch (error) {
            console.error('[AndesService] Error en verificarEstadoServicio:', error.message);
            throw error;
        }
    }

    // Paso 1: Solicitar Certificado y generar OTP
    async solicitarCertificado(datosFirmante) {
        try {
            const client = await this.initClient();
            
            const solicitudCertificadoRequest = {
                IdTipoDocumento: datosFirmante.idTipoDocumento || 1, // 1 es C.C por defecto
                Documento: datosFirmante.documento,
                PrimerNombre: datosFirmante.primerNombre,
                SegundoNombre: datosFirmante.segundoNombre || '',
                PrimerApellido: datosFirmante.primerApellido,
                SegundoApellido: datosFirmante.segundoApellido || '',
                Correo: datosFirmante.correo,
                Celular: datosFirmante.celular,
                Notificacion: typeof datosFirmante.notificacion === 'number' ? datosFirmante.notificacion : 1
            };

            const args = {
                SolicitudCertificadoRequest: solicitudCertificadoRequest
            };

            return new Promise((resolve, reject) => {
                client.SolicitudCertificado(args, (err, result) => {
                    if (err) return reject(err);
                    resolve({
                        estado: result.estado,
                        mensaje: result.mensaje
                    });
                });
            });
        } catch (error) {
            console.error('[AndesService] Error en solicitarCertificado:', error.message);
            throw error;
        }
    }

    // Paso 2: Ejecutar la firma con el OTP
    async firmarDocumento(documentoBase64, datosFirmante) {
        try {
            const client = await this.initClient();
            
            const firmaDocumentoRequest = {
                IdTipoDocumento: datosFirmante.idTipoDocumento || 1,
                Documento: datosFirmante.documento,
                CodigoOTP: datosFirmante.codigoOTP,
                Adjunto: documentoBase64,
                NombreAdjunto: datosFirmante.nombreAdjunto || 'documento_firmado',
                FirmaVisible: datosFirmante.firmaVisible || '1', // 1 para SI, 2 para NO
                Coordenadas: datosFirmante.coordenadasFirma || '80,20,150,60', // x, y, w, h
                ImagenFirma: datosFirmante.imagenFirma || '',
                Pagina: datosFirmante.pagina || 0, // 0 = ultima hoja
                Observaciones: datosFirmante.observaciones || 'Firma de prueba',
                TipoFirmaVis: typeof datosFirmante.tipoFirmaVis === 'number' ? datosFirmante.tipoFirmaVis : 1
            };

            const args = {
                FirmaDocumentoRequest: firmaDocumentoRequest
            };

            return new Promise((resolve, reject) => {
                client.FirmaDocumento(args, (err, result) => {
                    if (err) return reject(err);
                    resolve({
                        estado: result.estado,
                        mensaje: result.mensaje, // Este será Base 64 firmado si hay éxito
                        id: result.id
                    });
                });
            });
        } catch (error) {
            console.error('[AndesService] Error en firmarDocumento:', error.message);
            throw error;
        }
    }

    async descargarCertificado(idSolicitud) {
        try {
            const client = await this.initClient();
            
            return new Promise((resolve, reject) => {
                client.DescargarCertificado({
                    DescargarCertificadoRequest: {
                        IdSolicitudFirma: idSolicitud
                    }
                }, (err, result) => {
                    if (err) return reject(err);
                    resolve({
                        estado: result.estado,
                        mensaje: result.mensaje
                    });
                });
            });
        } catch (error) {
            console.error('[AndesService] Error en descargarCertificado:', error.message);
            throw error;
        }
    }
}

export default new AndesService();