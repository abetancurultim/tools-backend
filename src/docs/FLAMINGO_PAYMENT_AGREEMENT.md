# Flamingo - Crear Compromiso de Pago

Documentación para configurar el endpoint `POST /api/flamingo/payment-agreement` como una **Tool** en ElevenLabs.

---

## 🔐 Autenticación

Aplica para todas las herramientas del backend:

| Campo | Valor |
|---|---|
| **Tipo** | `Custom Header` |
| **Header Name** | `x-api-key` |
| **Header Value** | Valor de la variable de entorno `API_KEY` |

---

## 🛠 Configuración de la herramienta en ElevenLabs

### Datos generales

| Campo | Valor |
|---|---|
| **Name** | `CrearCompromisoPagoFlamingo` |
| **Method** | `POST` |
| **URL** | `https://<RAILWAY_URL>/api/flamingo/payment-agreement` |

### Description sugerida

```
Registra un compromiso de pago para una obligación del cliente en el sistema Adminfo (Flamingo).
Úsala cuando el cliente acepta un acuerdo de pago y proporciona las fechas y montos de las cuotas.
Requiere el ID de la obligación, el monto total pactado, el número de cuotas y el detalle de cada cuota con su fecha y monto.
```

---

## 📋 JSON Schema

```json
{
  "type": "object",
  "properties": {
    "tipoIdentificacion": {
      "type": "string",
      "description": "Tipo de documento del cliente. Usar '1' para Cédula de Ciudadanía (CC), '2' para Cédula de Extranjería (CE). Si no se especifica, se usa '1' por defecto."
    },
    "identificacion": {
      "type": "string",
      "description": "Número de documento del cliente sin puntos ni espacios."
    },
    "idDatoContacto": {
      "type": "string",
      "description": "ID del dato de contacto del cliente. Se obtiene del resultado de la herramienta ConsultarDeudasFlamingo en el campo 'id_dato_contacto_obligatorio'."
    },
    "idObligacion": {
      "type": "string",
      "description": "Número de la obligación o crédito sobre el cual se crea el compromiso de pago. Se obtiene del resultado de la herramienta ConsultarDeudasFlamingo."
    },
    "grabador": {
      "type": "string",
      "description": "Identificador del agente que registra el compromiso. Usar siempre el valor fijo: 'gestor_api'."
    },
    "nota": {
      "type": "string",
      "description": "Descripción o nota libre sobre el acuerdo de pago pactado con el cliente."
    },
    "fechaPago": {
      "type": "string",
      "description": "Fecha del compromiso de pago principal en formato YYYY-MM-DD. Ejemplo: '2026-03-15'."
    },
    "valorTotalPactado": {
      "type": "string",
      "description": "Valor total del acuerdo de pago en pesos colombianos, sin puntos ni comas. Ejemplo: '300000'."
    },
    "cuotas": {
      "type": "string",
      "description": "Número total de cuotas pactadas en el acuerdo. Ejemplo: '3'."
    },
    "codigoGestion": {
      "type": "string",
      "description": "Código de gestión de la llamada. Ejemplo: '11111'."
    },
    "tipoContacto": {
      "type": "string",
      "description": "Tipo de contacto de la gestión. Usar siempre 'ENT' (Entrante)."
    },
    "canalActual": {
      "type": "string",
      "description": "Canal por el que se realizó la gestión. Usar siempre 'TEL' (Teléfono)."
    },
    "acuerdo_pago": {
      "type": "array",
      "description": "Lista de cuotas del acuerdo de pago. Debe contener un objeto por cada cuota pactada.",
      "items": {
        "type": "object",
        "properties": {
          "monto": {
            "type": "string",
            "description": "Monto de la cuota en pesos colombianos sin puntos ni comas. Ejemplo: '100000'."
          },
          "fechaCompromiso": {
            "type": "string",
            "description": "Fecha de pago de la cuota en formato YYYY-MM-DD. Ejemplo: '2026-03-15'."
          }
        },
        "required": ["monto", "fechaCompromiso"]
      },
      "minItems": 1
    }
  },
  "required": [
    "identificacion",
    "idObligacion",
    "grabador",
    "fechaPago",
    "valorTotalPactado",
    "cuotas",
    "codigoGestion",
    "acuerdo_pago"
  ]
}
```

---

## 📤 Ejemplo de payload completo

```json
{
  "tipoIdentificacion": "1",
  "identificacion": "21849246",
  "idDatoContacto": "9477959",
  "idObligacion": "7800833",
  "grabador": "gestor_api",
  "nota": "Cliente acepta pagar en 3 cuotas mensuales",
  "fechaPago": "2026-03-25",
  "valorTotalPactado": "300000",
  "cuotas": "3",
  "codigoCausal": "",
  "codigoGestion": "11111",
  "codAbogado": "",
  "canalGestion": "",
  "tipoContacto": "ENT",
  "canalActual": "TEL",
  "acuerdo_pago": [
    { "monto": "100000", "fechaCompromiso": "2026-03-25" },
    { "monto": "100000", "fechaCompromiso": "2026-04-25" },
    { "monto": "100000", "fechaCompromiso": "2026-05-25" }
  ]
}
```

---

## ✅ Respuesta exitosa

```json
{
  "message": "Compromiso de pago creado con éxito en Flamingo",
  "result": { }
}
```

---

## ⚠️ Notas importantes

- El campo `idDatoContacto` se obtiene del resultado de la herramienta **ConsultarDeudasFlamingo** (`id_dato_contacto_obligatorio`). Si el agente no lo tiene disponible, el sistema usará `"0"` como valor por defecto.
- El array `acuerdo_pago` puede contener **una o más cuotas**. La suma de los `monto` de cada cuota debe ser igual a `valorTotalPactado`.
- Los campos `tipoContacto` y `canalActual` tienen valores fijos (`ENT` y `TEL`). Si el agente no los envía, el sistema los asigna automáticamente.
- El campo `grabador` debe enviarse siempre como `"gestor_api"`.
- Esta herramienta es exclusiva para el agente **Flamingo**. Para Coltefinanciera usar `POST /api/adminfo/payment-agreement`.
