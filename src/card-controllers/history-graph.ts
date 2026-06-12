import { CardController, CardControllerHost } from "./base";

const WAIT_TIMEOUT_MS = 3000;
const WAIT_INTERVAL_MS = 100;
const WAIT_INTERVAL_MAX_MS = 500;

interface UpdatableChartElement extends Element {
  requestUpdate?: (propertyName?: string) => void;
}

type CardWithElement = Element & {
  _element?: Element;
};

export class HistoryGraphCardController extends CardController {
  private refreshPromise?: Promise<void>;

  constructor(host: CardControllerHost) {
    super(host);
    this.host.addEventListener(
      "card-visibility-changed",
      this.handleCardVisibilityChanged as EventListener
    );
  }

  connected(): void {
    this.host.addEventListener(
      "card-visibility-changed",
      this.handleCardVisibilityChanged as EventListener
    );
  }

  dispose(): void {
    this.host.removeEventListener(
      "card-visibility-changed",
      this.handleCardVisibilityChanged as EventListener
    );
  }

  private async afterCardVisible(): Promise<void> {
    if (!this.isHostVisible()) return;

    const chart = await this.waitForChartBase();
    if (!chart) return;

    chart.requestUpdate?.("_themes");
  }

  private handleCardVisibilityChanged = (ev: Event): void => {
    const visible = (ev as CustomEvent<{ value: boolean }>).detail?.value;
    if (visible !== true) return;
    if (this.refreshPromise) return;
    this.refreshPromise = (async () => {
      try {
        await this.afterCardVisible();
      } finally {
        this.refreshPromise = undefined;
      }
    })();
    void this.refreshPromise.catch((err) => {
      console.warn("auto-entities: history-graph refresh failed", err);
    });
  };

  private isHostVisible(): boolean {
    if (!this.host.isConnected || this.host.hidden) return false;
    return this.host.getClientRects().length > 0;
  }

  private async waitForChartBase(): Promise<UpdatableChartElement | undefined> {
    const started = Date.now();
    let wait = WAIT_INTERVAL_MS;
    while (Date.now() - started < WAIT_TIMEOUT_MS) {
      const card = this.host.card as CardWithElement | undefined;
      const chart = this.findChartBase(card);
      if (chart) return chart;
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      wait = Math.min(wait * 2, WAIT_INTERVAL_MAX_MS);
    }
    return undefined;
  }

  private findChartBase(
    card: CardWithElement | undefined
  ): UpdatableChartElement | undefined {
    if (!card) return undefined;

    const roots: Array<Element | ShadowRoot> = [card];
    if (card.shadowRoot) roots.push(card.shadowRoot);
    if (card._element) {
      roots.push(card._element);
      if (card._element.shadowRoot) roots.push(card._element.shadowRoot);
    }

    for (const root of roots) {
      const found = this.findInTree(
        root,
        (element): element is UpdatableChartElement =>
          element.localName === "ha-chart-base"
      );
      if (found) return found;
    }

    return undefined;
  }
}
