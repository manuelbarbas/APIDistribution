import { Router } from 'express';
import { GasController } from '../controllers/gas.controller';
import { authenticateApiKey } from '../middleware/auth.middleware';
import { validate, gasDistributionSchema } from '../middleware/validation.middleware';

const router = Router();
const gasController = new GasController();

/**
 * Gas distribution routes
 */

// Main distribution endpoint - requires API key
router.post(
  '/fair/gas',
  authenticateApiKey,
  validate(gasDistributionSchema),
  gasController.distributeGas
);

// Additional utility endpoints
router.get('/health', gasController.healthCheck);
router.get('/balance/:address', authenticateApiKey, gasController.checkBalance);
router.post('/estimate', authenticateApiKey, gasController.estimateGas);

export default router;