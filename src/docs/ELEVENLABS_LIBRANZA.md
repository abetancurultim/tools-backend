# Libranza por llamada de ElevenLabs

Este flujo es independiente del chat de WhatsApp y usa **únicamente** `libranza_template.pdf`.
Las tres plantillas actuales de CASUR, CREMIL y Fiduprevisora son idénticas (SHA-256
`A13224BB50D45545334C751E775644F0186F4EA3A09966AC45B9B4DFBC65222B`).
El PDF incluido en `src/templates/` es una copia exacta.

## Requisitos antes de activar

1. La tabla `elevenlabs_libranza_sessions` ya fue creada por el usuario en el
   proyecto Supabase de WhatsApp, identificado en este backend por
   `SUPABASE_URL_VIDADEUDOR`. El flujo solo accede a esa tabla y al RPC existente
   `increment_libranza_counter()`. Configurar
   `SUPABASE_SERVICE_ROLE_VIDADEUDOR` con una clave `service_role` **de ese
   mismo proyecto**, solo en el servidor. `SUPABASE_KEY_VIDADEUDOR` es una clave
   `anon` y no puede acceder a la tabla protegida; no cambiar sus permisos.
2. Los PDF preparados y firmados se mantienen en memoria durante 15 minutos,
   como en el flujo de WhatsApp. No se usa S3 ni Firebase para este documento.
   El PDF preparado puede reconstruirse tras un reinicio a partir de los datos,
   la fecha y la huella de la sesión. El PDF ya firmado no se reconstruye: si se
   pierde antes de entregar los correos, requiere conciliación humana.
3. Configurar `ELEVENLABS_LIBRANZA_API_KEY` y crear en ElevenLabs una conexión
   secreta que envíe `x-elevenlabs-libranza-key`. El correo sale por el cliente
   Resend existente (`RESEND_KEY`) desde `notificaciones@cooperactiva.com.co`;
   comprobar que ese remitente esté verificado en la cuenta del backend.
4. Andes se mantiene en el WSDL de producción configurado en `andesService.js`.
   Este flujo envía `Notificacion: 2` para SMS, el valor opuesto al correo `1`
   utilizado hoy por WhatsApp. El OTP va al celular **capturado y confirmado
   en esa llamada**, no a un número fijo. Para probar el endpoint se puede usar
   `+573045655669` como celular de una sesión de prueba, sin codificar ese número
   como destino general. No solicitar OTP ni firmar documentos de clientes reales
   durante la prueba controlada sin autorización y verificación de identidad.
5. Temporalmente, **ambos correos** (copia orientada al cliente y aviso interno)
   se envían exclusivamente a `alejandro.b@ultimmarketing.com`, sin CC ni BCC.
   El correo suministrado a Andes también es ese buzón de prueba; el correo real
   capturado se conserva en la sesión para la futura activación. Antes de usar
   este flujo con clientes reales hay que revisar y activar deliberadamente los
   destinatarios finales; el correo de prueba recibe datos y PDF firmados.
6. Las cinco tools webhook se configuraron únicamente en la rama ElevenLabs
   `firma-libranza` del agente `COOPERACTIVA-BP-LUCIA-VENTAS-11L-DEV`.
   La rama principal conserva la derivación a WhatsApp y el 100 % del tráfico;
   `firma-libranza` sigue en 0 %. Las URLs usan el túnel ngrok temporal y habrá
   que actualizarlas si cambia su dirección.
7. En la prueba del 25 de septiembre de 2026 Andes aceptó `Notificacion: 2` y
   el SMS llegó al número autorizado. El texto mostró el remitente
   **GEM Marketing Colombia**; el backend no define ese texto. Confirmar con
   Andes la marca visible antes de usar el flujo con clientes reales.

## Herramientas webhook de ElevenLabs

Todas requieren `x-elevenlabs-libranza-key` y retornan `{ success, data }`.
La firma solo se considera terminada cuando el estado es `SIGNED` o `DELIVERED`.

### `POST /api/v1/elevenlabs/libranzas/preparar`

```json
{
  "conversationId": "conv_12345678",
  "primerNombre": "Ana",
  "segundoNombre": "María",
  "primerApellido": "Pérez",
  "segundoApellido": "Gómez",
  "tipoIdentificacion": "CC",
  "numeroIdentificacion": "12345678",
  "celular": "3001234567",
  "correo": "ana@example.com",
  "direccionResidencia": "Calle 1 # 2-3",
  "fondoPension": "CASUR",
  "aceptacionVerbalConfirmada": true
}
```

Requiere que el agente haya explicado las condiciones y obtenido aceptación
verbal. El backend conserva el momento de esa confirmación. Antes del piloto,
configurar la conservación de la grabación y transcripción de ElevenLabs como
evidencia de la aceptación; este backend todavía no recibe ese webhook.
Retorna el estado y el número de libranza, nunca el PDF Base64.

### `POST /api/v1/elevenlabs/libranzas/solicitar-otp-sms`

```json
{ "conversationId": "conv_12345678" }
```

Envía una sola solicitud a Andes al celular de la sesión. Si ya existe un OTP con menos de cinco minutos,
devuelve el estado sin emitir otro. Tras vencer, permite solicitar uno nuevo.
Si una llamada a Andes queda sin respuesta, el estado `OTP_REQUESTING` requiere
conciliación antes de repetir, pues Andes podría haber enviado el SMS.

### `POST /api/v1/elevenlabs/libranzas/firmar`

```json
{ "conversationId": "conv_12345678", "codigoOTP": "12345678" }
```

Firma el PDF preparado con Andes; conserva el PDF firmado temporalmente y registra el ID
de solicitud de Andes. Máximo tres intentos por OTP. Una respuesta incierta deja
`SIGNING` para conciliación: no se firma dos veces a ciegas.

### `POST /api/v1/elevenlabs/libranzas/entregar`

```json
{ "conversationId": "conv_12345678" }
```

Obtiene el certificado de firma de Andes. Durante las pruebas envía **ambos
mensajes solo a Alejandro**: el mensaje orientado al cliente adjunta la libranza
firmada y el aviso interno adjunta también el certificado de Andes. No envía a
la distribución interna de WhatsApp ni al correo del cliente. El aviso indica que solo se firmó la
libranza y pide contactar al cliente lo antes posible para coordinar los demás
documentos. Si Andes no devuelve el certificado, no envía ninguno de los correos.
No se envía welcome kit porque el expediente aún no está completo. Tras iniciar
el envío, un resultado incierto queda en `DELIVERING` para conciliación y evita
reenvíos automáticos potencialmente duplicados.

### `GET /api/v1/elevenlabs/libranzas/{conversationId}/estado`

Consulta estado, número de libranza, últimos cuatro dígitos del celular,
intentos e ID de Andes. No expone datos personales completos ni el PDF.
La tool de ElevenLabs usa el equivalente `POST /api/v1/elevenlabs/libranzas/estado`
con `{ "conversationId": "..." }` para recibir el ID de conversación como variable
dinámica en el cuerpo.

## Estados

`PREPARING → READY → OTP_REQUESTING → OTP_SENT → SIGNING → SIGNED → DELIVERING → DELIVERED`.
También existen `PREPARATION_FAILED`, `OTP_EXPIRED` y `SIGNATURE_FAILED`
(PDF rechazado por Andes, requiere revisión técnica). Los estados de solicitud
o firma incierta se conservan para revisión humana. Un fallo antes de empezar a
enviar correos vuelve a `SIGNED`; una entrega incierta conserva `DELIVERING`.
