import soap from "strong-soap";
import {
  ANDES_WSDL_PROD,
  ANDES_WSDL_TEST,
  ANDES_USER,
  ANDES_PASSWORD_SHA1,
  ANDES_ALERT_EMAIL,
  RESEND_FROM_EMAIL,
} from "../config/env.js";
import { resend } from "../config/clients.js";

const maskSoapPassword = (xml = "") => {
  return xml.replace(
    /(<wsse:Password[^>]*>)([\s\S]*?)(<\/wsse:Password>)/g,
    "$1***$3",
  );
};

class AndesService {
  constructor() {
    this.client = null;
    this.wsdl = ANDES_WSDL_PROD;
    // this.wsdl = ANDES_WSDL_TEST;
  }

  async _notifyError(operacion, error, payload = null) {
    try {
      if (!resend) return;

      const htmlContent = `
        <h2>🚨 Alerta Crítica en Andes SCD</h2>
        <p><strong>Operación:</strong> ${operacion}</p>
        <p><strong>Fecha:</strong> ${new Date().toISOString()}</p>
        <hr/>
        <h3>Error Details:</h3>
        <pre>${error?.message || JSON.stringify(error)}</pre>
        ${payload ? `<h3>Payload (sanitizado):</h3><pre>${JSON.stringify(payload, null, 2)}</pre>` : ''}
      `;

      await resend.emails.send({
        from: `Alertas Andes <${RESEND_FROM_EMAIL}>`,
        to: [ANDES_ALERT_EMAIL],
        subject: `🚨 Error en API Andes: ${operacion}`,
        html: htmlContent,
      });
      console.log(`[AndesService] Alerta de error enviada a ${ANDES_ALERT_EMAIL}`);
    } catch (notifyErr) {
      console.error("[AndesService] Error al enviar notificación con Resend:", notifyErr.message);
    }
  }

