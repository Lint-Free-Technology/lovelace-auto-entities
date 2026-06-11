import { CardController, CardControllerHost } from "./base";
import { HistoryGraphCardController } from "./history-graph";
import { MapCardController } from "./map";
import { TileCardController } from "./tile";
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
    case "history-graph":
    case "map":
      return type;
    default:
      if (
        extras?.card_param === "cards" &&
        extras.entities?.some((entity) => entity?.type === "tile")
      ) {
        return "tile";
      }
      return undefined;
  }
};

export const getCardController = (
  type: string | undefined,
  host: CardControllerHost,
  extras?: CardControllerExtras
): CardController | undefined => {
  switch (getCardControllerType(type, extras)) {
    case "history-graph":
      return new HistoryGraphCardController(host);
    case "map":
      return new MapCardController(host);
    case "tile":
      return new TileCardController(host);
    default:
      return undefined;
  }
};
