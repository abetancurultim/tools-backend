# ElevenLabs - Configuración de Tools

## 1. Configuración Global

Para cada herramienta que se cree, se deberá configurar la autenticación de la siguiente manera:

* **Autenticación:** Seleccionar `Custom Header`.
* **Header Name:** `x-api-key`.
* **Header Value:** El valor configurado en la variable de entorno `API_KEY`.

## 2. Configuración de la herramienta

A continuación se presentan ejemplos de cómo se deberían de configurar las herramientas (JSON Schemas):

### A. Herramienta: Consultar Deuda
Esta herramienta permite al agente saber cuánto debe un cliente por numero de cédula.
* **Name:** `ConsultarDeuda`
* **Description:** `Consulta si el cliente tiene obligaciones financieras o deudas pendientes usando su número de documento. Úsala al inicio de la llamada si el usuario pregunta por su estado de cuenta.`
* **URL:** `httpS://<RAILWAY_URL>/api/v1/get-debts`
* **Method:** `POST`
* **Headers:**
    *   `x-api-key`: `{{API_KEY}}`
    *   `Content-Type`: `application/json`
* **Schema:**
    ```json
    {
        "type": "object",
        "properties": {
            "documentId": {
                "type": "string",
                "description": "El número de documento o cédula del cliente sin puntos ni espacios."
            }
        },
        "required": ["documentId"]
    }
    ```
### B. Herramienta: Notificar Interés (Lead de Seguro)
Esta herramienta permite al agente notificar al supervisor cuando un cliente expresa interés en un seguro de vida.
* **Name:** `NotificarInteresSeguro`
* **Description:** `Notifica al supervisor cuando un cliente expresa interés en un seguro de vida.`
* **URL:** `httpS://<RAILWAY_URL>/api/v1/insurance-interest`
* **Method:** `POST`
* **Headers:**
    *   `x-api-key`: `{{API_KEY}}`
    *   `Content-Type`: `application/json`
* **Schema:**
    ```json
    {
        "type": "object",
        "properties": {
            "clientName": { "type": "string", "description": "Nombre del cliente" },
            "clientPhone": { "type": "string", "description": "Teléfono del cliente" },
            "interestLevel": { 
                "type": "string", 
                "enum": ["alto", "medio", "bajo"],
                "description": "Nivel de interés del cliente (alto, medio, bajo)" 
            },
            "notes": { "type": "string", "description": "Notas adicionales sobre el cliente" },
            "contactPreference": { 
                "type": "string", 
                "enum": ["WhatsApp", "email", "telefono"],
                "description": "Preferencia de contacto del cliente (WhatsApp, email, telefono)" 
            },
            "transcript": { "type": "string", "description": "Transcripción de la llamada" },
            "callSid": { "type": "string", "description": "Identificador de la llamada" }
        },
        "required": ["clientName", "clientPhone", "interestLevel", "notes", "contactPreference", "transcript", "callSid"]
    }
    ```
### C. Herramienta: Registrar y Activar Cliente (Venta Cerrada)
Esta herramienta permite al agente registrar al cliente en la base de datos (Supabase), envía correos de activación al supervisor y un correo de bienvenida al cliente.
* **Name:** `RegistrarVentaSeguro`
* **Description:** `Registra al cliente en la base de datos (Supabase), envía correos de activación al supervisor y un correo de bienvenida al cliente.`
* **URL:** `httpS://<RAILWAY_URL>/api/v1/insurance-registration`
* **Method:** `POST`
* **Headers:**
    *   `x-api-key`: `{{API_KEY}}`
    *   `Content-Type`: `application/json`
* **Schema:**
    ```json
    {
        "type": "object",
        "properties": {
            "name": { "type": "string", "description": "Nombre del cliente" },
            "document_id": { "type": "string", "description": "Número de documento o cédula del cliente sin puntos ni espacios." },
            "number": { "type": "string", "description": "Teléfono del cliente" },
            "email": { "type": "string", "description": "Correo electrónico para envío de certificados" },
            "callSid": { "type": "string", "description": "Identificador de la llamada" },
            "transcript": { "type": "string", "description": "Transcripción de la llamada" },
            "timestamp": { "type": "string", "description": "Fecha y hora de la llamada" }
        },
        "required": ["name", "document_id", "number", "email", "callSid", "transcript", "timestamp"]
    }
    ```
### D. Herramienta: Procesar Llamada Finalizada
Esta herramienta permite al agente procesar la llamada finalizada y subir la transcripción a AWS S3.
* **Name:** `ProcessCallLog`
* **Description:** `Procesa la llamada finalizada y sube la transcripción a AWS S3.`
* **URL:** `httpS://<RAILWAY_URL>/api/v1/process-call`
* **Method:** `POST`
* **Headers:**
    *   `x-api-key`: `{{API_KEY}}`
    *   `Content-Type`: `application/json`
* **Schema:**
    ```json
    {
        "type": "object",
        "properties": {
            "callSid": { "type": "string", "description": "Identificador de la llamada" },
            "name": { "type": "string", "description": "Nombre del cliente" },
            "number": { "type": "string", "description": "Teléfono del cliente" },
            "transcript": { "type": "string", "description": "Transcripción de la llamada" },
            "timestamp": { "type": "string", "description": "Fecha y hora de la llamada" }
        },
        "required": ["name", "number", "callSid", "transcript", "timestamp"]
    }
    ```

# NOTA IMPORTANTE:
Estos son solo ejemplos de configuración, por favor, ajusta los nombres y descripciones según los datos exactos que requiere cada petición para que la herramienta funcione correctamente.