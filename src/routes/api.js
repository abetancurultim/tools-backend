import { Router } from 'express';
import { 
    handleGetDebts, 
    handleProcessCall, 
    handleInsuranceInterest, 
    handleInsuranceRegistration 
} from '../controllers/toolsController.js';
import { protectRoute } from '../middlewares/auth.js';

const router = Router();

// Tool 1: Consultar Deudas
router.post('/get-debts', protectRoute, handleGetDebts);

// Tool 2: Reportar Llamada Finalizada
router.post('/process-call', protectRoute, handleProcessCall);

// Tool 3: Notificar Interés (Lead caliente, sin comprar aún)
router.post('/insurance-interest', protectRoute, handleInsuranceInterest);

// Tool 4: Registrar y Activar Cliente (Venta cerrada)
router.post('/insurance-registration', protectRoute, handleInsuranceRegistration);

export default router;