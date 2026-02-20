import { Router } from 'express';
import { 
    handleGetDebts, 
    handleProcessCall, 
    handleInsuranceInterest, 
    handleInsuranceRegistration,
    handleCallWebhook,
    handleGetCallLogs,
    handleGetConversationDetails,
    handleBienestarInterest,
    handleBienestarRegistration,
    handleGetAdminfoDebts,
    handleAdminfoTracking,
    handleAdminfoPaymentAgreement
} from '../controllers/toolsController.js';
import { 
    handleGetFlamingoDebts, 
    handleFlamingoTracking,
    handleFlamingoPaymentAgreement
} from '../controllers/flamingoController.js';
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

// Tool 5: Bienestar Plus - Notificar Interés
router.post('/bienestar-interest', protectRoute, handleBienestarInterest);

// Tool 6: Bienestar Plus - Registrar y Activar Cliente
router.post('/bienestar-registration', protectRoute, handleBienestarRegistration);

// Tool 7: Obtener detalles de conversación de ElevenLabs (Dashboard)
router.get('/elevenlabs/conversation/:conversation_id', protectRoute, handleGetConversationDetails);

// Tool 8: Adminfo - Consultar Deudas - Coltefinanciera
router.post('/adminfo/get-debts', protectRoute, handleGetAdminfoDebts);

// Tool 9: Adminfo - Registrar Seguimiento - Coltefinanciera
router.post('/adminfo/save-tracking', protectRoute, handleAdminfoTracking);

// Tool 10: Flamingo - Consultar Deudas
router.post('/flamingo/get-debts', protectRoute, handleGetFlamingoDebts);

// Tool 11: Flamingo - Registrar Seguimiento
router.post('/flamingo/save-tracking', protectRoute, handleFlamingoTracking);

// Tool 12: Adminfo - Crear Compromiso de Pago - OJO - Coltefinanciera
router.post('/adminfo/payment-agreement', protectRoute, handleAdminfoPaymentAgreement);

// Tool 13: Flamingo - Crear Compromiso de Pago
router.post('/flamingo/payment-agreement', protectRoute, handleFlamingoPaymentAgreement);

export default router;