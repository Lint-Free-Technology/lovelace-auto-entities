import { getAreas, getDevices, getEntities, getFloors } from "./helpers";
import { HassObject, HAState, LovelaceRowConfig, RenameConfig, EntityNameItem, EntityList } from "./types";

function strip_prefix(name: string, prefix: string | undefined): string {
  if (!prefix) return name;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return name.replace(new RegExp(`^${escaped}\\s*`, "i"), "").trim() || name;
}

function get_friendly(x: HAState): string {
  return x?.attributes?.friendly_name || x?.entity_id?.split(".")[1];
}

/** Resolve an EntityNameItem to a canonical type string and optional text. */
function item_type(item: EntityNameItem): { kind: string; text?: string } {
  if (typeof item === "string") return { kind: item };
  if ("text" in item) return { kind: "text", text: item.text };
  return { kind: item.type };
}

/**
 * HA-style name composition.
 * Models `hass.formatEntityName(stateObj, type, {separator})` from the HA frontend.
 * When an entity uses its device name (has no original_name), items of type
 * "entity" are silently promoted to "device" — mirroring HA's behaviour.
 */
async function get_name_by_type(
  type_config: string | EntityNameItem | EntityNameItem[],
  separator: string,
  x: HAState,
  hass: HassObject
): Promise<string> {
  // Normalise to array
  const items: EntityNameItem[] = Array.isArray(type_config)
    ? type_config
    : [typeof type_config === "string" ? (type_config as EntityNameItem) : type_config];

  const [entities, devices, areas, floors] = await Promise.all([
    getEntities(hass),
    getDevices(hass),
    getAreas(hass),
    getFloors(hass),
  ]);

  const ent = entities[x.entity_id];
  const dev = ent?.device_id ? devices[ent.device_id] : undefined;
  let area = ent?.area_id ? areas[ent.area_id] : undefined;
  if (!area && dev?.area_id) area = areas[dev.area_id];
  const floor = area?.floor_id ? floors[area.floor_id] : undefined;

  // Entity's own name (user-set or original_name from registry)
  const entity_own_name: string | undefined = ent ? (ent.name ?? ent.original_name) ?? undefined : get_friendly(x);

  // When the entity has no own name it "uses" the device name — mirror HA's
  // entityUseDeviceName logic: replace entity items with device items.
  const uses_device_name = ent ? !entity_own_name : false;

  const device_name: string | undefined = dev ? (dev.name_by_user ?? dev.name) : undefined;

  const names = items.map((raw_item) => {
    let { kind, text } = item_type(raw_item);
    if (kind === "entity" && uses_device_name) kind = "device";
    switch (kind) {
      case "entity": return entity_own_name;
      case "device": return device_name;
      case "area":   return area?.name;
      case "floor":  return floor?.name;
      case "text":   return text;
      default:       return undefined;
    }
  });

  return names.filter((n) => n != null).join(separator);
}

const NAME_EXTRACTORS: Record<
  string,
  (x: HAState, method: RenameConfig, hass: HassObject) => any | Promise<any>
> = {
  friendly_name: (x) => get_friendly(x),
  name: (x) => get_friendly(x),
  entity_id: (x) => x?.entity_id,
  domain: (x) => x?.entity_id?.split(".")[0],
  state: (x) => x?.state,
  attribute: (x, m) =>
    m?.attribute?.split(":").reduce((_x, key) => _x?.[key], x?.attributes),
  device: async (x, m, hass) => {
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
  area: async (x, m, hass) => {
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
  remove_device: async (x, m, hass) => {
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
  remove_area: async (x, m, hass) => {
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
};

export async function get_renamer(hass: HassObject, config: RenameConfig) {
  // Require at least one of method or type
  if (!config.method && config.type === undefined) return (x: EntityList) => x;

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

        let name: string | undefined;

        if (config.type !== undefined) {
          // HA-style composition path
          name = await get_name_by_type(
            config.type,
            config.separator ?? " ",
            state,
            hass
          );
        } else {
          // Single-method extraction path
          const extract = NAME_EXTRACTORS[config.method!];
          if (!extract) return entity;
          const raw = await extract(state, config, hass);
          if (raw === undefined) return entity;
          name = String(raw);
        }

        if (name === undefined) return entity;
        name = String(name);

        const original_name = name;

        const eval_str = (str: string): string => {
          if (!config.eval_js) return str;
          try {
            const fn = new Function(
              "entity_id",
              "entity",
              "device",
              "area",
              "state",
              "name",
              `"use strict"; return \`${str}\`;`
            );
            return fn(
              entity_id,
              entity_name,
              device_name,
              area_name,
              state,
              original_name
            );
          } catch (e) {
            return str;
          }
        };

        if (config.find !== undefined) {
          name = name.replace(
            new RegExp(config.find, "g"),
            eval_str(config.replace ?? "")
          );
        }
        if (config.prepend !== undefined) {
          name = eval_str(config.prepend) + name;
        }
        if (config.append !== undefined) {
          name = name + eval_str(config.append);
        }

        return { ...entity, name };
      })
    );
  };

  return rename;
}

