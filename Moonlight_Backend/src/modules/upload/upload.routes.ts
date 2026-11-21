import { Router } from 'express';
import { requireAdmin } from '../../config/allowedRoles.js';
import type { UploadController } from './upload.controller.js';
import { uploadMiddleware } from './middlewares/upload.middleware.js'
import type { Guards } from '@shared/types/guards.js';

export function createUploadRoutes(controller: UploadController, guards: Guards) : Router {
  const router = Router();

  router.post('/:context', guards.authenticate, guards.authorize(requireAdmin), uploadMiddleware, controller.uploadImage);

  return router;
}
