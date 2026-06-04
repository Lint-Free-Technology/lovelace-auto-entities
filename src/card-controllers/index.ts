import { CardController, CardControllerHost } from "./base";
import { HistoryGraphCardController } from "./history-graph";

export const getCardController = (
  type: string | undefined,
  host: CardControllerHost
): CardController | undefined => {
  switch (type) {
    case "history-graph":
      return new HistoryGraphCardController(host);
    default:
      return undefined;
  }
};
