import { jest } from "@jest/globals";
import type { OrderRepository } from "@modules/order/order.repository.js";
import type {
  CreateOrderDTO,
  UpdateOrderDTO,
} from "@modules/order/dto/order.input.dto.js";
import type { PurchasedItemsRepository } from "@modules/order/purchased-items.repository.js";
import type { CreatePurchasedItemsDTO } from "@modules/order/dto/purchased-items.dto.js";
import type { GamePrice, GamePriceReader } from "@modules/order/game-price.reader.js";

const mockPreferenceCreate = jest.fn<(...args: any[]) => Promise<any>>();
const mockPaymentGet = jest.fn<(...args: any[]) => Promise<any>>();

jest.unstable_mockModule("mercadopago", () => ({
  MercadoPagoConfig: jest.fn(),
  Preference: jest.fn().mockImplementation(() => ({
    create: mockPreferenceCreate,
  })),
  Payment: jest.fn().mockImplementation(() => ({
    get: mockPaymentGet,
  })),
}));

const { OrderService } = await import("./order.service.js");
const { PurchasedItemsService } =
  await import("./purchased-items.service.js");
const { Preference, Payment } = await import("mercadopago");
const { CheckoutService } = await import("./checkout.service.js");

const mockOrderRepository = {
  canPurchaseGame:
    jest.fn<(id_user: number, id_game: number) => Promise<boolean>>(),
  create: jest.fn<(query: CreateOrderDTO) => Promise<number>>(),
  updateStatus: jest.fn<(query: UpdateOrderDTO) => Promise<boolean>>(),
} as unknown as OrderRepository;

const mockPurchasedItemsRepository = {
  createItem: jest.fn<(query: CreatePurchasedItemsDTO) => Promise<void>>(),
} as unknown as PurchasedItemsRepository;

const mockGamePriceReader = {
  findPricesByIds: jest.fn<(ids: number[]) => Promise<GamePrice[]>>(),
} as unknown as GamePriceReader;

