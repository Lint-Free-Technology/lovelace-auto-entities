import { LitElement, html } from "lit";
import { property, state } from "lit/decorators.js";
import { AutoEntitiesConfig, RenameConfig } from "../types";
import { renameSchema } from "./schema";

class AutoEntitiesRenameEditor extends LitElement {
  @state() _config: AutoEntitiesConfig;
  @property() hass;

  _changeRenameOptions(ev) {
    if (!this._config) return;
    const rename = ev.detail.value;
    this._config = { ...this._config, rename };
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: this._config } })
    );
  }

  render() {
    const data: Partial<RenameConfig> = this._config.rename ?? {};
    return html`
      <div>
        <ha-form
          .hass=${this.hass}
          .data=${data}
          .schema=${renameSchema(data.method)}
          .computeLabel=${(s) => s.label ?? s.name}
          @value-changed=${this._changeRenameOptions}
        ></ha-form>
      </div>
    `;
  }
}
customElements.define(
  "auto-entities-rename-editor",
  AutoEntitiesRenameEditor
);
