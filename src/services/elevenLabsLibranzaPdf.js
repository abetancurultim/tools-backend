import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const template = fileURLToPath(new URL('../templates/libranza_template.pdf', import.meta.url));
const INLINE_MONTHS = {
  text_18alrv: { page: 0, x: 186, y: 605 },
  text_19wdaq: { page: 0, x: 191, y: 372 },
  text_20zpb: { page: 1, x: 365, y: 649 },
};

export async function buildElevenLabsLibranza(data, number, now = new Date()) {
  const pdf = await PDFDocument.load(await fs.readFile(template));
  const form = pdf.getForm();
  const bogotaParts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  const firstInstallment = new Date(Date.UTC(bogotaParts.year, bogotaParts.month, 15));
  const fields = {
    text_1bsmj: number,
    text_2qdac: data.nombresApellidos,
    text_3mvjo: `${data.tipoIdentificacion} ${data.numeroIdentificacion}`,
    text_4egyt: data.direccionResidencia,
    text_5aem: data.celular,
    text_6lagk: number,
    text_7tolh: '$0',
    text_8wcas: '16.303',
    text_9qurk: '12 meses',
    text_10dsqj: '0%',
    text_11wxdk: '$0',
    text_12bizt: firstInstallment.toLocaleDateString('es-CO', { timeZone: 'UTC' }),
    text_13ftbn: data.fondoPension.toUpperCase(),
    text_21ucj: 'Medellín',
    text_22xlgk: now.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }),
  };

  for (const [name, value] of Object.entries(fields)) form.getTextField(name).setText(value);
  for (const name of Object.keys(INLINE_MONTHS)) form.getTextField(name).setText('');
  form.getCheckBox('checkbox_15fmgp').check();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  for (const { page, x, y } of Object.values(INLINE_MONTHS)) {
    pages[page].drawText('12 meses', { x, y, size: 9, font, color: rgb(0, 0, 0) });
  }

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
