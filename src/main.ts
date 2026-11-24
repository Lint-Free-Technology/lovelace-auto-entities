import { LitElement, html } from "lit";
import { property, state } from "lit/decorators.js";
import {
  hasTemplate,
  bind_template,
  unbind_template,
  TemplateSubscription,
} from "./helpers/templates";
import { get_filter, RULES } from "./filter";
import { get_sorter } from "./sort";
import { get_renamer } from "./rename";
import {
  AutoEntitiesConfig,
  EntityList,
  HuiCard,
  LovelaceRowConfig,
  SPECIAL_TYPES,
} from "./types";
import pjson from "../package.json";
import "./editor/auto-entities-editor";
import { compare_deep } from "./helpers";
import { process_entity } from "./process_entity";
import { getCardController, getCardControllerType } from "./card-controllers";
import { CardController } from "./card-controllers/base";
import { apply_uix_entity_icon_styling } from "./helpers/uix";

window.queueMicrotask =
  window.queueMicrotask || ((handler) => window.setTimeout(handler, 1));

const CARDS_NO_ENTITY_WORKAROUND = [ "logbook", "map", "history-graph", "statistics-graph" ];

/**
 * Pagination over entity rows only: `first` and `count` refer to entities,
 * matching the `first`/`count` documentation ("<count> entities, starting
 * with the <first>"). Rows without an entity (e.g. divider rows inserted
 * by a `divider: true` sort) never count towards the page and are only
 * kept while they sit inside the page; leading ones before the first
 * included entity are dropped.
 */
function paginate_entity_rows(
  rows: EntityList,
  first: number,
  count: number
): EntityList {
  const out: EntityList = [];
  let entityIndex = -1;
  let pageStarted = false;
  for (const row of rows) {
    if (row?.entity) {
      entityIndex++;
      if (entityIndex >= first + count) break;
      if (entityIndex < first) continue;
      pageStarted = true;
    }
    if (pageStarted) out.push(row);
  }
  return out;
}

/**
 * Unconditional cleanup of divider and section rows as the last step before
 * the card is generated: leading dividers are removed, trailing dividers are
 * removed, and consecutive divider rows are collapsed into one. Divider rows
 * directly adjacent to a section row are removed (they add nothing on top of
 * a heading), and a section whose label matches the previous section is
 * dropped as a duplicate. This also covers dividers from `type: divider`
 * include entries landing next to dividers inserted by a `divider: true`
 * sort, and dividers adjacent to include entries that match nothing.
 * Sections are never stripped at the start or the end of the card: a static
 * `type: section` leading or trailing heading is a legitimate layout choice.
 */
function cleanup_special_rows(entities: EntityList): EntityList {
  const isDivider = (e: LovelaceRowConfig) => e?.type === "divider";
  const isSection = (e: LovelaceRowConfig) => e?.type === "section";
  const cleaned: EntityList = [];
  for (const entity of entities) {
    if (isDivider(entity)) {
      const prev = cleaned[cleaned.length - 1];
      if (!cleaned.length || isDivider(prev) || isSection(prev)) continue;
      cleaned.push(entity);
    } else if (isSection(entity)) {
      const prev = cleaned[cleaned.length - 1];
      // A divider directly above the section is redundant.
      if (isDivider(prev)) cleaned.pop();
      // A section with the same label as the previous section is redundant.
      const previous = cleaned[cleaned.length - 1];
      if (isSection(previous) && previous.label === entity.label) continue;
      cleaned.push(entity);
    } else {
      cleaned.push(entity);
    }
  }
  while (cleaned.length && isDivider(cleaned[cleaned.length - 1])) {
    cleaned.pop();
  }
  return cleaned;
}

class AutoEntities extends LitElement {
  connectedWhileHidden = true;
  @property() _config: AutoEntitiesConfig;
  @property() hass: any;
  @property() preview: boolean;
  @property() layout: string;
  @property() card: HuiCard;
  @property() else?: HuiCard;
  @property() _template: string[];
  @state() empty = false;

