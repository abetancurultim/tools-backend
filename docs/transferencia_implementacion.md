# Transferencia de llamadas con AMD + Conferencia — Implementación Real

> Este documento describe lo que **realmente se implementó y validó en vivo**.
> Difiere del diseño original ([transferencia_amd.md](./transferencia_amd.md)) porque,
> durante la implementación, se descubrió que el enfoque inicial no era viable con la
> integración nativa de ElevenLabs. Ver la sección **"Decisiones de diseño"** al final.

---

## Qué hace

Permite que el agente de voz de ElevenLabs transfiera la llamada a un abogado, y:

- **Si el abogado contesta** → une al cliente y al abogado en una conferencia de Twilio (el agente de IA se desconecta).
- **Si no contesta o cae en buzón** → el agente de IA retoma la llamada y le dice al cliente que el asesor no está disponible y que será contactado pronto.

Lo clave: **el agente sabe el resultado de la transferencia** porque el server tool es **síncrono** — espera el veredicto del AMD y se lo devuelve al agente, que reacciona en consecuencia.

---

## Flujo

```
Agente ElevenLabs
   │  (server tool, síncrono, timeout 120s)
   ▼
POST /api/v1/transferencia/iniciar
   │  marca al abogado con AMD (Twilio) y ESPERA el veredicto
   ▼
Twilio  ──(asyncAmdStatusCallback / statusCallback)──►  POST /api/v1/webhooks/twilio-amd
                                                              │
                                          ┌───────────────────┴───────────────────┐
                                          ▼                                         ▼
                                   AnsweredBy = human                   buzón / no-answer / busy
                                          │                                         │
                          une lead + abogado en conferencia            cuelga la pata del abogado
                          (calls.update con <Conference>)                          │
                                          │                                         ▼
                          resuelve → { resultado: "conectado" }    resuelve → { resultado: "no_disponible" }
                                          │                                         │
                                          ▼                                         ▼
                          el agente dice una frase breve            el agente da el mensaje de respaldo
                          y el cliente queda con el abogado          y finaliza la llamada
```

---

## Arquitectura del código

Patrón del proyecto: `routes → controllers → services` + `webhooks`. ES Modules.

| Archivo | Rol |
|---|---|
| [src/services/twilioService.js](../src/services/twilioService.js) | Marca al abogado con AMD; mueve llamadas a conferencia; cuelga llamadas. |
| [src/controllers/transferenciaController.js](../src/controllers/transferenciaController.js) | Server tool síncrono. Marca, espera el veredicto y lo devuelve al agente. Mantiene el estado en memoria. |
| [src/webhooks/twilioAmdWebhook.js](../src/webhooks/twilioAmdWebhook.js) | Recibe el veredicto de Twilio. Une en conferencia (éxito) o cuelga (fallo) y resuelve la espera. |
| [src/services/transferLogService.js](../src/services/transferLogService.js) | Inserta el log de cada transferencia en Supabase (call center). Fire-and-forget. |
| [src/routes/api.js](../src/routes/api.js) | Registra las dos rutas. |
| [src/config/env.js](../src/config/env.js) | Variables Twilio + `BASE_URL` + Supabase call center. |
| [src/config/clients.js](../src/config/clients.js) | Instancia `supabaseCallCenter`. |
| [src/app.js](../src/app.js) | `express.urlencoded()` (necesario para parsear los webhooks de Twilio). |

---

## Variables de entorno

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+14707406662
BASE_URL=https://tu-dominio.up.railway.app/api/v1

