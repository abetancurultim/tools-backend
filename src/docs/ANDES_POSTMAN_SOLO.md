# Pruebas Rápidas POSTMAN - Andes FIRMA OTP

Esta mini-guía está centrada **EXCLUSIVAMENTE** en el consumo de los endpoints de Andes que hemos creado para tu Backend.
Ignora cualquier otra API Key en Postman, tu ruta de `/api/v1/andes/` no las requiere.

## 1. Test de Conexión (Verificar que las contraseñas funcionan)
La contraseña se procesa a nivel de código en tu backend y se adjunta a cada petición enviada al servidor de Andes.

* **Método:** `POST`
* **URL:** `http://localhost:3002/api/v1/andes/test-connection`
* **Body:** Ninguno
* **Headers:** No necesitas enviar ningún header especial en Postman (puedes dejarlos por defecto).

## 2. Solicitar OTP al Correo (Paso 1 del Flujo)

* **Método:** `POST`
* **URL:** `http://localhost:3002/api/v1/andes/solicitar-firma`
* **Headers:** `Content-Type: application/json`
* **Body - raw (JSON):**
```json
{
    "datosFirmante": {
        "idTipoDocumento": 1,
        "documento": "1000000000",
        "primerNombre": "Prueba",
        "primerApellido": "Andes",
        "correo": "tu_correo@gmail.com",
        "celular": "3000000000"
    }
}
```

## 3. Comprobar OTP y Firmar PDF (Paso 2 del Flujo)

* **Método:** `POST`
* **URL:** `http://localhost:3002/api/v1/andes/confirmar-firma-otp`
* **Headers:** `Content-Type: application/json`
* **Body - raw (JSON):**
```json
{
    "codigoOTP": 123456, 
    "documentoBase64": "JVBERi0xLjQKJcOkw7zDtsOfCjIgM...", 
    "datosFirmante": {
        "idTipoDocumento": 1,
        "documento": "1000000000",
        "nombreAdjunto": "documento_test",
        "firmaVisible": "1",
        "coordenadasFirma": "80,20,150,60"
    }
}
```

> **Nota para Postman:** Recuerda cambiar el `JVBERi...` por tu cadena base 64 original, y el `123456` por el pin que Andes mande a tu correo en el paso 1.