// Igual que el flujo de firma de WhatsApp: los PDF viven solo durante la llamada.
// La base conserva el estado, no los bytes del documento ni el OTP.
const TTL_MS = 15 * 60_000;
const pdfs = new Map();

export class PdfNotAvailableError extends Error {
  constructor() {
    super('El PDF temporal ya no está disponible');
  }
}

function current(key) {
  const entry = pdfs.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt >= TTL_MS) {
    pdfs.delete(key);
    return null;
  }
  return entry;
}

export async function savePdf(key, bytes) {
  pdfs.set(key, { bytes: Buffer.from(bytes), createdAt: Date.now() });
}

export async function loadPdf(key) {
  const entry = current(key);
  if (!entry) throw new PdfNotAvailableError();
  return Buffer.from(entry.bytes);
}

export function deletePdf(key) {
  pdfs.delete(key);
}

const cleanup = setInterval(() => {
  for (const key of pdfs.keys()) current(key);
}, 5 * 60_000);
cleanup.unref();
