import { LitElement, html } from "lit";
import { property, state } from "lit/decorators.js";
import { AutoEntitiesConfig } from "../types";
import { sortSchema, sortDataForForm, sortDataFromForm } from "./schema";
import { localize } from "../localize";

class AutoEntitiesSortingEditor extends LitElement {
  @state() _config: AutoEntitiesConfig;
  @property() hass;

  _changeSortOptions(ev) {
    if (!this._config) return;
    const sort = sortDataFromForm(ev.detail.value);
    this._config = { ...this._config, sort };
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: this._config } })
    );
  }

  render() {
    if (Array.isArray(this._config.sort)) {
      return html`
        <div>
          <ha-alert alert-type="info">
            ${localize("sort.multiple_before", this.hass)}
            <b>${localize("common.code_editor", this.hass)}</b>
            ${localize("sort.multiple_after", this.hass)}
          </ha-alert>
        </div>
      `;
    }
    const data = sortDataForForm(this._config.sort);
    return html`
      <div>
        <ha-form
          .hass=${this.hass}
          .data=${data}
          .schema=${sortSchema(this.hass, data.method)}
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
