import { CardController, CardControllerHost } from "./base";

const WAIT_TIMEOUT_MS = 3000;
const WAIT_INTERVAL_MS = 100;
const WAIT_INTERVAL_MAX_MS = 500;

type TrendGraphFeatureElement = Element & {
  _unsubscribeHistory?: () => void;
  firstUpdated?: () => void | Promise<void>;
};

type CardWithElement = Element & {
  _element?: Element;
};

export class TileCardController extends CardController {
  private refreshPromise?: Promise<void>;

  constructor(host: CardControllerHost) {
    super(host);
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

    const features = await this.waitForTrendGraphFeatures();
    for (const feature of features) {
      // Workaround for hidden->visible tile trend features not re-subscribing history.
      feature._unsubscribeHistory?.();
      await feature.firstUpdated?.();
    }
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
      console.warn("auto-entities: tile trend-graph refresh failed", err);
    });
  };

  private isHostVisible(): boolean {
    if (!this.host.isConnected || this.host.hidden) return false;
    return this.host.getClientRects().length > 0;
  }

  private async waitForTrendGraphFeatures(): Promise<TrendGraphFeatureElement[]> {
    const started = Date.now();
    let wait = WAIT_INTERVAL_MS;
    while (Date.now() - started < WAIT_TIMEOUT_MS) {
      if (!this.isHostVisible()) return [];
      const card = this.host.card as CardWithElement | undefined;
      const features = this.findTrendGraphFeatures(card);
      if (features.length > 0) return features;
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      wait = Math.min(wait * 2, WAIT_INTERVAL_MAX_MS);
    }
    return [];
  }

  private findTrendGraphFeatures(
    card: CardWithElement | undefined
  ): TrendGraphFeatureElement[] {
    if (!card) return [];

    const roots: Array<Element | ShadowRoot> = [card];
    if (card.shadowRoot) roots.push(card.shadowRoot);
    if (card._element) {
      roots.push(card._element);
      if (card._element.shadowRoot) roots.push(card._element.shadowRoot);
    }

    const seen = new Set<TrendGraphFeatureElement>();
    const features: TrendGraphFeatureElement[] = [];

    for (const root of roots) {
      const queue: Array<Element | ShadowRoot> = [root];
      while (queue.length) {
        const current = queue.shift();
        if (!current) continue;
        const children = Array.from(current.children);
        queue.push(...children);
        if (current instanceof Element) {
          if (current.shadowRoot) queue.push(current.shadowRoot);
          if (current.localName === "hui-trend-graph-card-feature") {
            const feature = current as TrendGraphFeatureElement;
            if (!seen.has(feature)) {
              seen.add(feature);
              features.push(feature);
            }
          }
        }
      }
    }

    return features;
  }
}
