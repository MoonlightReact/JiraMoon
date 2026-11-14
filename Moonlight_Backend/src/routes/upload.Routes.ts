import { Router } from 'express';
import { uploadController, guards } from '../config/container.js';
import { uploadMiddleware } from '@shared/middlewares/upload.Middleware.js';
import { requireAdmin } from '../config/allowedRoles.js';

const router = Router();

router.post('/:context', guards.authenticate, guards.authorize(requireAdmin), uploadMiddleware, uploadController.uploadImage);

export default router;
