import { TEST_EMAIL } from './elevenLabsLibranzaTestRouting.js';

// Piloto: ambos mensajes se envían exclusivamente al correo de prueba.
const FROM = 'notificaciones@cooperactiva.com.co';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function libranzaEmailPayloads(row, signed, witness) {
  const d = row.client_data;
  const name = escapeHtml(d.nombresApellidos);
  const document = escapeHtml(d.numeroIdentificacion);
  const phone = escapeHtml(d.celular);
  const email = escapeHtml(d.correo);
  const fund = escapeHtml(d.fondoPension);
  const number = escapeHtml(row.libranza_number);
  const signedAttachment = {
    filename: `LIBRANZA_${row.libranza_number}_firmada.pdf`,
    content: signed.toString('base64'),
  };
  const witnessAttachment = {
    filename: `CERTIFICADO_ANDES_LIBRANZA_${row.libranza_number}.pdf`,
    content: witness.toString('base64'),
  };

  return {
    client: {
      from: FROM,
      to: TEST_EMAIL,
      subject: '[PRUEBA 11L] Tu autorización de libranza firmada electrónicamente',
      html: `<p><strong>PRUEBA INTERNA: este mensaje no se envió al cliente.</strong></p><p>Hola ${name},</p><p>Adjuntamos tu autorización de libranza firmada electrónicamente. Nuestro equipo te contactará para continuar con los documentos pendientes del proceso.</p><p>Cooperactiva</p>`,
      attachments: [signedAttachment],
    },
    internal: {
      from: FROM,
      to: TEST_EMAIL,
      subject: `[PRUEBA 11L] ACCIÓN PRIORITARIA: libranza firmada en llamada - ${d.nombresApellidos.replace(/[\r\n]/g, ' ')}`,
      html: `<p><strong>PRUEBA INTERNA: este mensaje no se envió a la distribución operativa.</strong></p>` +
        `<p>El cliente <strong>${name}</strong> firmó durante la llamada <strong>únicamente la Autorización de Libranza</strong> número ${number}.</p>` +
        `<p><strong>Contactar al cliente lo antes posible para coordinar la firma de los otros documentos pendientes.</strong> No considerar completo el expediente con esta sola firma.</p>` +
        `<p>Cédula: ${document}<br>Celular: ${phone}<br>Correo: ${email}<br>Fondo: ${fund}<br>ID Andes: ${escapeHtml(row.andes_id)}</p>` +
        '<p>Se adjuntan la libranza firmada y el certificado de firma de Andes.</p>',
      attachments: [signedAttachment, witnessAttachment],
    },
  };
}
