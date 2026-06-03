import type { HuiCard } from "../types";

export interface CardControllerHost extends HTMLElement {
  card?: HuiCard;
  hidden: boolean;
}

export class CardController {
  protected host: CardControllerHost;

  constructor(host: CardControllerHost) {
    this.host = host;
  }

  async afterCardUpdated(): Promise<void> {}
}
