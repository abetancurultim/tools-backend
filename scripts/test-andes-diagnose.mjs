/**
 * Script de diagnóstico para el WebService de Andes SCD
 * Corre con: node scripts/test-andes-diagnose.mjs
 *
 * Hipótesis que valida:
 *  1. Que las variables de entorno se cargan correctamente
 *  2. Que el XML WS-Security incluye la contraseña (no llega vacía)
 *  3. Que el passwordType correcto es PasswordText vs PasswordDigest
 *  4. Que el WSDL responde y el servicio Login existe
 */

import dotenv from 'dotenv';
import soap from 'strong-soap';
import { createHash } from 'crypto';

dotenv.config();

const WSDL      = process.env.ANDES_WSDL_TEST || 'https://test-circuitodefirmado.andesscd.com.co/WS/FE/wsdl.php?wsdl';
const USER      = process.env.ANDES_USER;
const PASSWORD  = process.env.ANDES_PASSWORD;
const PASS_SHA1 = process.env.ANDES_PASSWORD_SHA1;

// ── 1. Validar variables de entorno ──────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('  DIAGNÓSTICO ANDES SCD - WS Firma OTP');
console.log('══════════════════════════════════════════');
console.log('\n[1] Variables de entorno:');
console.log(`  ANDES_WSDL_TEST   : ${WSDL}`);
console.log(`  ANDES_USER        : ${USER            ? `"${USER}" ✓`          : '❌ NO DEFINIDA'}`);
console.log(`  ANDES_PASSWORD    : ${PASSWORD        ? `[${PASSWORD.length} chars] ✓` : '❌ NO DEFINIDA'}`);
console.log(`  ANDES_PASSWORD_SHA1: ${PASS_SHA1       ? `[${PASS_SHA1.length} chars] ✓` : '(vacía)'}`);

if (!USER || !PASSWORD) {
    console.error('\n❌ PROBLEMA DETECTADO: ANDES_USER o ANDES_PASSWORD no están definidas.');
    console.error('   Verifica tu .env y que dotenv.config() se ejecuta antes de importar env.js\n');
    process.exit(1);
}

// ── 2. Calcular el SHA1 local para comparar ───────────────────────────────────
const sha1Local = createHash('sha1').update(PASSWORD).digest('base64');
console.log(`\n[2] SHA1(ANDES_PASSWORD) calculado localmente (base64): ${sha1Local}`);
if (PASS_SHA1) {
    const match = sha1Local === PASS_SHA1;
    console.log(`  ¿Coincide con ANDES_PASSWORD_SHA1? ${match ? '✓ SÍ' : '❌ NO — valores distintos'}`);
    if (!match) {
        // Podría ser base64 de base64
        try {
            const inner = Buffer.from(PASS_SHA1, 'base64').toString('utf8');
            console.log(`  Decodificando ANDES_PASSWORD_SHA1 como base64 → "${inner.slice(0,30)}..."`);
            const matchInner = sha1Local === inner;
            console.log(`  ¿SHA1 local == decode(ANDES_PASSWORD_SHA1)? ${matchInner ? '✓ SÍ' : '❌ NO'}`);
        } catch (_) {}
    }
}

// ── Helper para crear cliente ─────────────────────────────────────────────────
function buildClient(user, password, passwordType, label) {
    return new Promise((resolve, reject) => {
        const soapClient = soap.soap;
        soapClient.createClient(WSDL, (err, client) => {
            if (err) return reject(new Error(`[${label}] createClient falló: ${err.message}`));

            const WSSecurity = soap.WSSecurity;
            const wss = new WSSecurity(user, password, {
                hasTimeStamp  : false,
                hasTokenCreated: false,
                hasNonce      : false,
                passwordType
            });
            client.setSecurity(wss);

            let capturedXml = null;
            client.on('request', (xml) => { capturedXml = xml; });

            resolve({ client, getCapturedXml: () => capturedXml });
        });
    });
}

// ── Helper: extraer el nodo Password del XML ──────────────────────────────────
function checkPasswordInXml(xml, label) {
    if (!xml) {
        console.log(`  [${label}] ⚠️  No se capturó XML`);
        return;
    }
    const passMatch = xml.match(/<[^>]*[Pp]assword[^>]*>([\s\S]*?)<\/[^>]*[Pp]assword>/);
    if (passMatch) {
        const val = passMatch[1].trim();
        console.log(`  [${label}] Password en XML: ${val ? `[${val.length} chars, no vacío] ✓` : '❌ VACÍO'}`);
        // Mostrar type del atributo
        const typeMatch = passMatch[0].match(/Type="([^"]+)"/);
        if (typeMatch) console.log(`  [${label}] Password Type: ${typeMatch[1]}`);
    } else {
        console.log(`  [${label}] ❌ No se encontró nodo <Password> en el XML — WSSecurity no se está incluyendo`);
    }
}

