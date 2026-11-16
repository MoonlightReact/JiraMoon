import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createOrderRoutes, createCheckoutRoutes } from "@modules/order/index.js";
import { errorMiddleware } from '@shared/middlewares/error.Middleware.js';
import { authController, categoryController, checkoutController, gameController, guards, orderController, roleController, uploadController, userController } from '../config/container.js';
import { createGameRoutes } from '@modules/game/index.js';
import { createCategoryRoutes } from '@modules/category/index.js';
import { createRoleRoutes, createUserRoutes } from '@modules/user/index.js';
import { createAuthRoutes } from '@modules/auth/index.js';
import { createUploadRoutes } from '@modules/upload/index.js';

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('API do Projeto Moonlight rodando 🌙');
});

//para pegar imagens direto da pasta uploads.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/uploads', createUploadRoutes(uploadController, guards));
app.use('/api/auth', createAuthRoutes(authController));
app.use('/api/roles', createRoleRoutes(roleController, guards));
app.use('/api/users', createUserRoutes(userController, guards));
app.use('/api/games', createGameRoutes(gameController, guards));
app.use('/api/categories', createCategoryRoutes(categoryController, guards));
app.use('/api/checkout', createCheckoutRoutes(checkoutController, guards));
app.use('/api/orders', createOrderRoutes(orderController, guards));
app.use(errorMiddleware);

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
app.listen(PORT, () => {
    console.log(`Servidor na porta ${PORT}`);
});
}

export default app;