  _entities: EntityList;
  _cardConfig;
  _templateGeneration?: number;
  _templateResolved = false;
  _templateBindEpoch = 0;
  _templateBindCallback?: (
    value: string,
    subscription?: TemplateSubscription
  ) => void;
  _templateBindKey?: string;
  _updateCooldown = { timer: undefined, rerun: false };
  _cardBuilt?: Promise<void>;
  _cardBuiltResolve?;
  _cardController?: CardController;
  _cardControllerType?: string;
  _llCustomEvents: { [key: string]: any } = {};
  _updateAllListener = () => this.update_all();

  static getConfigElement() {
    return document.createElement("auto-entities-editor");
  }
  static getStubConfig() {
    return {
      card: {
        type: "entities",
      },
      filter: {
        include: [],
        exclude: [],
      },
    };
  }

  setConfig(config: AutoEntitiesConfig) {
    if (!config) {
      throw new Error("No configuration.");
    }

    if (!config.filter && !config.entities) {
      throw new Error("No filters specified.");
    }

    if (config.filter?.include) {
      for (const [index, filter] of config.filter.include.entries()) {
        if (Object.keys(filter).includes("type")) continue;
        for (const k in filter) {
          if (!(k.trim().split(" ")[0].trim() in RULES))
            throw new Error(`Unknown rule "${k}" in include filter ${index}`);
        }
      }
    }

    if (config.filter?.exclude) {
      for (const [index, filter] of config.filter.exclude.entries()) {
        if (Object.keys(filter).includes("type")) continue;
        for (const k in filter) {
          if (!(k.trim().split(" ")[0].trim() in RULES))
            throw new Error(`Unknown rule "${k}" in exclude filter ${index}`);
        }
      }
    }

    if (config.filter?.template !== this._config?.filter?.template) {
      this._template = undefined;
    }

    config = JSON.parse(JSON.stringify(config));
    this._config = config;

    this._syncTemplateBinding();

    this._cardBuilt = new Promise(
      (resolve) => (this._cardBuiltResolve = resolve)
    );

    this._llCustomEvents = {};
    if (this._config.fire_dom_event) {
      for (const [eventName, eventConfig] of Object.entries(
        this._config.fire_dom_event
      )) {
        this._llCustomEvents[eventName] = eventConfig;
      }
    }

    queueMicrotask(() => this.build_else());
    queueMicrotask(() => this.update_all());
  }

  _renderer = (tpl, subscription?: TemplateSubscription) => {
    if (
      subscription &&
      !subscription.isInitial &&
      subscription.generation !== this._templateGeneration
    ) {
      return;
    }
    if (subscription?.isInitial) {
      this._templateGeneration = subscription.generation;
      // Re-attached after the subscription was dropped: keep the last result
      // on screen until the new one arrives, instead of emptying the card.
      const keepLast =
        subscription.isPlaceholder &&
        this._templateResolved &&
        this._template !== undefined;
      this._templateResolved = false;
      if (keepLast) return;
    }
    if (typeof tpl === "string") {
      this._template = tpl.split(/[\s,]+/);
    } else {
      this._template = tpl;
    }
    if (!subscription?.isPlaceholder && !this._templateResolved) {
      this._templateResolved = true;
      window.clearTimeout(this._updateCooldown.timer);
      this._updateCooldown.timer = undefined;
    }
    queueMicrotask(() => this.update_all());
  };

  _unbindTemplateBinding(immediate = false) {
    this._templateBindEpoch += 1;
    const callback = this._templateBindCallback;
    this._templateBindCallback = undefined;
    this._templateBindKey = undefined;
    if (callback) void unbind_template(callback, immediate);
  }

