import express from 'express';
import { authController } from '../config/container.js';

const router = express.Router();

router.post('/login', authController.login);

export default router;