# Supabase del call center (log de transferencias) — usar la service_role key
SUPABASE_URL_CALL_CENTER=https://xxxxx.supabase.co
SUPABASE_KEY_CALL_CENTER=<service_role key>
```

> `BASE_URL` debe terminar en `/api/v1` (el prefijo de las rutas) y ser una URL pública
> alcanzable por Twilio. En desarrollo se usó ngrok; en producción, el dominio de Railway.

---

## Lógica clave

### Server tool síncrono ([transferenciaController.js](../src/controllers/transferenciaController.js))

El endpoint **no responde de inmediato**: marca al abogado y se queda esperando con una
`Promise` que el webhook resolverá. El timeout (`110s`) es menor al del tool de ElevenLabs
(`120s`) para garantizar que siempre respondemos a tiempo.

```js
const resultado = await new Promise((resolve) => {
  const timer = setTimeout(() => {
    transferenciasPendientes.delete(callSid);
    resolve({ resultado: 'no_disponible', motivo: 'timeout' });
  }, TIMEOUT_VEREDICTO_MS);

  transferenciasPendientes.set(callSid, {
    resolve, timer, leadCallSid: lead_call_sid, conferenceName, /* ...datos */
  });
});
return res.status(200).json(resultado);
```

### Marcado con AMD ([twilioService.js](../src/services/twilioService.js))

```js
machineDetection: 'Enable',
asyncAmd: 'true',
asyncAmdStatusCallback: callbackUrl,        // veredicto humano/máquina
twiml: '<Response><Pause length="60"/></Response>',  // silencio mientras AMD decide
statusCallback: callbackUrl,
statusCallbackEvent: ['completed'],          // captura no-answer/busy/failed
```

> **Importante:** los valores válidos de `statusCallbackEvent` son `initiated`, `ringing`,
> `answered`, `completed`. El caso "no contestó" llega vía el evento **`completed`** con
> `CallStatus: no-answer` — NO existe un evento `no-answer`.

### Veredicto y bridge ([twilioAmdWebhook.js](../src/webhooks/twilioAmdWebhook.js))

```js
const esHumano   = AnsweredBy === 'human';
const esBuzon    = AnsweredBy?.startsWith('machine') || AnsweredBy === 'fax';
const noContesto = ['no-answer', 'busy', 'failed'].includes(CallStatus);

if (esHumano) {
  pendiente.resolve({ resultado: 'conectado' });
  // tras ~2.5s (para que el agente diga su frase) se une a ambos en conferencia:
  setTimeout(async () => {
    await moverAConferencia({ callSid: CallSid, conferenceName });          // abogado
    await moverAConferencia({ callSid: leadCallSid, conferenceName });      // cliente (system__call_sid)
  }, DELAY_BRIDGE_MS);
} else if (esBuzon || noContesto) {
  await colgarLlamada(CallSid);   // cuelga el buzón del abogado
  pendiente.resolve({ resultado: 'no_disponible', motivo: esBuzon ? 'buzon' : CallStatus });
}
```

El cliente se mueve a la conferencia usando su `CallSid` de Twilio, que ElevenLabs expone
al tool como la variable dinámica **`system__call_sid`**.

---

## Configuración del Server Tool en ElevenLabs

**Tipo:** Webhook tool

| Campo | Valor |
|---|---|
| Name | `transferir_a_abogado` |
| Method | `POST` |
| URL | `https://TU-DOMINIO/api/v1/transferencia/iniciar` |
| Response timeout | `120` segundos |
| Disable interruptions | ✅ |
| Tool call sound | música de espera (ej: "Elevator Music 2") |
| Error handling | configurar para que un fallo del tool degrade al mensaje de respaldo |

**Body parameters (JSON):**

| Identifier | Tipo | Value Type | Valor / Fuente |
|---|---|---|---|
| `numero_abogado` | string | Constant (o LLM en prod) | `+57...` |
| `numero_lead` | string | Dynamic Variable | `system__caller_id` |
| `lead_call_sid` | string | Dynamic Variable | `system__call_sid` |
| `client_id` | string | Constant | `<UUID del cliente en call_center_clients>` |
| `nombre_lead` | string | LLM Prompt | nombre del cliente |
| `motivo` | string | LLM Prompt | motivo de la consulta |

> `client_id` es el UUID del cliente en `call_center_clients`. Se configura como **Constant**
> en el tool de cada agente (cada agente pertenece a un cliente). Así, un cliente nuevo solo
> necesita su propio tool con su `client_id`, sin tocar código.

**Respuestas del tool:**
```json
{ "resultado": "conectado" }
{ "resultado": "no_disponible", "motivo": "buzon" | "no-answer" | "busy" | "timeout" }
```

### Prompt del agente (fragmento)

```
Al transferir:
1. Di: "Perfecto, en un momento lo conecto con el asesor disponible."
2. Llama a la herramienta transferir_a_abogado y espera su resultado.
   - "conectado"     → di solo "Lo comunico ahora mismo, un momento." (frase breve)
   - "no_disponible" → di: "El asesor no se encuentra disponible en este momento.
     Le enviaremos una notificación para que lo contacte a la brevedad. Gracias por
     comunicarse y que tenga un buen día." y finaliza la llamada.
```

> La frase del caso `conectado` debe ser **corta**: a los ~2.5s el cliente se mueve a la
> conferencia y deja de escuchar al agente.