// ── 3. Probar con PasswordText (configuración actual) ────────────────────────
console.log('\n[3] Prueba A — passwordType: PasswordText (configuración actual)');
try {
    const { client: clientA, getCapturedXml: getXmlA } = await buildClient(USER, PASSWORD, 'PasswordText', 'A');
    console.log('  SOAP client creado ✓');
    console.log('  Llamando Login...');

    const resultA = await new Promise((resolve, reject) => {
        clientA.Login(
            { LoginRequest: { identificador: 'DiagnosticoConexion' } },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
    });

    checkPasswordInXml(getXmlA(), 'A');
    console.log(`  Respuesta: estado=${resultA?.estado}, mensaje="${resultA?.mensaje}"`);
    if (resultA?.estado === 0) console.log('  ✓ CONEXIÓN OK con PasswordText');

} catch (errA) {
    console.log(`  Error: ${errA.message?.slice(0, 200)}`);
}

// ── 4. Probar con PasswordDigest (SHA1 base64) ───────────────────────────────
console.log('\n[4] Prueba B — passwordType: PasswordDigest (SHA1 calculado localmente)');
try {
    const { client: clientB, getCapturedXml: getXmlB } = await buildClient(USER, sha1Local, 'PasswordDigest', 'B');
    console.log('  SOAP client creado ✓');
    console.log('  Llamando Login...');

    const resultB = await new Promise((resolve, reject) => {
        clientB.Login(
            { LoginRequest: { identificador: 'DiagnosticoConexion' } },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
    });

    checkPasswordInXml(getXmlB(), 'B');
    console.log(`  Respuesta: estado=${resultB?.estado}, mensaje="${resultB?.mensaje}"`);
    if (resultB?.estado === 0) console.log('  ✓ CONEXIÓN OK con PasswordDigest');

} catch (errB) {
    console.log(`  Error: ${errB.message?.slice(0, 200)}`);
}

// ── 5. Probar con SHA-512 calculado localmente ───────────────────────────────
console.log('\n[5] Prueba D — SHA-512(ANDES_PASSWORD) calculado localmente, como PasswordText');
const sha512Local       = createHash('sha512').update(PASSWORD).digest('base64');
const sha512LocalDouble = Buffer.from(sha512Local).toString('base64'); // doble base64, igual que ANDES_PASSWORD_SHA1
console.log(`  SHA512 base64        : ${sha512Local}`);
console.log(`  SHA512 doble-base64  : ${sha512LocalDouble}`);

for (const [label, hashVal] of [['D1-sha512', sha512Local], ['D2-sha512-doble-b64', sha512LocalDouble]]) {
    try {
        const { client, getCapturedXml } = await buildClient(USER, hashVal, 'PasswordText', label);
        const result = await new Promise((resolve, reject) => {
            client.Login(
                { LoginRequest: { identificador: 'DiagnosticoConexion' } },
                (err, res) => { if (err) return reject(err); resolve(res); }
            );
        });
        checkPasswordInXml(getCapturedXml(), label);
        console.log(`  [${label}] Respuesta: estado=${result?.estado}, mensaje="${result?.mensaje}"`);
        if (result?.estado === 0) console.log(`  ✓ CONEXIÓN OK con ${label}`);
    } catch (e) {
        console.log(`  [${label}] Error: ${e.message?.slice(0, 200)}`);
    }
}

// ── 6. Probar con ANDES_PASSWORD_SHA1 directo si existe ──────────────────────
if (PASS_SHA1) {
    console.log('\n[6] Prueba C — usando ANDES_PASSWORD_SHA1 directamente como password');
    try {
        const { client: clientC, getCapturedXml: getXmlC } = await buildClient(USER, PASS_SHA1, 'PasswordText', 'C');
        console.log('  SOAP client creado ✓');
        console.log('  Llamando Login...');

        const resultC = await new Promise((resolve, reject) => {
            clientC.Login(
                { LoginRequest: { identificador: 'DiagnosticoConexion' } },
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });

        checkPasswordInXml(getXmlC(), 'C');
        console.log(`  Respuesta: estado=${resultC?.estado}, mensaje="${resultC?.mensaje}"`);
        if (resultC?.estado === 0) console.log('  ✓ CONEXIÓN OK con ANDES_PASSWORD_SHA1');

    } catch (errC) {
        console.log(`  Error: ${errC.message?.slice(0, 200)}`);
    }
}

// ── 7. Mostrar los métodos disponibles en el WSDL ────────────────────────────
console.log('\n[7] Métodos disponibles en el WSDL (para confirmar que Login, SolicitudCertificado, etc. existen):');
try {
    const soapClient = soap.soap;
    await new Promise((resolve) => {
        soapClient.createClient(WSDL, (err, client) => {
            if (err) { console.log(`  Error: ${err.message}`); return resolve(); }
            try {
                const desc = client.describe();
                const services = Object.keys(desc);
                services.forEach(svcName => {
                    const ports = Object.keys(desc[svcName]);
                    ports.forEach(portName => {
                        const methods = Object.keys(desc[svcName][portName]);
                        console.log(`  Servicio: ${svcName} / Puerto: ${portName}`);
                        console.log(`  Métodos: ${methods.join(', ')}`);
                    });
                });
            } catch (e) {
                console.log(`  No se pudo describir el cliente: ${e.message}`);
            }
            resolve();
        });
    });
} catch (e) {
    console.log(`  Error listando métodos: ${e.message}`);
}

console.log('\n══════════════════════════════════════════');
console.log('  FIN DEL DIAGNÓSTICO');
console.log('══════════════════════════════════════════\n');