  _syncTemplateBinding() {
    const template = this._config?.filter?.template;
    const bindKey = template && hasTemplate(template)
      ? JSON.stringify([template, this._config])
      : undefined;

    // Only a config change gets here with a binding, and the cooldown is for
    // reattaching, so the old subscription can go now. Disconnect keeps it.
    if (!this.isConnected || !bindKey) {
      this._unbindTemplateBinding(true);
      return;
    }
    if (
      this._templateBindCallback !== undefined &&
      this._templateBindKey === bindKey
    ) {
      return;
    }

    this._unbindTemplateBinding(true);
    const epoch = ++this._templateBindEpoch;
    const callback = (value: string, subscription?: TemplateSubscription) => {
      if (epoch !== this._templateBindEpoch || !this.isConnected) return;
      this._renderer(value, subscription);
    };
    this._templateBindCallback = callback;
    this._templateBindKey = bindKey;

    void bind_template(callback, template, { config: this._config }).then(() => {
      if (epoch !== this._templateBindEpoch || !this.isConnected) {
        const replaced = this.isConnected && this._templateBindKey !== bindKey;
        void unbind_template(callback, replaced);
      }
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._syncTemplateBinding();
    document.addEventListener("auto-entities-update", this._updateAllListener);
    this._cardController?.connected();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._unbindTemplateBinding();
    document.removeEventListener("auto-entities-update", this._updateAllListener);
    this._cardController?.dispose();
  }

  async update_all() {
    if (this.card) {
      this.card.hass = this.hass;
      this.card.preview = this.preview;
    }
    if (this.else) {
      this.else.hass = this.hass;
      this.else.preview = this.preview;
    }

    if (!this.hass) return;

    if (this._updateCooldown.timer) {
      this._updateCooldown.rerun = true;
      return;
    } else {
      this._updateCooldown.rerun = false;
      this._updateCooldown.timer = window.setTimeout(() => {
        this._updateCooldown.timer = undefined;
        if (this._updateCooldown.rerun) this.update_all();
      }, 500);
    }

    const useUixEntityIconStyling =
      this._config.uix_entity_icon_styling === true ||
      (this._config.filter?.include ?? []).some(
        (filter) => filter.uix_entity_icon_styling === true
      );
    const styles = useUixEntityIconStyling
      ? window.getComputedStyle(this)
      : undefined;
    const entities = await this.update_entities(styles);
    this.update_card(entities);
  }

  async build_else() {
    if (this._config.else === undefined) return;
    this.else = document.createElement("hui-card") as HuiCard;
    this.else.hass = this.hass;
    this.else.preview = this.preview;
    this.else.layout = this.layout;
    this.else.config = this._config.else;
    this.else.load();
  }

  async update_card(entities: EntityList) {
    if (
      this._entities &&
      compare_deep(entities, this._entities) &&
      compare_deep(this._cardConfig, this._config.card)
    )
      return;
    const newType = this._cardConfig?.type !== this._config.card?.type;
    this._entities = entities;
    this._cardConfig = JSON.parse(JSON.stringify(this._config.card ?? {}));
    const cardControllerType = getCardControllerType(this._cardConfig.type, {
      card_param: this._config.card_param,
      entities,
    });
    if (this._cardControllerType !== cardControllerType) {
      this._cardController?.dispose();
      this._cardControllerType = cardControllerType;
      this._cardController = getCardController(this._cardConfig.type, this, {
        card_param: this._config.card_param,
        entities,
      });
    }
    const cardEntities = (entities.length > 0) ? 
      entities : 
      CARDS_NO_ENTITY_WORKAROUND.includes(this._cardConfig.type) ? [{ entity: "auto_entities.dummy" }] : [];
    const cardConfig = {
      type: "entities",
      [this._config.card_param || "entities"]: cardEntities,
      ...this._config.card,
    };

    if (!this.card || newType) {
      this.card = document.createElement("hui-card") as HuiCard;
      this.card.hass = this.hass;
      this.card.preview = this.preview;
      this.card.layout = this.layout;
      this.card.config = cardConfig;
      this.card.load();
    } else {
      this.card.config = cardConfig;
      this.card.load();
    }

    this._cardBuiltResolve?.();

    this.empty =
      entities.length === 0 ||
      entities.every((e) => SPECIAL_TYPES.includes(e.type));
    if (this._config.card_as_row) {
      this.dispatchEvent(
        new CustomEvent("row-visibility-changed", { detail: { row: this, value: !this.hidden}, bubbles: true, cancelable: true, composed: true })
      );
    } else {
      this.dispatchEvent(
        new CustomEvent("card-visibility-changed", {
          detail: { value: !this.hidden },
          bubbles: true,
          cancelable: true,
        })
      );
    }
    if ((this.card as any).requestUpdate) {
      await this.updateComplete;
      (this.card as any).requestUpdate();
    }
    if (Object.keys(this._llCustomEvents).length > 0) {
      for (const [eventName, eventConfig] of Object.entries(
        this._llCustomEvents
      )) {
        const eventDetail = JSON.parse(JSON.stringify(eventConfig).replace(/"this\.config"/g, JSON.stringify(cardConfig || {})));
        document.dispatchEvent(new CustomEvent("ll-custom", { detail: { [eventName]: eventDetail }, bubbles: true, cancelable: true }));
      }
    }
  }

  async update_entities(styles?: CSSStyleDeclaration) {
    const format = (entity: LovelaceRowConfig | string): LovelaceRowConfig => {
      if (!entity) return null;
      return typeof entity === "string" ? { entity: entity.trim() } : entity;
    };

    let entities: EntityList = [...(this._config?.entities?.map(format) || [])];

    if (!this.hass) {
      return entities;
    }

    if (this._template) {
      entities = entities.concat(this._template.map(format));
    }
    entities = entities.filter(Boolean);

    const include_filters = await Promise.all(
      (this._config.filter?.include ?? []).map(async (filter) => {
        const useUixEntityIconStyling =
          filter.uix_entity_icon_styling === true;
        if (filter.type !== undefined) {
          const { uix_entity_icon_styling, ...rowConfig } = filter;
          return async () => [
            useUixEntityIconStyling
              ? apply_uix_entity_icon_styling(rowConfig, styles)
              : rowConfig,
          ];
        }

        const filters = await get_filter(this.hass, filter);
        const filterSort = filter.sort;
        const sorter =
          (Array.isArray(filterSort) ? filterSort.length > 0 : filterSort?.method !== undefined || filterSort?.reverse === true)
            ? await get_sorter(this.hass, filterSort)
            : (x) => x;
        const rename_has_type = filter.rename?.type !== undefined &&
          !(Array.isArray(filter.rename.type) && filter.rename.type.length === 0);
        const rename_has_string_ops = !!(filter.rename?.find !== undefined ||
          filter.rename?.replace !== undefined ||
          filter.rename?.prepend !== undefined ||
          filter.rename?.append !== undefined);
        const renamer = (filter.rename?.method || rename_has_type || rename_has_string_ops)
          ? await get_renamer(this.hass, filter.rename)
          : (x) => x;

        const post_process = async (entity) => {
          const processed = await process_entity(
            this.hass,
            { ...entity, ...filter.options },
            entity.entity
          );
          return useUixEntityIconStyling
            ? apply_uix_entity_icon_styling(processed, styles)
            : processed;
        };

        return async (entities: EntityList) => {
          let add = entities.filter(filters);
          // Filter-local rename
          add = await renamer(add);
          // Filter-local sort
          add = await sorter(add);
          // Filter-local pagination. `first` and `count` count entity rows
          // only: rows without an entity (e.g. divider rows inserted by a
          // `divider: true` sort) never count towards the page.
          const filterSortPagination = Array.isArray(filter.sort)
            ? filter.sort[0]
            : filter.sort;
          if (filterSortPagination?.count || filterSortPagination?.first) {
            add = paginate_entity_rows(
              add,
              filterSortPagination?.first ?? 0,
              filterSortPagination?.count ?? Infinity
            );
          }
          add = await Promise.all(add.map(post_process));
          return add;
        };
      })
    );

    const exclude_filters = await Promise.all(
      (this._config.filter?.exclude ?? []).map(async (filter) => {
        const filters = await get_filter(this.hass, filter);
        return filters;
      })
    );

    const all_entities: EntityList = Object.keys(this.hass.states).map(format);
    // Include
    entities = entities.concat(
      ...(await Promise.all(include_filters.map((f) => f(all_entities))))
    );
    // Exclude
    entities = entities.filter((e) => !exclude_filters.some((f) => f(e)));

    // Global rename
    const global_rename_has_type = this._config.rename?.type !== undefined &&
      !(Array.isArray(this._config.rename.type) && this._config.rename.type.length === 0);
    const global_rename_has_string_ops = !!(this._config.rename?.find !== undefined ||
      this._config.rename?.replace !== undefined ||
      this._config.rename?.prepend !== undefined ||
      this._config.rename?.append !== undefined);
    const renamer = (this._config.rename?.method || global_rename_has_type || global_rename_has_string_ops)
      ? await get_renamer(this.hass, this._config.rename)
      : (x) => x;
    entities = await renamer(entities);

    // Global sort
    const globalSort = this._config.sort;
    const sorter =
      (Array.isArray(globalSort) ? globalSort.length > 0 : globalSort?.method !== undefined || globalSort?.reverse === true)
        ? await get_sorter(this.hass, globalSort)
        : (x) => x;
    entities = await sorter(entities);

    // Unique
    if (this._config.unique) {
      let isDeduplicatedByAttribute = false;
      let sorter = (
        entity: LovelaceRowConfig,
        index: number,
        self: LovelaceRowConfig[]
      ) => index === self.findIndex((e) => compare_deep(e, entity));

      if (this._config.unique === "entity") {
        sorter = (
          entity: LovelaceRowConfig,
          index: number,
          self: LovelaceRowConfig[]
        ) => index === self.findIndex((e) => e.entity === entity.entity);
      } else if (typeof this._config.unique === "string") {
        const uniqueAttribute = this._config.unique;
        const seenAttributeValues: unknown[] = [];
        entities = entities.filter((entity) => {
          const attributeValue = uniqueAttribute
            .split(":")
            .reduce(
              (value, key) => value?.[key],
              this.hass.states[entity.entity]?.attributes
            );

          // Keep rows that do not have the configured attribute.
          if (attributeValue === undefined) return true;
          if (
            seenAttributeValues.some((value) =>
              compare_deep(value, attributeValue)
            )
          ) {
            return false;
          }

          seenAttributeValues.push(attributeValue);
          return true;
        });
        isDeduplicatedByAttribute = true;
      }

      if (!isDeduplicatedByAttribute) {
        // Only entity rows take part in deduplication. Rows without an
        // entity (e.g. divider rows inserted by a `divider: true` sort, or
        // static `type: divider`/`section` include entries) are kept as-is:
        // with `unique: true` they would otherwise all deep-compare equal,
        // and with `unique: "entity"` they would all collapse into the first
        // row without an entity, losing group separators.
        const seen: EntityList = [];
        entities = entities.filter((entity) => {
          if (!entity?.entity) return true;
          const keep = sorter(entity, seen.length, [...seen, entity]);
          seen.push(entity);
          return keep;
        });
      }
    }

    // Pagination
    const globalSortPagination = Array.isArray(this._config.sort)
      ? this._config.sort[0]
      : this._config.sort;
    if (globalSortPagination?.count || globalSortPagination?.first) {
      // Global pagination over entity rows only, consistent with
      // filter-local pagination.
      entities = paginate_entity_rows(
        entities,
        globalSortPagination?.first ?? 0,
        globalSortPagination?.count ?? Infinity
      );
    }

    if (this._config.uix_entity_icon_styling === true) {
      entities = entities.map((entity) =>
        apply_uix_entity_icon_styling(entity, styles)
      );
    }

    entities = cleanup_special_rows(entities);

    return entities;
  }

  async updated(changedProperties) {
    if (
      changedProperties.has("_template") ||
      (changedProperties.has("hass") && this.hass)
    ) {
      queueMicrotask(() => this.update_all());
    }
    if (changedProperties.has("preview")) {
      if (this.card) this.card.preview = this.preview;
      if (this.else) this.else.preview = this.preview;
    }
  }

  createRenderRoot() {
    return this;
  }
  render() {
    return html`${this.empty &&
    ((this._config.show_empty === false && !this.preview) || this._config.else)
      ? this.else
      : this.card}`;
  }

  async getCardSize() {
    let len = 0;
    await this._cardBuilt;
    if (this.card && this.card.getCardSize) len = await this.card.getCardSize();
    if (len === 1 && this._entities?.length) len = this._entities.length;
    if (len === 0 && this._config.filter?.include)
      len = Object.keys(this._config.filter.include).length;
    return len || 5;
  }

  get hidden() {
    const hide =
      !this.preview &&
      this.empty &&
      this._config.show_empty === false &&
      this._config.else === undefined;
    return hide;
  }
}

if (!customElements.get("auto-entities")) {
  customElements.define("auto-entities", AutoEntities);
  console.groupCollapsed(
    `%c💡 AUTO-ENTITIES ${pjson.version} IS INSTALLED 💡`,
    'color: white; background-color: #CE3226; padding: 2px 5px; font-weight: bold; border-radius: 5px;',
  );
  console.log('Readme:', 'https://github.com/Lint-Free-Technology/lovelace-auto-entities');
  console.groupEnd();
}
