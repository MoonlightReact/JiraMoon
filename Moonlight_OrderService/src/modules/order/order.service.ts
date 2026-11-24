import type { EventBus } from "@shared/events/event-bus.js";
import type { OrderRepository } from "./order.repository.js";
import { AppError } from "@shared/errors/AppError.js";
import { ORDER_STATUSES, type CreateOrderDTO, type Order, type OrderStatus } from "./order.types.js";

const toCents = (value: number): number => Math.round(value * 100);

function isDuplicateEntry(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "ER_DUP_ENTRY";
}

export class OrderService {

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventBus: EventBus,
  ) {}

  async create(dto: CreateOrderDTO): Promise<{ id_order: number }> {
    this.validateCreate(dto);

    let id_order: number;
    try {
      id_order = await this.orderRepository.create(dto);
    } catch (err) {
      if (isDuplicateEntry(err)) {
        throw new AppError("Já existe um pedido com essa external_reference", 409, "ORDER_ALREADY_EXISTS");
      }
      throw err;
    }

    // Só depois do commit: o evento nunca anuncia um pedido que não foi gravado.
    await this.publishSafely("order.created", {
      id_order,
      id_user: dto.id_user,
      total: dto.total,
      external_reference: dto.external_reference,
      customer: {name: dto.customer.name, email: dto.customer.email}
    });

    return { id_order };
  }

  async findById(id_order: number): Promise<Order> {
    const order = await this.orderRepository.findById(id_order);
    if (!order) throw new AppError("Pedido não encontrado", 404, "ORDER_NOT_FOUND");
    return order;
  }

  async findByUser(id_user: number): Promise<Order[]> {
    return this.orderRepository.findByUser(id_user);
  }

  /**
   * Muda o status pelo external_reference.
   * - mudou: se o novo status é "approved", publica order.paid (montado com dados do BANCO, não da requisição)
   * - não mudou e o pedido existe: já estava nesse status (webhook repetido), responde ok e NÃO publica
   * - não existe: 404
   */
  async updateStatus(external_reference: string, status: OrderStatus): Promise<{ changed: boolean }> {
    if (!ORDER_STATUSES.includes(status)) {
      throw new AppError("Status inválido", 400, "INVALID_STATUS");
    }

    const changed = await this.orderRepository.updateStatus(external_reference, status);

    if (!changed) {
      const exists = await this.orderRepository.existsByExternalReference(external_reference);
      if (!exists) throw new AppError("Pedido não encontrado", 404, "ORDER_NOT_FOUND");
      return { changed: false };
    }

    if (status === "approved") {
      const order = await this.orderRepository.findByExternalReference(external_reference);
      if (order) {
        await this.publishSafely("order.paid", {
          id_order: order.id_order,
          id_user: order.id_user,
          total: order.total,
          external_reference: order.external_reference,
          customer: { name: order.customer_name, email: order.customer_email },
          items: order.items.map(item => ({ id_game: item.id_game, title: item.title, price: item.price })),
        });
      }
    }

    return { changed: true };
  }

  /** Falha de mensageria não pode desfazer nem travar o pedido: loga (sem payload) e segue. */
  private async publishSafely(name: "order.created" | "order.paid", payload: unknown): Promise<void> {
    try {
      await this.eventBus.publish(name, payload as never);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[OrderService] falha ao publicar ${name}: ${reason}`);
    }
  }

  private validateCreate(dto: CreateOrderDTO): void {
    const invalid = (message: string): never => {
      throw new AppError(message, 400, "INVALID_ORDER");
    };

    if (!Number.isInteger(dto?.id_user) || dto.id_user <= 0) invalid("id_user inválido");
    if (!dto.customer?.name?.trim()) invalid("customer.name é obrigatório");
    if (!dto.customer?.email?.includes("@")) invalid("customer.email inválido");
    if (!dto.external_reference?.trim() || dto.external_reference.length > 50) invalid("external_reference inválida");
    if (!dto.preference_id?.trim() || dto.preference_id.length > 50) invalid("preference_id inválido");
    if (!Array.isArray(dto.items) || dto.items.length === 0) invalid("O pedido precisa ter ao menos um item");

    const seen = new Set<number>();
    for (const item of dto.items) {
      if (!Number.isInteger(item.id_game) || item.id_game <= 0) invalid("id_game inválido");
      if (!item.title?.trim()) invalid("title do item é obrigatório");
      if (!Number.isFinite(item.price) || item.price <= 0) invalid("price do item inválido");
      if (seen.has(item.id_game)) invalid("jogo repetido no pedido");
      seen.add(item.id_game);
    }

    // O total precisa bater com a soma dos itens (em centavos, para fugir do erro de ponto flutuante).
    const sum = dto.items.reduce((acc, item) => acc + toCents(item.price), 0);
    if (sum !== toCents(dto.total)) invalid("total não confere com a soma dos itens");
  }
}