---

## Log en Supabase (`cc_call_transfers`)

Cada transferencia deja un registro en el proyecto Supabase del **call center** (instancia
`supabaseCallCenter`), referenciando `call_center_clients(id)` vía `client_id` para que sea
multi-tenant.

- El insert lo hace [transferLogService.js](../src/services/transferLogService.js) desde el
  controller, **una sola vez por transferencia**, tras conocer el veredicto. Cubre todos los
  desenlaces: `conectado`, `no_disponible` (buzón / no-answer / busy / timeout) y
  `error_interno`.
- Es **fire-and-forget**: si Supabase falla, se loguea el error pero **no se rompe** la
  transferencia. Si no llega `client_id`, se omite el registro (con warning).
- La tabla requiere los **grants** del Data API (ver [call_center.sql](../call_center.sql)) y
  se conecta con la **service_role key** (solo backend).

Columnas clave: `client_id`, `resultado`, `motivo_no_disponible`, `answered_by` (valor crudo
del AMD), datos del lead/abogado, `lead_call_sid`, `lawyer_call_sid`, `conference_name`.

---

## Despliegue (Railway) y estado en memoria

El estado de las transferencias en curso (`transferenciasPendientes`) vive **en memoria**
porque incluye la función `resolve` del request HTTP abierto, que **no es serializable**
(no se puede mover a Redis/DB). Implicaciones:

- ✅ **Una sola réplica (default de Railway):** funciona correctamente — el webhook de
  Twilio siempre llega al mismo proceso que tiene el request abierto.
- ⚠️ **Reinicio a mitad de transferencia** (deploy o crash en la ventana de ~60s): esa
  llamada se rompe. Mitigación: configurar el **Error handling** del tool en ElevenLabs
  para degradar al mensaje de respaldo, y desplegar en horas de bajo tráfico.
- ❌ **Múltiples réplicas:** el `Map` se rompe (el webhook puede caer en otra instancia).
  **No subir el número de réplicas** sin antes externalizar a Redis los datos del bridge
  (`leadCallSid`, `conferenceName`) indexados por `callSid`.

---

## Verificación

Prueba directa del endpoint (sin ElevenLabs):

```bash
curl -X POST https://TU-DOMINIO/api/v1/transferencia/iniciar \
  -H "Content-Type: application/json" \
  -d '{
    "numero_abogado": "+57...",
    "numero_lead": "+57...",
    "lead_call_sid": "CAxxxx",
    "nombre_lead": "Juan Pérez",
    "motivo": "Consulta"
  }'
```

- **Contesta** el teléfono del abogado → respuesta `{"resultado":"conectado"}`.
- **No contestes** → respuesta `{"resultado":"no_disponible","motivo":"no-answer"}`.

Prueba end-to-end (con el agente real): llamar al agente, pedir hablar con el abogado, y
validar ambos escenarios. Ambos fueron **validados en vivo**, incluyendo el bridge real de
conferencia sobre la llamada nativa de ElevenLabs.

---

## Decisiones de diseño (por qué cambió respecto al doc original)

1. **El `send-contextual-update` por REST no existe.** El diseño original notificaba al
   agente vía `POST .../conversations/{id}/send-contextual-update`. Ese endpoint no existe:
   el `contextual_update` es un **evento de WebSocket**. Con la integración nativa de
   ElevenLabs, el backend no controla ese WebSocket, así que ese enfoque es inviable.

2. **Se invirtió el flujo a un tool síncrono.** En lugar de "responder rápido + inyectar un
   mensaje después", el tool **espera el veredicto y lo devuelve**. El agente reacciona a la
   respuesta del tool (que ElevenLabs agrega a la conversación). Esto resuelve el requisito
   de "el agente debe entender si la transferencia funcionó" sin tocar ningún WebSocket.

3. **El bridge real usa una conferencia de Twilio.** El diseño original marcaba al abogado
   en una llamada separada que nunca se unía con el cliente. La versión real mueve ambas
   patas (abogado + cliente, vía `system__call_sid`) a una `<Conference>` con
   `calls.update()`. Se validó que esto funciona incluso sobre la llamada que ElevenLabs
   maneja de forma nativa.

4. **`express.urlencoded()` es obligatorio.** Twilio envía los webhooks como
   `application/x-www-form-urlencoded`; sin este parser, `req.body` llega `undefined`.
```
