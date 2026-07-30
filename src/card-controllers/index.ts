import { CardController, CardControllerHost } from "./base";
import { MapCardController } from "./map";
import type { EntityList } from "../types";

interface CardControllerExtras {
  card_param?: string;
  entities?: EntityList;
}

export const getCardControllerType = (
  type: string | undefined,
  extras?: CardControllerExtras
): string | undefined => {
  switch (type) {
    case "map":
      return type;
    default:
      return undefined;
  }
};

export const getCardController = (
  type: string | undefined,
  host: CardControllerHost,
  extras?: CardControllerExtras
): CardController | undefined => {
  switch (getCardControllerType(type, extras)) {
    case "map":
      return new MapCardController(host);
    default:
      return undefined;
  }
};
