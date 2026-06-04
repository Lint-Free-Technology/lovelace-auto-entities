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

  dispose(): void {}

  protected findInTree(
    root: Element | ShadowRoot,
    matcher: (element: Element) => boolean
  ): Element | undefined;
  protected findInTree<T extends Element>(
    root: Element | ShadowRoot,
    matcher: (element: Element) => element is T
  ): T | undefined;
  protected findInTree(
    root: Element | ShadowRoot,
    matcher: (element: Element) => boolean
  ): Element | undefined {
    const stack: Array<Element | ShadowRoot> = [root];

    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;

      if (current instanceof Element) {
        if (matcher(current)) return current;
        if (current.shadowRoot) stack.push(current.shadowRoot);
        stack.push(...Array.from(current.children));
      } else {
        stack.push(...Array.from(current.children));
      }
    }

    return undefined;
  }
}
