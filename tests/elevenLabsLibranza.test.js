import { jest } from '@jest/globals';
import { PDFDocument } from 'pdf-lib';
import { buildElevenLabsLibranza } from '../src/services/elevenLabsLibranzaPdf.js';
import { requireElevenLabsLibranzaKey } from '../src/middlewares/elevenLabsLibranzaAuth.js';

describe('Libranza única de ElevenLabs', () => {
  it('diligencia los campos críticos de la plantilla transversal', async () => {
    const bytes = await buildElevenLabsLibranza({
      nombresApellidos: 'Ana María Pérez', tipoIdentificacion: 'CC',
      numeroIdentificacion: '12345678', direccionResidencia: 'Calle 1 # 2-3',
      celular: '3001234567', fondoPension: 'CASUR',
    }, '0000042', new Date('2026-09-23T15:00:00Z'));
    const pdf = await PDFDocument.load(bytes);
    const form = pdf.getForm();
    expect(pdf.getPageCount()).toBe(2);
    expect(form.getTextField('text_1bsmj').getText()).toBe('0000042');
    expect(form.getTextField('text_2qdac').getText()).toBe('Ana María Pérez');
    expect(form.getTextField('text_8wcas').getText()).toBe('16.303');
    expect(form.getTextField('text_13ftbn').getText()).toBe('CASUR');
    expect(form.getCheckBox('checkbox_15fmgp').isChecked()).toBe(true);
  });

  it('rechaza herramientas sin clave y permite la clave exclusiva', () => {
    const prior = process.env.ELEVENLABS_LIBRANZA_API_KEY;
    process.env.ELEVENLABS_LIBRANZA_API_KEY = 'test-secret';
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireElevenLabsLibranzaKey({ get: () => 'wrong' }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    requireElevenLabsLibranzaKey({ get: () => 'test-secret' }, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    if (prior === undefined) delete process.env.ELEVENLABS_LIBRANZA_API_KEY;
    else process.env.ELEVENLABS_LIBRANZA_API_KEY = prior;
  });
});
