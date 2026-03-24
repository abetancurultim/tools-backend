# Call Webhook - ElevenLabs Post-call Integration

## Nuevo Endpoint: POST-CALL WEBHOOK

Este endpoint ha sido agregado para recibir automáticamente los datos de ElevenLabs cuando una llamada finaliza y registrarlos en la base de datos para análisis de éxito.

### Configuración

**Endpoint:** `POST /api/v1/call-webhook`  
**Base de Datos:** Supabase COLTEFINANCIERA_RECORDATORIOS  
**Tabla:** `call_logs`  
**Autenticación:** HMAC SHA256 (ElevenLabs signature)

### Estructura de la Tabla `call_logs`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `conversation_id` | Text (Unique) | ID único de la conversación de ElevenLabs |
| `agent_id` | Text | ID del agente que procesó la llamada |
| `call_successful` | Text | Valor de call_successful del análisis como string |
| `evaluation_rationale` | Text | Explicación del resultado de la evaluación |
| `full_analysis_data` | JSONB | Datos completos del análisis de ElevenLabs |
| `call_status` | Text | Estado de la llamada (completed, failed, etc.) |

### Configuración en ElevenLabs

#### Webhook Settings
- **URL:** `https://[TU-DOMINIO]/api/v1/call-webhook`
- **Method:** POST
- **Authentication:** HMAC SHA256
- **Secret:** Usar valor de `ELEVENLABS_WEBHOOK_SECRET`
- **Header:** `elevenlabs-signature`

### Ejemplo de Payload ElevenLabs

```json
{
  "data": {
    "conversation_id": "conv_123456789",
    "agent_id": "agent_abcdef123",
    "status": "completed",
    "analysis": {
      "call_successful": "true",
      "rationale": "El cliente expresó interés y proporcionó información de contacto completa",
      "evaluation_criteria_results": {
        "engagement": true,
        "information_collected": true,
        "follow_up_scheduled": false
      }
    }
  }
}
```

### Extracción de Datos

El servicio automáticamente extrae:

1. **conversation_id**: Identificador único de la conversación
2. **agent_id**: ID del agente que manejó la llamada  
3. **call_successful**: Extraído como string directamente de:
   - `analysis.call_successful`
   - `analysis.evaluation_criteria_results.call_successful`
   - `analysis.success`
   - `analysis.successful`
4. **evaluation_rationale**: Explicación del resultado:
   - `analysis.rationale`
   - `analysis.evaluation_rationale` 
   - `analysis.explanation`
   - `analysis.reason`
5. **full_analysis_data**: Objeto `analysis` completo guardado como JSONB
6. **call_status**: Estado de la llamada

### Manejo de Errores

- **400 Bad Request**: Payload inválido o campos requeridos faltantes
- **500 Internal Server Error**: Error de base de datos o procesamiento
- **Registros Duplicados**: Se detectan y manejan sin error

### Logs de Monitoreo

El sistema registra:
- Recepción de webhooks
- Extracción de datos del payload
- Éxito/fallo de inserción en base de datos
- Registros duplicados
- Errores de procesamiento

### Validaciones

- **conversation_id**: Requerido, debe estar presente
- **agent_id**: Requerido, debe estar presente  
- **Signature HMAC**: Validada contra `ELEVENLABS_WEBHOOK_SECRET`
- **Unicidad**: No se permiten conversation_id duplicados

### Variables de Entorno Requeridas

```bash
# Supabase Coltefinanciera Recordatorios
SUPABASE_URL_COLTEFINANCIERA_RECORDATORIOS=https://dotixioragoaouerajxf.supabase.co
SUPABASE_KEY_COLTEFINANCIERA_RECORDATORIOS=sb_publishable_MtdhM59aOstd0MWtNqdS9w_iPZYoMrq

# ElevenLabs Webhook Secret
ELEVENLABS_WEBHOOK_SECRET=wsec_a45587b19789a3d10c814e528e48dbfa38604df44a6b0676d0ea3fec36624f0d
```

### Respuesta del Endpoint

```json
{
  "message": "Webhook recibido y procesado",
  "conversation_id": "conv_123456789",
  "existed": false
}
```

### Funciones Adicionales

El servicio también incluye:

- `getCallLogs(filters, limit)`: Para consultar logs con filtros
- Detección automática de registros existentes
- Manejo robusto de diferentes estructuras de payload de ElevenLabs

### Testing

Para probar el endpoint manualmente, usar la validación HMAC como en otros webhooks de ElevenLabs, o temporalmente deshabilitar la validación para pruebas en desarrollo.