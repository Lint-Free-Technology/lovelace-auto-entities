import { LitElement } from "lit";
import { CardController, CardControllerHost } from "./base";

const WAIT_TIMEOUT_MS = 3000;
const WAIT_INTERVAL_MS = 50;
const WAIT_INTERVAL_MAX_MS = 500;

type MapElement = Element & {
  clientWidth: number;
  Leaflet?: unknown;
  leafletMap?: unknown;
  fitMap?: () => void;
};

type CardWithElement = Element & {
  _element?: Element;
};

export class MapCardController extends CardController {
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

    const map: any = await this.waitForMap();
    map.leafletMap?.invalidateSize();
    map.fitMap?.();
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
      console.warn("auto-entities: map fit refresh failed", err);
    });
  };

  private isHostVisible(): boolean {
    if (!this.host.isConnected || this.host.hidden) return false;
    return this.host.getClientRects().length > 0;
  }

  private async waitForMap(): Promise<MapElement | undefined> {
    const started = Date.now();
    let wait = WAIT_INTERVAL_MS;
    while (Date.now() - started < WAIT_TIMEOUT_MS) {
      if (!this.isHostVisible()) return undefined;
      const card = this.host.card as CardWithElement | undefined;
      const map = this.findMap(card);
      if (this.isMapReady(map)) return map;
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      wait = Math.min(wait * 2, WAIT_INTERVAL_MAX_MS);
    }
    return undefined;
  }

  private findMap(card: CardWithElement | undefined): MapElement | undefined {
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
        (element): element is MapElement => element.localName === "ha-map"
      );
      if (found) return found;
    }

    return undefined;
  }

  private isMapReady(map: MapElement | undefined): map is MapElement {
    const leafletType = map?.Leaflet ? typeof map.Leaflet : undefined;
    return !!(
      map &&
      map.clientWidth > 0 &&
      typeof map.fitMap === "function" &&
      (typeof map.Leaflet === "object" && map.Leaflet !== null) &&
      (typeof map.leafletMap === "object" && map.leafletMap !== null)
    );
  }
}
