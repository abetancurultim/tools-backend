import { jest } from '@jest/globals';
import { deletePdf, loadPdf, savePdf, PdfNotAvailableError } from '../src/services/elevenLabsLibranzaStorage.js';

it('conserva el PDF solo en memoria y entrega una copia de sus bytes', async () => {
  const original = Buffer.from('%PDF-1.4\nprueba');
  await savePdf('conv_12345678/prepared', original);
  original.fill(0);
  const loaded = await loadPdf('conv_12345678/prepared');
  expect(loaded.toString()).toBe('%PDF-1.4\nprueba');
  loaded.fill(0);
  expect((await loadPdf('conv_12345678/prepared')).toString()).toBe('%PDF-1.4\nprueba');
  deletePdf('conv_12345678/prepared');
  await expect(loadPdf('conv_12345678/prepared')).rejects.toBeInstanceOf(PdfNotAvailableError);
});

it('vence el PDF a los 15 minutos como el almacenamiento temporal de WhatsApp', async () => {
  const now = jest.spyOn(Date, 'now');
  try {
    now.mockReturnValue(1_000);
    await savePdf('conv_12345678/signed', Buffer.from('%PDF-1.4\nfirmado'));
    now.mockReturnValue(1_000 + 15 * 60_000);
    await expect(loadPdf('conv_12345678/signed')).rejects.toBeInstanceOf(PdfNotAvailableError);
  } finally {
    now.mockRestore();
    deletePdf('conv_12345678/signed');
  }
});
