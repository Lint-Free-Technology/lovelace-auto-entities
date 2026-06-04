import { CardController } from "./base";

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
  async afterCardUpdated(): Promise<void> {
    if (!this.isHostVisible()) return;

    const map = await this.waitForMap();
    map?.fitMap?.();
  }

  private isHostVisible(): boolean {
    if (!this.host.isConnected || this.host.hidden) return false;
    return this.host.getClientRects().length > 0;
  }

  private async waitForMap(): Promise<MapElement | undefined> {
    const started = Date.now();
    let wait = WAIT_INTERVAL_MS;
    while (Date.now() - started < WAIT_TIMEOUT_MS) {
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
    return !!(map && map.clientWidth > 0 && map.leafletMap && map.Leaflet);
  }
}
