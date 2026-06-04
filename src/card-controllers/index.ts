import { CardController, CardControllerHost } from "./base";
import { HistoryGraphCardController } from "./history-graph";
import { MapCardController } from "./map";

export const getCardController = (
  type: string | undefined,
  host: CardControllerHost
): CardController | undefined => {
  switch (type) {
    case "history-graph":
      return new HistoryGraphCardController(host);
    case "map":
      return new MapCardController(host);
    default:
      return undefined;
  }
};
