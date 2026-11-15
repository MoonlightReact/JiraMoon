import { UploadController } from "../controllers/upload.Controller.js";
import { AuthController, AuthService } from "@modules/auth/index.js";
import { GameController, GameRepository, GameService } from "@modules/game/index.js";
import { CheckoutController, CheckoutService, OrderController, OrderRepository, PurchasedItemsRepository, OrderService, PurchasedItemsService} from "@modules/order/index.js";
import { UserController, UserService, UserRepository, RoleController, RoleRepository, RoleService, UserRoleRepository } from "@modules/user/index.js";
import { CategoryController, CategoryRepository, CategoryService } from "@modules/category/index.js";
import pool from "@shared/config/database.js";

import type { Guards } from "@shared/types/guards.js";
import { createAuthMiddleware } from "@modules/auth/auth.middleware.js";
import { createRoleMiddleware } from "@modules/auth/role.middleware.js";

export const userRepository     = new UserRepository();
const gameRepository     = new GameRepository(pool);
const orderRepository    = new OrderRepository();
const categoryRepository = new CategoryRepository();
const purchasedItemsRepository = new PurchasedItemsRepository();
const userRoleRepository = new UserRoleRepository();
const roleRepository = new RoleRepository();

export const roleService = new RoleService(roleRepository, userRoleRepository, userRepository);
export const userService          = new UserService(userRepository, userRoleRepository, roleService, pool);
export const gameService          = new GameService(gameRepository, pool);
export const orderService         = new OrderService(orderRepository);
export const categoryService      = new CategoryService(categoryRepository);
export const purchasedItemsService = new PurchasedItemsService(purchasedItemsRepository);
export const authService          = new AuthService(userRepository, userRoleRepository);
export const checkoutService = new CheckoutService(orderService, purchasedItemsService);

export const uploadController   = new UploadController();
export const userController     = new UserController(userService);
export const gameController     = new GameController(gameService);
export const orderController    = new OrderController(orderService);
export const categoryController = new CategoryController(categoryService);
export const authController     = new AuthController(authService);
export const checkoutController = new CheckoutController(checkoutService);
export const roleController = new RoleController(roleService);

export const guards: Guards = {
  authenticate: createAuthMiddleware({ findById: (id_user: number) => userService.findById(id_user) }),
  authorize: createRoleMiddleware({ getRoleVersion: (id_user: number) => userRepository.getRoleVersion(id_user) })
}
