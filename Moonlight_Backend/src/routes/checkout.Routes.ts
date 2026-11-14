import express from 'express';
import { checkoutController, guards } from '../config/container.js';
import { requireUser } from '../config/allowedRoles.js';

const router = express.Router();

router.post('/', guards.authenticate, guards.authorize(requireUser), checkoutController.createCheckout);
router.post('/webhook', checkoutController.handleWebhook);
router.get('/success', checkoutController.handleSuccess);
router.get('/failure', checkoutController.handleFailure);
router.get('/pending', checkoutController.handlePending);

export default router;