  async initClient() {
    if (!this.client) {
      const soapClient = soap.soap;
      return new Promise((resolve, reject) => {
        soapClient.createClient(this.wsdl, { timeout: 25000 }, (err, client) => {
          if (err) {
            console.error(
              "[AndesService] Error al inicializar el cliente SOAP:",
              err.message,
            );
            return reject(
              new Error("No se pudo inicializar el cliente SOAP para Andes"),
            );
          }

          // Configurar WS-Security
          const WSSecurity = soap.WSSecurity;
          console.log(
            `[AndesService] Inicializando WSSecurity para usuario: ${ANDES_USER}`,
          );

          const options = {
            hasTimeStamp: false,
            hasTokenCreated: true,
            hasNonce: true,
            passwordType: "PasswordText",
          };

          const wsSecurity = new WSSecurity(
            ANDES_USER,
            ANDES_PASSWORD_SHA1,
            options,
          );

          client.setSecurity(wsSecurity);

          // Timeout por llamada (strong-soap lo expone en HttpClient)
          if (client.HttpClient) {
            client.HttpClient.options = {
              ...client.HttpClient.options,
              timeout: 25000,
            };
          }

          this.client = client;

          client.on("request", (requestHtml) => {
            const safeRequest = maskSoapPassword(requestHtml);
            console.log("[SOAP-DEBUG] Request XML Enviado:\n", safeRequest);
          });

          client.on("response", (body) => {
            // Truncamos para no volcar el base64 completo en logs
            const truncated = typeof body === "string" ? body.substring(0, 800) : JSON.stringify(body).substring(0, 800);
            console.log("[SOAP-DEBUG] Response recibido (primeros 800 chars):\n", truncated);
          });

          console.log(
            "[AndesService] SOAP Client inicializado.",
          );
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
        client.Login(
          { LoginRequest: { identificador: "PruebaConexion" } },
          (err, result, envelope, soapHeader) => {
            if (err) {
              console.error("[AndesService-LoginErro]", err.body || err);
              return reject(err);
            }
            resolve({
              estado: result.estado,
              mensaje: result.mensaje,
            });
          },
        );
      });
    } catch (error) {
      console.error(
        "[AndesService] Error en verificarEstadoServicio:",
        error.message,
      );
      this._notifyError('verificarEstadoServicio', error);
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
        SegundoNombre: datosFirmante.segundoNombre || "",
        PrimerApellido: datosFirmante.primerApellido,
        SegundoApellido: datosFirmante.segundoApellido || "",
        Correo: datosFirmante.correo,
        Celular: datosFirmante.celular,
        Notificacion:
          typeof datosFirmante.notificacion === "number"
            ? datosFirmante.notificacion
            : 1,
      };

      const args = {
        SolicitudCertificadoRequest: solicitudCertificadoRequest,
      };

      return new Promise((resolve, reject) => {
        client.SolicitudCertificado(args, (err, result) => {
          if (err) {
            this.client = null;
            return reject(err);
          }
          const respuesta = { estado: result.estado, mensaje: result.mensaje };
          if (respuesta.estado !== 0) {
            this._notifyError(`solicitarCertificado [estado ${respuesta.estado}]`, new Error(respuesta.mensaje), datosFirmante);
          }
          resolve(respuesta);
        });
      });
    } catch (error) {
      this.client = null;
      console.error(
        "[AndesService] Error en solicitarCertificado:",
        error.message,
      );
      this._notifyError('solicitarCertificado', error, datosFirmante);
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
        NombreAdjunto: datosFirmante.nombreAdjunto || "documento_firmado",
        FirmaVisible: datosFirmante.firmaVisible || "1", // 1 para SI, 2 para NO
        Coordenadas: datosFirmante.coordenadasFirma || "80,20,150,60", // x, y, w, h
        ImagenFirma: datosFirmante.imagenFirma || "",
        Pagina: datosFirmante.pagina || 0, // 0 = ultima hoja
        Observaciones: datosFirmante.observaciones || "Firma de prueba",
        TipoFirmaVis:
          typeof datosFirmante.tipoFirmaVis === "number"
            ? datosFirmante.tipoFirmaVis
            : 1,
      };

      const args = {
        FirmaDocumentoRequest: firmaDocumentoRequest,
      };

      return new Promise((resolve, reject) => {
        client.FirmaDocumento(args, (err, result) => {
          if (err) {
            this.client = null;
            return reject(err);
          }
          if (!result) {
            this.client = null;
            return reject(
              new Error("Andes devolvió respuesta vacía (result undefined)"),
            );
          }
          console.log("[ANDES-DEBUG] firmarDocumento keys:", Object.keys(result || {}));
          console.log("[ANDES-DEBUG] estado:", result?.estado, "| id:", result?.id);
          const respuesta = { estado: result.estado, mensaje: result.mensaje, id: result.id };
          if (respuesta.estado !== 0) {
            const safePayload = { ...datosFirmante, adjunto: '[BASE64_OMITIDO]' };
            this._notifyError(`firmarDocumento [estado ${respuesta.estado}]`, new Error(respuesta.mensaje), safePayload);
          }
          resolve(respuesta);
        });
      });
    } catch (error) {
      this.client = null;
      console.error("[AndesService] Error en firmarDocumento:", error.message);
      
      // Creamos un payload seguro excluyendo el adjunto base64 completo
      const safePayload = { ...datosFirmante, adjunto: datosFirmante.adjunto ? '[BASE64_OMITIDO]' : undefined };
      this._notifyError('firmarDocumento', error, safePayload);

      throw error;
    }
  }

  async descargarCertificado(idSolicitud) {
    try {
      const client = await this.initClient();

      return new Promise((resolve, reject) => {
        client.DescargarCertificado(
          {
            DescargarCertificadoRequest: {
              IdSolicitudFirma: idSolicitud,
            },
          },
          (err, result) => {
            if (err) {
              this.client = null;
              return reject(err);
            }
            // Log para diagnosticar qué campos devuelve Andes realmente
            console.log("[ANDES-DEBUG] descargarCertificado keys:", Object.keys(result || {}));
            console.log("[ANDES-DEBUG] estado:", result?.estado, "| mensaje (100c):", String(result?.mensaje || "").substring(0, 100));
            const respuesta = { estado: result.estado, mensaje: result.mensaje };
            if (respuesta.estado !== 0) {
              this._notifyError(`descargarCertificado [estado ${respuesta.estado}]`, new Error(respuesta.mensaje), { idSolicitud });
            }
            resolve(respuesta);
          },
        );
      });
    } catch (error) {
      this.client = null;
      console.error(
        "[AndesService] Error en descargarCertificado:",
        error.message,
      );
      this._notifyError('descargarCertificado', error, { idSolicitud });
      throw error;
    }
  }
}

export default new AndesService();
