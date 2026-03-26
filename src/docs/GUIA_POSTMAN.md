# Guía de Pruebas de API con Postman - Ultim Tools

Esta guía detalla cómo probar los endpoints de la API de Ultim Tools utilizando Postman.

## Configuración General

*   **Base URL:** `http://localhost:3002` (o la URL de despliegue correspondiente)
*   **Autenticación:** Todos los endpoints están protegidos por una API Key enviada en los headers.
    *   **Header Key:** `x-api-key`
    *   **Header Value:** El valor configurado en la variable de entorno `API_KEY` (ej. `12345`).

---

## 1. Consultar Deudas
**Endpoint:** `POST /api/v1/get-debts`

Permite consultar las obligaciones pendientes de un cliente utilizando su número de documento.

### Headers
| Key | Value |
| :--- | :--- |
| x-api-key | `{{API_KEY}}` |
| Content-Type | `application/json` |

### Body (JSON)
```json
{
  "documentId": "830120063"
}
```

### Parámetros
*   `documentId` (String, Requerido): Número de identificación del cliente.

---

## 2. Procesar Llamada Finalizada (Webhook ElevenLabs)
**Endpoint:** `POST /api/v1/process-call`

Este endpoint ahora utiliza validación **HMAC SHA256** para simular el comportamiento de ElevenLabs.

### Headers
| Key | Value |
| :--- | :--- |
| X-ElevenLabs-Signature-256 | `<FIRMA_GENERADA>` |
| Content-Type | `application/json` |

### Cómo probar en Postman:

Para probar este endpoint, necesitas generar una firma válida basada en el cuerpo del JSON y tu secreto.

1.  En Postman, ve a la pestaña **Pre-request Script** de la petición.
2.  Pega el siguiente código (ajusta el secreto):

```javascript
const secret = "wsec_be67957e54bbfcd6aaa281dfe3ae0a67b4030bb56ad41c8f0dd5a0435db0acdb";
const body = pm.request.body.raw;
const hash = CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex);
pm.request.headers.add({key: 'X-ElevenLabs-Signature-256', value: hash});
```

3.  En el **Body (JSON)**, usa este ejemplo:
```json
{
  "callSid": "CA12345abcde6789",
  "name": "Juan Pérez",
  "number": "3001234567",
  "transcript": "El cliente está interesado en el plan premium de seguros.",
  "timestamp": "2025-12-26T10:00:00Z"
}
```

### Parámetros
*   `callSid` (String, Requerido): Identificador único de la llamada (Twilio/ElevenLabs).
*   `name` (String, Requerido): Nombre del cliente.
*   `number` (String, Opcional): Número de teléfono del cliente.
*   `transcript` (String, Opcional): Texto conversado durante la llamada.

---

## 3. Notificar Interés (Lead de Seguro)
**Endpoint:** `POST /api/v1/insurance-interest`

Registra un interés inicial por parte de un cliente (Lead caliente) y envía una notificación por correo al supervisor.

### Headers
| Key | Value |
| :--- | :--- |
| x-api-key | `{{API_KEY}}` |
| Content-Type | `application/json` |

### Body (JSON)
```json
{
  "clientName": "María López",
  "clientPhone": "3109876543",
  "interestLevel": "alto",
  "notes": "Quiere más información sobre cobertura de vida.",
  "contactPreference": "WhatsApp",
  "transcript": "Hablaron sobre los beneficios del seguro de vida.",
  "callSid": "CA999888777"
}
```

### Parámetros
*   `clientName` (String, Requerido): Nombre completo del interesado.
*   `clientPhone` (String, Requerido): Teléfono de contacto.
*   `interestLevel` (String, Opcional): Nivel de interés (`alto`, `medio`, `bajo`). Por defecto es `alto`.
*   `contactPreference` (String, Opcional): Cómo prefiere ser contactado.
*   `notes` (String, Opcional): Observaciones adicionales.

---

## 4. Registrar y Activar Cliente (Venta Cerrada)
**Endpoint:** `POST /api/v1/insurance-registration`

Registra formalmente al cliente en la base de datos (Supabase), envía correos de activación al supervisor y un correo de bienvenida al cliente.

### Headers
| Key | Value |
| :--- | :--- |
| x-api-key | `{{API_KEY}}` |
| Content-Type | `application/json` |

### Body (JSON)
```json
{
  "name": "Juan Pérez",
  "document_id": "830120063",
  "phone_number": "3001234567",
  "email": "juan.perez@example.com",
  "callSid": "CA12345",
  "transcript": "Venta cerrada tras explicar beneficios.",
  "timestamp": "2025-12-26T10:05:00Z"
}
```

### Parámetros
*   `name` (String, Requerido): Nombre completo del cliente.
*   `document_id` (String, Requerido): Número de cédula o identificación.
*   `phone_number` (String, Requerido): Teléfono de contacto.
*   `email` (String, Requerido): Correo electrónico para envío de certificados.
*   `callSid` (String, Opcional): ID de la llamada de cierre.
*   `transcript` (String, Opcional): Transcripción de la venta.
