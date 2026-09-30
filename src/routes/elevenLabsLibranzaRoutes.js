import { Router } from 'express';
import { requireElevenLabsLibranzaKey } from '../middlewares/elevenLabsLibranzaAuth.js';
import { preparar, solicitarOtp, firmar, entregar, estado, estadoPorBody } from '../controllers/elevenLabsLibranzaController.js';

const router = Router();
router.use(requireElevenLabsLibranzaKey);
router.post('/preparar', preparar);
router.post('/solicitar-otp-sms', solicitarOtp);
router.post('/firmar', firmar);
router.post('/entregar', entregar);
router.post('/estado', estadoPorBody);
router.get('/:conversationId/estado', estado);
export default router;
