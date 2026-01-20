import { Router } from 'express';
import { 
    handleGetDebts, 
    handleProcessCall, 
    handleInsuranceInterest, 
    handleInsuranceRegistration,
    handleCallWebhook,
    handleGetCallLogs,
    handleGetConversationDetails
} from '../controllers/toolsController.js';
import { protectRoute, verifyElevenLabsSignature, verifyElevenLabsSignatureColtefinanciera } from '../middlewares/auth.js';

const router = Router();

// Tool 1: Consultar Deudas
router.post('/get-debts', protectRoute, handleGetDebts);

// Tool 2: Reportar Llamada Finalizada (Webhook de ElevenLabs con HMAC)
router.post('/process-call', verifyElevenLabsSignature, handleProcessCall);

// Tool 3: Notificar Interés (Lead caliente, sin comprar aún)
router.post('/insurance-interest', protectRoute, handleInsuranceInterest);

// Tool 4: Registrar y Activar Cliente (Venta cerrada)
router.post('/insurance-registration', protectRoute, handleInsuranceRegistration);

export default router;