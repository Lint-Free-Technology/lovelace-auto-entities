import { hass } from "./hass";
import { BrowserID } from "./browser_id";

interface CachedTemplate {
  template: string;
  variables: object;
  value: string;
  generation: number;
  hasResult: boolean;
  callbacks: Set<TemplateCallback>;
  unsubscribe: Promise<() => Promise<void>>;
}

interface RenderTemplateResult {
  result: string;
  listeners: any;
}

export interface TemplateSubscription {
  generation: number;
  isPlaceholder: boolean;
  isInitial: boolean;
}

type TemplateCallback = (value: string, subscription?: TemplateSubscription) => void;

(window as any).cardMod_template_cache =
  (window as any).cardMod_template_cache || {};

const cachedTemplates: Record<string, CachedTemplate> = (window as any)
  .cardMod_template_cache;

let templateGeneration = 0;

function template_updated(
  key: string,
  result: RenderTemplateResult
): Promise<void> {
  const cache = cachedTemplates[key];
  if (!cache) {
    return;
  }
  cache.value = result.result;
  cache.hasResult = true;
  cache.callbacks.forEach((f) =>
    f(result.result, {
      generation: cache.generation,
      isPlaceholder: false,
      isInitial: false,
    })
  );
}

export function hasTemplate(str) {
  if (!str) return false;
  return String(str).includes("{%") || String(str).includes("{{");
}

export async function bind_template(
  callback: TemplateCallback,
  template: string,
  variables: object
): Promise<void> {
  const hs = await hass();
  const connection = hs.connection;

  const cacheKey = JSON.stringify([template, variables]);
  let cache = cachedTemplates[cacheKey];
  if (!cache) {
    unbind_template(callback);

    variables = {
      user: hs.user.name,
      browser: BrowserID(),
      hash: location.hash.substr(1) || "",
      ...variables,
    };

    cachedTemplates[cacheKey] = cache = {
      template,
      variables,
      value: "",
      generation: ++templateGeneration,
      hasResult: false,
      callbacks: new Set([callback]),
      unsubscribe: connection.subscribeMessage(
        (result: RenderTemplateResult) => template_updated(cacheKey, result),
        {
          type: "render_template",
          template,
          variables,
        }
      ),
    };
    callback("", {
      generation: cache.generation,
      isPlaceholder: true,
      isInitial: true,
    });
  } else {
    // Caches created before this version do not have timing metadata.
    cache.generation ??= ++templateGeneration;
    cache.hasResult ??= cache.value !== "";
    const isNewCallback = !cache.callbacks.has(callback);
    if (isNewCallback) {
      unbind_template(callback);
      callback(cache.value, {
        generation: cache.generation,
        isPlaceholder: !cache.hasResult,
        isInitial: true,
      });
      cache.callbacks.add(callback);
    }
  }
}

export async function unbind_template(
  callback: TemplateCallback
): Promise<void> {
  let unsubscriber: Promise<() => Promise<void>>;
  for (const [key, cache] of Object.entries(cachedTemplates)) {
    if (cache.callbacks.has(callback)) {
      cache.callbacks.delete(callback);
      if (cache.callbacks.size == 0) {
        unsubscriber = cache.unsubscribe;
        delete cachedTemplates[key];
      }
      break;
    }
  }
  if (unsubscriber) await (await unsubscriber)();
}
