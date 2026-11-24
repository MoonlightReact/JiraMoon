import { Router } from "express";
import type { OrderController } from "./order.controller.js";

/** Montado em /orders (o prefixo precisa existir porque o proxy_pass do Nginx mantém o caminho original). */
export function createOrderRoutes(controller: OrderController): Router {
  const router = Router();

  router.post("/", controller.create);
  // "/user/:id_user" precisa vir ANTES de "/:id", senão "user" seria lido como um id.
  router.get("/user/:id_user", controller.listByUser);
  router.get("/:id", controller.getById);
  router.patch("/:external_reference/status", controller.updateStatus);

  return router;
}