describe("CheckoutService - Unitário", () => {
  const service = new CheckoutService(
    new OrderService(mockOrderRepository),
    new PurchasedItemsService(mockPurchasedItemsRepository),
    mockGamePriceReader,
  );

  const mockFindPricesByIds =
    mockGamePriceReader.findPricesByIds as jest.MockedFunction<
      (ids: number[]) => Promise<GamePrice[]>
    >;

  const mockCanPurchaseGame =
    mockOrderRepository.canPurchaseGame as jest.MockedFunction<
      (id_user: number, id_game: number) => Promise<boolean>
    >;
  const mockCreateOrder = mockOrderRepository.create as jest.MockedFunction<
    (query: CreateOrderDTO) => Promise<number>
  >;
  const mockUpdateOrderStatus =
    mockOrderRepository.updateStatus as jest.MockedFunction<
      (query: UpdateOrderDTO) => Promise<boolean>
    >;

  const mockCreatePurchasedItems =
    mockPurchasedItemsRepository.createItem as jest.MockedFunction<
      (query: CreatePurchasedItemsDTO) => Promise<void>
    >;

  beforeEach(() => {
    mockCanPurchaseGame.mockReset();
    mockCreateOrder.mockReset();
    mockUpdateOrderStatus.mockReset();
    mockCreatePurchasedItems.mockReset();
    mockFindPricesByIds.mockReset();
    mockPreferenceCreate.mockReset();
    mockPaymentGet.mockReset();
  });

  describe("createPreference", () => {
    // O cliente manda só os ids; título, preço e total vêm do servidor.
    const checkoutPayload = {
      user: { id_user: 1, name: "João", email: "joao@email.com" },
      items: [{ id_game: 1 }, { id_game: 2 }],
    };

    const serverGames: GamePrice[] = [
      { id_game: 1, title: "Jogo A", priceInCents: 5999 },
      { id_game: 2, title: "Jogo B", priceInCents: 2999 },
    ];

    beforeEach(() => {
      mockFindPricesByIds.mockResolvedValue(serverGames);
    });

    it("deve retornar o id da preferência criada", async () => {
      mockCanPurchaseGame.mockResolvedValue(true);
      mockPreferenceCreate.mockResolvedValue({ id: "pref_123" });
      mockCreateOrder.mockResolvedValue(42);
      mockCreatePurchasedItems.mockResolvedValue(undefined);

      const result = await service.createPreference(checkoutPayload);

      expect(result.preference_id).toBe("pref_123");
    });

    it("deve criar o pedido com os dados corretos", async () => {
      mockCanPurchaseGame.mockResolvedValue(true);
      mockPreferenceCreate.mockResolvedValue({ id: "pref_abc", init_point: "https://mp.com/prod", sandbox_init_point: "https://mp.com/test" });
      mockCreateOrder.mockResolvedValue(10);
      mockCreatePurchasedItems.mockResolvedValue(undefined);

      await service.createPreference(checkoutPayload);

      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          id_user: 1,
          total: 89.98,
          preference_id: "pref_abc",
          status: "pending",
        }),
      );
    });

    it("deve criar os itens comprados com o id_order retornado", async () => {
      mockCanPurchaseGame.mockResolvedValue(true);
      mockPreferenceCreate.mockResolvedValue({ id: "pref_abc" });
      mockCreateOrder.mockResolvedValue(99);
      mockCreatePurchasedItems.mockResolvedValue(undefined);

      await service.createPreference(checkoutPayload);

      expect(mockCreatePurchasedItems).toHaveBeenCalledTimes(2);
      expect(mockCreatePurchasedItems).toHaveBeenCalledWith(
        expect.objectContaining({ id_order: 99, id_game: 1 }),
      );
      expect(mockCreatePurchasedItems).toHaveBeenCalledWith(
        expect.objectContaining({ id_order: 99, id_game: 2 }),
      );
    });

    it("deve retornar checkout_url usando init_point quando disponível", async () => {
      mockCanPurchaseGame.mockResolvedValue(true);
      mockPreferenceCreate.mockResolvedValue({ id: "pref_123", init_point: "https://mp.com/prod" });
      mockCreateOrder.mockResolvedValue(1);
      mockCreatePurchasedItems.mockResolvedValue(undefined);

      const result = await service.createPreference(checkoutPayload);

      expect(result.checkout_url).toBe("https://mp.com/prod");
    });

    it("deve usar sandbox_init_point como fallback quando init_point não existir", async () => {
      mockCanPurchaseGame.mockResolvedValue(true);
      mockPreferenceCreate.mockResolvedValue({ id: "pref_123", sandbox_init_point: "https://mp.com/sandbox" });
      mockCreateOrder.mockResolvedValue(1);
      mockCreatePurchasedItems.mockResolvedValue(undefined);

      const result = await service.createPreference(checkoutPayload);

      expect(result.checkout_url).toBe("https://mp.com/sandbox");
    });

    it("deve propagar erro se a criação da preferência falhar", async () => {
      mockCanPurchaseGame.mockResolvedValue(true);
      mockPreferenceCreate.mockRejectedValue(new Error("MP error"));

      await expect(service.createPreference(checkoutPayload)).rejects.toThrow(
        "MP error",
      );
    });

    it("deve propagar erro se createOrder falhar", async () => {
      mockCanPurchaseGame.mockResolvedValue(true);
      mockPreferenceCreate.mockResolvedValue({ id: "pref_abc" });
      mockCreateOrder.mockRejectedValue(new Error("DB error"));

      await expect(service.createPreference(checkoutPayload)).rejects.toThrow(
        "DB error",
      );
    });

    describe("preço e total vindos do servidor", () => {
      it("deve ignorar preço, título e total adulterados enviados pelo cliente", async () => {
        mockCanPurchaseGame.mockResolvedValue(true);
        mockPreferenceCreate.mockResolvedValue({ id: "pref_x" });
        mockCreateOrder.mockResolvedValue(7);
        mockCreatePurchasedItems.mockResolvedValue(undefined);
        mockFindPricesByIds.mockResolvedValue([serverGames[0]!]);

        const tampered = {
          user: { id_user: 1, name: "João" },
          total: 0.01,
          items: [{ id_game: 1, title: "Jogo Hackeado", price: 0.01 }],
        } as any;

        await service.createPreference(tampered);

        // pedido
        expect(mockCreateOrder).toHaveBeenCalledWith(
          expect.objectContaining({ total: 59.99 }),
        );
        // itens comprados
        expect(mockCreatePurchasedItems).toHaveBeenCalledWith(
          expect.objectContaining({ id_order: 7, id_game: 1, price: 59.99 }),
        );
        // Mercado Pago
        expect(mockPreferenceCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              items: [
                expect.objectContaining({ id: "1", title: "Jogo A", unit_price: 59.99 }),
              ],
            }),
          }),
        );
      });

      it("deve somar o total em centavos: 0.1 + 0.2 resulta em 0.3", async () => {
        mockCanPurchaseGame.mockResolvedValue(true);
        mockPreferenceCreate.mockResolvedValue({ id: "pref_x" });
        mockCreateOrder.mockResolvedValue(8);
        mockCreatePurchasedItems.mockResolvedValue(undefined);
        mockFindPricesByIds.mockResolvedValue([
          { id_game: 1, title: "Jogo A", priceInCents: 10 },
          { id_game: 2, title: "Jogo B", priceInCents: 20 },
        ]);

        await service.createPreference(checkoutPayload);

        expect(mockCreateOrder.mock.calls[0]![0].total).toBe(0.3);
      });

      it("deve transformar ids repetidos em um só", async () => {
        mockCanPurchaseGame.mockResolvedValue(true);
        mockPreferenceCreate.mockResolvedValue({ id: "pref_x" });
        mockCreateOrder.mockResolvedValue(9);
        mockCreatePurchasedItems.mockResolvedValue(undefined);

        await service.createPreference({
          ...checkoutPayload,
          items: [{ id_game: 1 }, { id_game: 1 }, { id_game: 2 }],
        });

        expect(mockFindPricesByIds).toHaveBeenCalledWith([1, 2]);
        expect(mockCreatePurchasedItems).toHaveBeenCalledTimes(2);
        expect(mockCreateOrder).toHaveBeenCalledWith(
          expect.objectContaining({ total: 89.98 }),
        );
      });

      it("deve recusar com 404 jogo inexistente ou inativo (reader não devolve o jogo)", async () => {
        mockFindPricesByIds.mockResolvedValue([serverGames[0]!]);

        await expect(service.createPreference(checkoutPayload)).rejects.toMatchObject({
          statusCode: 404,
          code: "GAME_NOT_FOUND",
        });

        expect(mockPreferenceCreate).not.toHaveBeenCalled();
        expect(mockCreateOrder).not.toHaveBeenCalled();
      });

      it("deve recusar com 400 carrinho vazio", async () => {
        await expect(
          service.createPreference({ ...checkoutPayload, items: [] }),
        ).rejects.toMatchObject({ statusCode: 400, code: "EMPTY_CART" });

        expect(mockFindPricesByIds).not.toHaveBeenCalled();
      });

      it("deve recusar com 400 carrinho ausente", async () => {
        await expect(
          service.createPreference({ user: checkoutPayload.user } as any),
        ).rejects.toMatchObject({ statusCode: 400, code: "EMPTY_CART" });
      });

      it("deve recusar com 400 id de jogo inválido", async () => {
        await expect(
          service.createPreference({ ...checkoutPayload, items: [{ id_game: "abc" as any }] }),
        ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_GAME_ID" });

        expect(mockFindPricesByIds).not.toHaveBeenCalled();
      });

      it("deve usar o título do servidor ao avisar que o usuário já possui o jogo", async () => {
        mockCanPurchaseGame.mockResolvedValue(false);

        await expect(service.createPreference(checkoutPayload)).rejects.toMatchObject({
          statusCode: 400,
          code: "USER_ALREADY_HAVE_GAME",
          message: expect.stringContaining("Jogo A"),
        });
      });
    });
  });

  describe("getPaymentStatus", () => {
    it("deve atualizar o pedido com status approved", async () => {
      mockPaymentGet.mockResolvedValue({
        status: "approved",
        external_reference: "order_123",
      });
      mockUpdateOrderStatus.mockResolvedValue(true);

      await service.getPaymentStatus("pay_001");

      expect(mockUpdateOrderStatus).toHaveBeenCalledWith({
        status: "approved",
        external_reference: "order_123",
      });
    });

    it("deve mapear status rejected para canceled", async () => {
      mockPaymentGet.mockResolvedValue({
        status: "rejected",
        external_reference: "order_456",
      });
      mockUpdateOrderStatus.mockResolvedValue(true);

      await service.getPaymentStatus("pay_002");

      expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: "canceled" }),
      );
    });

    it("deve mapear status cancelled para canceled", async () => {
      mockPaymentGet.mockResolvedValue({
        status: "cancelled",
        external_reference: "order_789",
      });
      mockUpdateOrderStatus.mockResolvedValue(true);

      await service.getPaymentStatus("pay_003");

      expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: "canceled" }),
      );
    });

    it("deve usar status pending como fallback para status desconhecido", async () => {
      mockPaymentGet.mockResolvedValue({
        status: "in_process",
        external_reference: "order_000",
      });
      mockUpdateOrderStatus.mockResolvedValue(true);

      await service.getPaymentStatus("pay_004");

      expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending" }),
      );
    });

    it("deve propagar erro se o pagamento não for encontrado", async () => {
      mockPaymentGet.mockRejectedValue(new Error("Payment not found"));

      await expect(service.getPaymentStatus("pay_invalido")).rejects.toThrow(
        "Payment not found",
      );
    });
  });
});
