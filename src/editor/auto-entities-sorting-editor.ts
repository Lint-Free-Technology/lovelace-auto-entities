import { LitElement, html } from "lit";
import { property, state } from "lit/decorators.js";
import { AutoEntitiesConfig, SortConfig } from "../types";
import { sortSchema } from "./schema";

/**
 * HA's YAML editor can sometimes convert a YAML array into a numbered object
 * (e.g. `["a","b"]` → `{"0":"a","1":"b"}`). This helper normalizes such
 * values back to a proper JS array so the rest of the editor can rely on
 * `Array.isArray()`.
 */
function normalizeSortConfig(
  sort: any
): SortConfig | SortConfig[] | undefined {
  if (!sort || Array.isArray(sort)) return sort;
  if (typeof sort === "object") {
    const keys = Object.keys(sort);
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => sort[k]) as SortConfig[];
    }
  }
  return sort as SortConfig;
}

class AutoEntitiesSortingEditor extends LitElement {
  @state() _config: AutoEntitiesConfig;
  @property() hass;

  _changeSortOptions(ev) {
    if (!this._config) return;
    const sort = ev.detail.value;
    this._config = { ...this._config, sort };
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: this._config } })
    );
  }

  render() {
    const sort = normalizeSortConfig(this._config?.sort);
    if (Array.isArray(sort)) {
      return html`
        <div>
          <ha-alert alert-type="info">
            Multiple sort levels are configured. Please use the
            <b>CODE EDITOR</b> to edit them.
          </ha-alert>
        </div>
      `;
    }
    const data = (sort as SortConfig) ?? ({} as SortConfig);
    return html`
      <div>
        <ha-form
          .hass=${this.hass}
          .data=${data}
          .schema=${sortSchema(data.method)}
          .computeLabel=${(s) => s.label ?? s.name}
          @value-changed=${this._changeSortOptions}
        ></ha-form>
      </div>
    `;
  }
}
customElements.define(
  "auto-entities-sorting-editor",
  AutoEntitiesSortingEditor
);
