# Documentación de Servicios y Endpoints API: Firma Electrónica (Andes SCD)

Este documento detalla la integración realizada con los WebServices de Andes SCD para la gestión de Firmas Electrónicas con validación OTP (One-Time Password).

## Flujo del Servicio

El flujo de consumo establecido por los WebServices de firma electrónica (Ambiente de Calidad/Pruebas) se realiza en tres pasos principales:
1. **Verificar conexión (Opcional):** Confirmación de que las credenciales de servicio mediante WS-Security están operativas.
2. **Generar Solicitud / Envío de OTP:** Se envían los datos del firmante (Documento, nombre, correo y celular) a Andes, provocando que se le envíe al correo un código PIN válido por 5 minutos ("Solicitud Certificado").
3. **Firmar Documento Final:** Se envían nuevamente los datos base, en adición al documento PDF convertido a formato Base64 y el código OTP introducido por el usuario ("Firma Documento"). Si es verificado, Andes devuelve el PDF ya firmado.

---

## 1. Verificar Conexión y Estado del Servicio

Permite saber si las credenciales en sesión `.env` son correctas realizando la autenticación WS-Security y llamando al método \`Login\`.

- **Endpoint:** \`/api/andes/test-connection\`
- **Método HTTP:** \`POST\`
- **Middleware:** \`protectRoute\` (Requiere Bearer Token según configuración).

### **Cuerpo de Petición (Request Body)**
No requiere parámetros.

### **Casos de Respuesta (Response)**

**Respuestas Exitosas (200 OK)**
\`\`\`json
{
  "success": true,
  "data": {
    "estado": 0,
    "mensaje": "OK!"
  }
}
\`\`\`

---

## 2. Iniciar / Solicitar la Firma (Envío OTP)

Llama al método \`SolicitudCertificadoAsync\` para alertar a Andes que un usuario va a realizar una firma de documento, despachando un correo OTP con vida de 5 minutos al cliente registrado.

- **Endpoint:** \`/api/andes/solicitar-firma\`
- **Método HTTP:** \`POST\`
- **Middleware:** \`protectRoute\`

### **Cuerpo de Petición (Request Body)**

| Parámetro | Tipo | Requerido | Descripción |
| :--- | :--- | :---: | :--- |
| \`datosFirmante.idTipoDocumento\` | Int | Si | \`1\` = C.C, \`2\` = NIT, \`3\` = PAS, \`6\` = C.E, \`8\` = NUIP |
| \`datosFirmante.documento\` | String | Si | Número de documento del firmante |
| \`datosFirmante.primerNombre\` | String | Si | Primer Nombre |
| \`datosFirmante.segundoNombre\` | String | No | Segundo Nombre |
| \`datosFirmante.primerApellido\` | String | Si | Primer Apellido |
| \`datosFirmante.segundoApellido\` | String | No | Segundo Apellido |
| \`datosFirmante.correo\` | String | Si | Correo electrónico activo para recibir el OTP |
| \`datosFirmante.celular\` | Int/String| Si | Celular del usuario firmante (solo numérico) |

**Ejemplo de JSON:**
\`\`\`json
{
    "datosFirmante": {
        "idTipoDocumento": 1,
        "documento": "12345678",
        "primerNombre": "Caren",
        "segundoNombre": "",
        "primerApellido": "Mejia",
        "segundoApellido": "",
        "correo": "correo@gmail.com",
        "celular": "3000000000"
    }
}
\`\`\`

### **Casos de Respuesta (Response)**

**Respuestas Exitosas (200 OK)**
\`\`\`json
{
    "success": true,
    "data": {
        "estado": 0,
        "mensaje": "Éxito"
    }
}
\`\`\`

---

## 3. Confirmar Firma con OTP

Este es el paso vital. Recibe el código introducido por el cliente más el PDF codificado en Base 64. Andes comprueba el OTP y, si es correcto, estampa la firma electrónica en las coordenadas especificadas devolviendo el documento firmado.

- **Endpoint:** \`/api/andes/confirmar-firma-otp\`
- **Método HTTP:** \`POST\`
- **Middleware:** \`protectRoute\`

### **Cuerpo de Petición (Request Body)**

| Parámetro | Tipo | Requerido | Descripción |
| :--- | :--- | :---: | :--- |
| \`codigoOTP\` | Int | Si | El pin enviado en el método de Solicitar Firma. |
| \`documentoBase64\` | String | Si | Documento completo convertido a un string Base64 |
| \`datosFirmante.idTipoDocumento\` | Int | Si | (Igual al paso 2) |
| \`datosFirmante.documento\` | String | Si | (Igual al paso 2) |
| \`datosFirmante.nombreAdjunto\` | String | Si | Nombre del documento SIN extensión (.pdf) |
| \`datosFirmante.firmaVisible\` | String | No | \`1\` = SI (por defecto), \`2\` = NO |
| \`datosFirmante.coordenadasFirma\` | String | No | Formato: \`x,y,ancho,alto\` (Ej: \`80,20,150,60\`) |
| \`datosFirmante.pagina\` | Int | No | \`0\` si es la última hoja o mandar el número fijo. |
| \`datosFirmante.observaciones\` | String | No | Observaciones inyectadas en el testigo |

**Ejemplo de JSON:**
\`\`\`json
{
    "codigoOTP": 123456,
    "documentoBase64": "JVBERi0xLjQKJcOkw7zDtsOfCjIgM...",
    "datosFirmante": {
        "idTipoDocumento": 1,
        "documento": "12345678",
        "nombreAdjunto": "contrato_credito",
        "firmaVisible": "1",
        "coordenadasFirma": "80,20,150,60"
    }
}
\`\`\`

### **Casos de Respuesta (Response)**

**Respuestas Exitosas (200 OK)**
\`\`\`json
{
    "success": true,
    "data": {
        "estado": 0,
        "mensaje": "JVB... (Documento Final Firmado Mismo Formato)",
        "id": 8943924
    }
}
\`\`\`
> **Nota de Implementación:** El valor \`mensaje\` en éxito retornará tu misma cadena PDF, pero ya modificada e intervenida por Andes con la constancia de estampado visible. El valor \`id\` corresponde al número único de solicitud creado del lado de los servidores de la firma.

---

## 4. Consultar Testigo (Constancia Visual)

Si luego de la firma se requiere consultar y descargar la base 64 exclusivamente de la estampilla o constancia del proceso, puedes requerirla usando el identificador creado en el paso 3.

- **Endpoint:** \`/api/andes/testigo/:idSolicitud\`
- **Método HTTP:** \`GET\`
- **Middleware:** \`protectRoute\`

### **Parámetros de Ruta**
- \`idSolicitud\` (Int): El ID de la transacción exitosa de Andes.

### **Casos de Respuesta (Response)**

**Respuestas Exitosas (200 OK)**
\`\`\`json
{
    "success": true,
    "testigoBase64": "Base64 de la imagen testigo"
}
\`\`\`