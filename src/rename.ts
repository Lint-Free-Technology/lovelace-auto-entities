import { getAreas, getDevices, getEntities } from "./helpers";
import { HassObject, HAState, LovelaceRowConfig, RenameConfig, EntityNameItem, EntityList } from "./types";

function strip_prefix(name: string, prefix: string | undefined): string {
  if (!prefix) return name;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return name.replace(new RegExp(`^${escaped}\\s*`, "i"), "").trim() || name;
}

function get_friendly(x: HAState): string {
  return x?.attributes?.friendly_name || x?.entity_id?.split(".")[1];
}

/**
 * Convert user-facing shorthand strings ("entity", "device", "area", "floor")
 * to the HA-native object form ({ type: "entity" } etc.) that
 * hass.formatEntityName expects.  Object items pass through unchanged.
 */
function to_ha_items(
  type_config: string | EntityNameItem | EntityNameItem[]
): Array<{ type: string; text?: string }> {
  const arr: EntityNameItem[] = Array.isArray(type_config)
    ? type_config
    : [type_config as EntityNameItem];
  return arr.map((item) =>
    typeof item === "string" ? { type: item } : (item as { type: string; text?: string })
  );
}

const NAME_EXTRACTORS: Record<
  string,
  (x: HAState, config: RenameConfig, hass: HassObject) => any | Promise<any>
> = {
  friendly_name: (x) => get_friendly(x),
  name: (x) => get_friendly(x),
  entity_id: (x) => x?.entity_id,
  domain: (x) => x?.entity_id?.split(".")[0],
  state: (x) => x?.state,
  attribute: (x, c) =>
    c?.attribute?.split(":").reduce((_x, key) => _x?.[key], x?.attributes),
  device: async (x, _c, hass) => {
    const [entities, devices] = await Promise.all([
      getEntities(hass),
      getDevices(hass),
    ]);
    const ent = entities[x.entity_id];
    if (!ent) return undefined;
    const dev = devices[ent.device_id];
    if (!dev) return undefined;
    return dev.name_by_user ?? dev.name;
  },
  area: async (x, _c, hass) => {
    const [entities, devices, areas] = await Promise.all([
      getEntities(hass),
      getDevices(hass),
      getAreas(hass),
    ]);
    const ent = entities[x.entity_id];
    if (!ent) return undefined;
    let area = areas[ent.area_id];
    if (area) return area.name;
    const dev = devices[ent.device_id];
    if (!dev) return undefined;
    area = areas[dev.area_id];
    if (!area) return undefined;
    return area.name;
  },
  remove_device: async (x, _c, hass) => {
    const [entities, devices] = await Promise.all([
      getEntities(hass),
      getDevices(hass),
    ]);
    const friendly = get_friendly(x);
    const ent = entities[x.entity_id];
    if (!ent) return friendly;
    const dev = devices[ent.device_id];
    if (!dev) return friendly;
    return strip_prefix(friendly, dev.name_by_user ?? dev.name);
  },
  remove_area: async (x, _c, hass) => {
    const [entities, devices, areas] = await Promise.all([
      getEntities(hass),
      getDevices(hass),
      getAreas(hass),
    ]);
    const friendly = get_friendly(x);
    const ent = entities[x.entity_id];
    if (!ent) return friendly;
    let area = areas[ent.area_id];
    if (!area) {
      const dev = devices[ent.device_id];
      if (dev) area = areas[dev.area_id];
    }
    if (!area) return friendly;
    return strip_prefix(friendly, area.name);
  },
  state_translated: (_x, _c, hass) => {
    return hass.formatEntityState ? hass.formatEntityState(_x) : _x?.state;
  },
};

function has_string_ops(config: RenameConfig): boolean {
  return (
    config.find !== undefined ||
    config.replace !== undefined ||
    config.prepend !== undefined ||
    config.append !== undefined ||
    config.trim === true
  );
}

export async function get_renamer(hass: HassObject, config: RenameConfig) {
  const has_type = config.type !== undefined &&
    !(Array.isArray(config.type) && config.type.length === 0);
  if (!config.method && !has_type && !has_string_ops(config))
    return (x: EntityList) => x;

  const rename = async (
    values: LovelaceRowConfig[]
  ): Promise<LovelaceRowConfig[]> => {
    const [entities, devices, areas] = await Promise.all([
      getEntities(hass),
      getDevices(hass),
      getAreas(hass),
    ]);

    return Promise.all(
      values.map(async (entity) => {
        if (!entity.entity) return entity;
        const state = hass.states[entity.entity];
        if (!state) return entity;

        const entity_id = state.entity_id;
        const ent = entities[entity_id];
        const dev = ent ? devices[ent.device_id] : undefined;
        let area = ent ? areas[ent.area_id] : undefined;
        if (area === undefined) area = dev ? areas[dev.area_id] : undefined;

        const entity_name = ent?.name_by_user ?? ent?.name;
        const device_name = dev?.name_by_user ?? dev?.name;
        const area_name = area?.name;

        let name: string;

        if (has_type) {
          // Home Assistant native path: delegate to hass.formatEntityName so the
          // output always matches what the HA frontend would display.
          if (typeof hass.formatEntityName !== "function") return entity;
          const items = to_ha_items(config.type);
          const options = config.separator !== undefined
            ? { separator: config.separator }
            : undefined;
          name = hass.formatEntityName(state, items, options);
        } else if (config.method) {
          // Single-method extraction path
          const extract = NAME_EXTRACTORS[config.method];
          if (!extract) return entity;
          const raw = await extract(state, config, hass);
          if (raw === undefined) return entity;
          name = String(raw);
        } else {
          // String operations only — start from the friendly name
          name = get_friendly(state);
        }

        const original_name = name;

        const eval_str = (str: string): string => {
          if (!config.eval_js) return str;
          try {
            const state_translated = hass.formatEntityState
              ? hass.formatEntityState(state)
              : state?.state;
            const fn = new Function(
              "entity_id",
              "entity",
              "device",
              "area",
              "state",
              "state_translated",
              "name",
              `"use strict"; return \`${str}\`;`
            );
            return fn(
              entity_id,
              entity_name,
              device_name,
              area_name,
              state?.state,
              state_translated,
              original_name
            );
          } catch (e) {
            return str;
          }
        };

        if (config.find !== undefined) {
          const finds = Array.isArray(config.find) ? config.find : [config.find];
          const replaces = Array.isArray(config.replace)
            ? config.replace
            : config.replace !== undefined
            ? [config.replace]
            : [];
          for (let i = 0; i < finds.length; i++) {
            name = name.replace(
              new RegExp(finds[i], "g"),
              eval_str(replaces[i] ?? "")
            );
          }
        }
        if (config.prepend !== undefined) {
          name = eval_str(config.prepend) + name;
        }
        if (config.append !== undefined) {
          name = name + eval_str(config.append);
        }
        if (config.trim) {
          name = name.trim();
        }

        return { ...entity, name };
      })
    );
  };

  return rename;
}
