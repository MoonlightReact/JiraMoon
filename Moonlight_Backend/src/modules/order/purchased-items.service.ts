import type { PurchasedItemsDTO } from "@modules/order/dto/purchased-items.dto.js";
import { PurchasedItemsRepository } from "@modules/order/purchased-items.repository.js";

export class PurchasedItemsService {
  constructor(private purchasedItemsRepository: PurchasedItemsRepository) {}

  async createItems(query: PurchasedItemsDTO): Promise<void> {
    for (const item of query.items) {
      await this.purchasedItemsRepository.createItem({
        id_game: item.id_game,
        id_order: query.id_order,
        price: item.price,
      });
    }
  }
}
