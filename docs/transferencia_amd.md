# Endpoint de Transferencia con AMD — Implementación Backend

## Contexto

Un endpoint que recibe la invocación del server tool de ElevenLabs, ejecuta el dial hacia el abogado con AMD activado en Twilio, evalúa el resultado y le notifica al agente activo si la transferencia falló para que retome al lead.

**Flujo:**
```
ElevenLabs (server tool) → Tu backend → Twilio Dial con AMD
                                               ↓
                                     ¿Humano contestó?
                                     Sí  → lead conectado, correo confirmación
                                     No  → notifica agente activo → IA retoma lead
```

---

## Paso 1 — Dependencias

Verifica que tienes `twilio` en tu proyecto. Si no:

```bash
npm install twilio
```

Agrega estas variables a tu `.env`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+17207067757
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BASE_URL=https://tu-dominio.com/api
```

---

## Paso 2 — Estructura de archivos a crear

Ajusta las rutas según la estructura existente de tu proyecto:

```
/routes
  transferencia.routes.js
/controllers
  transferencia.controller.js
/services
  twilio.service.js
  elevenlabs.service.js
/webhooks
  twilio-amd.webhook.js
```

---

## Paso 3 — `twilio.service.js`

Ejecuta el dial saliente hacia el abogado con AMD activado:

```javascript
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Marca al abogado con AMD activado.
 * @param {string} numeroAbogado - Número destino en formato E.164
 * @param {string} numeroLead    - Caller ID original del lead
 * @param {string} callbackUrl  - URL pública de tu webhook AMD
 */
async function marcarAbogadoConAMD({ numeroAbogado, numeroLead, callbackUrl }) {
  const llamada = await client.calls.create({
    to: numeroAbogado,
    from: process.env.TWILIO_PHONE_NUMBER,
    machineDetection: 'Enable',
    asyncAmd: 'true',
    asyncAmdStatusCallback: callbackUrl,
    asyncAmdStatusCallbackMethod: 'POST',
    // Mientras Twilio espera el veredicto AMD el abogado escucha silencio.
    // Una vez que AMD responde, el webhook decide qué hacer.
    twiml: `<Response><Pause length="30"/></Response>`,
    statusCallback: callbackUrl + '/status',
    statusCallbackMethod: 'POST',
    statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
  });

  return llamada.sid;
}

module.exports = { marcarAbogadoConAMD };
```

---

## Paso 4 — `elevenlabs.service.js`

Inyecta un evento al agente activo para que retome al lead cuando la transferencia falla:

```javascript
/**
 * Envía un evento al agente activo en ElevenLabs para que retome la conversación.
 * @param {string} conversationId - ID de la conversación activa en ElevenLabs
 * @param {string} mensaje        - Texto que el agente debe decirle al lead
 */
async function notificarAgenteRetomar({ conversationId, mensaje }) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/send-contextual-update`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: mensaje }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs notificación falló: ${error}`);
  }

  return await response.json();
}

module.exports = { notificarAgenteRetomar };
```

> **Nota:** el endpoint exacto de ElevenLabs para inyectar contexto a una conversación activa puede variar según la versión de su API. Verifica en su documentación el path correcto para `send contextual update` o `conversation event injection` — el concepto es el mismo, puede que la ruta difiera.

---

## Paso 5 — `transferencia.controller.js`

Recibe la llamada del server tool de ElevenLabs y orquesta todo:

```javascript
const { marcarAbogadoConAMD } = require('../services/twilio.service');

// Almacenamiento temporal en memoria para correlacionar el resultado AMD
// con la conversación activa.
// En producción reemplaza esto con Redis o tu DB.
const transferenciasActivas = new Map();

/**
 * Recibe la invocación del server tool desde ElevenLabs.
 * ElevenLabs espera una respuesta inmediata — el dial real ocurre en background.
 */
async function iniciarTransferencia(req, res) {
  const {
    numero_abogado,   // número destino en E.164, ej: +573001234567
    numero_lead,      // caller ID del lead
    conversation_id,  // ID de la conversación activa en ElevenLabs
    nombre_lead,
    telefono_lead,
    motivo,
  } = req.body;

  if (!numero_abogado || !conversation_id) {
    return res.status(400).json({
      error: 'numero_abogado y conversation_id son requeridos',
    });
  }

  try {
    const callbackUrl = `${process.env.BASE_URL}/webhooks/twilio-amd`;

    const callSid = await marcarAbogadoConAMD({
      numeroAbogado: numero_abogado,
      numeroLead: numero_lead,
      callbackUrl,
    });

    // Guarda el estado para correlacionarlo cuando llegue el webhook AMD
    transferenciasActivas.set(callSid, {
      conversation_id,
      nombre_lead,
      telefono_lead,
      motivo,
      numero_abogado,
      numero_lead,
      timestamp: Date.now(),
    });

    // Responde inmediatamente a ElevenLabs
    return res.status(200).json({
      success: true,
      message: 'Transferencia iniciada, aguardando respuesta del abogado.',
      call_sid: callSid,
    });

  } catch (error) {
    console.error('Error iniciando transferencia:', error);
    return res.status(500).json({ error: 'Error al iniciar la transferencia' });
  }
}

