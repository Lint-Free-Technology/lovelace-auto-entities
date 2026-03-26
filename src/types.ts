export interface SortConfig {
  method: string;
  reverse?: boolean;
  ignore_case?: boolean;
  attribute?: string;
  first?: number;
  count?: number;
  numeric?: boolean;
  ip?: boolean;
}

/**
 * HA-style entity name part. Mirrors the EntityNameItem type from the HA frontend.
 * - `"entity"` / `{type:"entity"}` — the entity's own name (from registry original_name / user name)
 * - `"device"` / `{type:"device"}` — device name
 * - `"area"` / `{type:"area"}` — area name
 * - `"floor"` / `{type:"floor"}` — floor name
 * - `{type:"text", text:"..."}` — literal text
 */
export type EntityNameItem =
  | "entity"
  | "device"
  | "area"
  | "floor"
  | { type: "entity" | "device" | "area" | "floor" }
  | { type: "text"; text: string };

export interface RenameConfig {
  /** Single-value extraction method. Mutually exclusive with `type`. */
  method?: string;
  /**
   * HA-style name composition — one or more EntityNameItem parts (or a plain
   * type string such as `"entity"`). Parts are joined with `separator`.
   * Mutually exclusive with `method`.
   */
  type?: string | EntityNameItem | EntityNameItem[];
  /** Separator used when `type` is an array. Defaults to `" "`. */
  separator?: string;
  attribute?: string;
  find?: string;
  replace?: string;
  prepend?: string;
  append?: string;
  eval_js?: boolean;
}

interface FilterConfig {
  domain?: string;
  entity_id?: string;
  state?: string;
  name?: string;
  group?: string;

  area?: string;
  device?: string;
  device_manufacturer?: string;
  device_model?: string;

  attributes?: Record<string, string>;

  last_changed?: string | number;
  last_updated?: string | number;
  last_triggered?: string | number;

  entity_category?: string;
  integration?: string;
  hidden_by?: string;

  not?: FilterConfig;
  or?: FilterConfig[];

  options?: any;
  sort?: SortConfig;
  rename?: RenameConfig;
  type?: string;
}

export interface AutoEntitiesConfig {
  card: any;
  entities: Array<LovelaceRowConfig | string>;
  filter: {
    template?: string;
    include?: FilterConfig[];
    exclude?: FilterConfig[];
  };

  card_param?: string;
  card_as_row?: boolean;

  show_empty?: boolean;
  else?: any;
  unique?: boolean | string;
  sort?: any;
  rename?: RenameConfig;

  entity_ids?: any[];
}

export interface LovelaceRowConfig {
  entity?: string;
  type?: string;
}
export interface LovelaceCard extends HTMLElement {
  hass: any;
  setConfig(config: any): void;
  getCardSize?(): number;
  preview?: boolean;
}
export interface HuiCard extends LovelaceCard {
  load(): void;
  config?: any;
  layout?: string;
  _element?: LovelaceCard;
}
export interface HuiErrorCard extends LovelaceCard {
  _config: any;
}

export interface HAState {
  entity_id: string;
  state: string;
  attributes?: Record<string, any>;
  last_changed: number;
  last_updated: number;
}

type SubscriptionUnsubscribe = () => Promise<void>;
export interface HassObject {
  states: HAState[];
  callWS: (_: any) => any;
  formatEntityState: (stateObj, state?) => string;
  formatEntityAttributeValue: (stateObj, attribute, value?) => string;
  formatEntityAttributeName: (stateObj, attribute) => string;
  /** Available in HA 2024.x+. Used for HA-style entity name composition. */
  formatEntityName?: (stateObj: any, type: any, options?: { separator?: string }) => string;
  connection: {
    subscribeEvents: (callback: (event: any) => void, eventType: string) => Promise<SubscriptionUnsubscribe>;
  };
}

export type MatchValue = string | number;

export type EntityList = Array<LovelaceRowConfig>;

export interface CardEntity {}
