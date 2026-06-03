import { CardController } from "./base";

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
  async afterCardUpdated(): Promise<void> {
    if (!this.isHostVisible()) return;

    const chart = await this.waitForChartBase();
    if (!chart) return;

    chart.requestUpdate?.("_themes");
  }

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
      const found = this.findInTree(root);
      if (found) return found;
    }

    return undefined;
  }

  private findInTree(
    root: Element | ShadowRoot
  ): UpdatableChartElement | undefined {
    const stack: Array<Element | ShadowRoot> = [root];

    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;

      if (current instanceof Element) {
        if (current.localName === "ha-chart-base") return current as UpdatableChartElement;
        if (current.shadowRoot) stack.push(current.shadowRoot);
        stack.push(...Array.from(current.children));
      } else {
        stack.push(...Array.from(current.children));
      }
    }

    return undefined;
  }
}