module.exports = { iniciarTransferencia, transferenciasActivas };
```

---

## Paso 6 — `twilio-amd.webhook.js`

Recibe el veredicto de Twilio y actúa según el resultado:

```javascript
const { transferenciasActivas } = require('../controllers/transferencia.controller');
const { notificarAgenteRetomar } = require('../services/elevenlabs.service');

const MENSAJE_RESPALDO =
  'El asesor no se encuentra disponible en este momento. ' +
  'Le enviaremos una notificación para que lo contacte a la brevedad. ' +
  'Gracias por comunicarse y que tenga un buen día.';

async function recibirResultadoAMD(req, res) {
  const { CallSid, AnsweredBy, CallStatus } = req.body;

  console.log(`AMD resultado — CallSid: ${CallSid}, AnsweredBy: ${AnsweredBy}, Status: ${CallStatus}`);

  const transferencia = transferenciasActivas.get(CallSid);

  if (!transferencia) {
    console.warn(`No se encontró transferencia activa para CallSid: ${CallSid}`);
    return res.status(200).send('<Response></Response>');
  }

  const esHumano    = AnsweredBy === 'human';
  const esBuzon     = AnsweredBy?.startsWith('machine') || AnsweredBy === 'fax';
  const noContesto  = ['no-answer', 'busy', 'failed'].includes(CallStatus);

  if (esHumano) {
    // Transferencia exitosa
    console.log(`✅ Abogado contestó — lead: ${transferencia.nombre_lead}`);
    // TODO: disparar correo de confirmación con datos del lead
    transferenciasActivas.delete(CallSid);

  } else if (esBuzon || noContesto) {
    // Transferencia fallida — notifica al agente para que retome al lead
    console.log(`❌ No contestó o buzón — retomando con agente`);

    try {
      await notificarAgenteRetomar({
        conversationId: transferencia.conversation_id,
        mensaje: MENSAJE_RESPALDO,
      });
      console.log(`✅ Agente notificado para retomar conversación`);
    } catch (error) {
      console.error('Error notificando al agente:', error);
    }

    transferenciasActivas.delete(CallSid);
  }

  // Twilio siempre espera un TwiML de respuesta
  res.set('Content-Type', 'text/xml');
  return res.status(200).send('<Response></Response>');
}

module.exports = { recibirResultadoAMD };
```

---

## Paso 7 — `transferencia.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const { iniciarTransferencia } = require('../controllers/transferencia.controller');
const { recibirResultadoAMD } = require('../webhooks/twilio-amd.webhook');

// Invocado por ElevenLabs como server tool
router.post('/transferencia/iniciar', iniciarTransferencia);

// Invocado por Twilio con el resultado AMD
router.post('/webhooks/twilio-amd', recibirResultadoAMD);

module.exports = router;
```

Regístralo en tu `app.js` o `index.js` principal:

```javascript
const transferenciaRoutes = require('./routes/transferencia.routes');
app.use('/api', transferenciaRoutes);
```

---

## Paso 8 — Exponer el backend públicamente para Twilio

Twilio necesita llegar a tu webhook AMD desde internet. En desarrollo local:

```bash
npx ngrok http 3000
```

Toma la URL que ngrok te da (ej: `https://abc123.ngrok.io`) y actualiza tu `.env`:

```env
BASE_URL=https://abc123.ngrok.io/api
```

En producción reemplaza con tu dominio real.

---

## Paso 9 — Verificación antes de conectar con ElevenLabs

Antes de tocar ElevenLabs, verifica que el endpoint responde correctamente:

```bash
curl -X POST https://tu-url/api/transferencia/iniciar \
  -H "Content-Type: application/json" \
  -d '{
    "numero_abogado": "+573001234567",
    "numero_lead": "+573009876543",
    "conversation_id": "conv_test_123",
    "nombre_lead": "Juan Pérez",
    "telefono_lead": "3001234567",
    "motivo": "Consulta deuda"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Transferencia iniciada, aguardando respuesta del abogado.",
  "call_sid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

Si obtienes el `200` con el `call_sid`, el endpoint está listo. Regresa aquí para configurar el server tool en ElevenLabs con el schema exacto.