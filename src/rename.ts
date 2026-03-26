import { getAreas, getDevices, getEntities } from "./helpers";
import { HassObject, HAState, LovelaceRowConfig, RenameConfig, EntityList } from "./types";

function strip_prefix(name: string, prefix: string | undefined): string {
  if (!prefix) return name;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return name.replace(new RegExp(`^${escaped}\\s*`, "i"), "").trim() || name;
}

function get_friendly(x: HAState): string {
  return x?.attributes?.friendly_name || x?.entity_id?.split(".")[1];
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

export async function get_renamer(hass: HassObject, method: RenameConfig) {
  const extract = NAME_EXTRACTORS[method.method];
  if (!extract) return (x: EntityList) => x;

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

        let name: string | undefined = await extract(state, method, hass);
        if (name === undefined) return entity;
        name = String(name);

        const original_name = name;

        const eval_str = (str: string): string => {
          if (!method.eval_js) return str;
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

        if (method.find !== undefined) {
          name = name.replace(
            new RegExp(method.find, "g"),
            eval_str(method.replace ?? "")
          );
        }
        if (method.prepend !== undefined) {
          name = eval_str(method.prepend) + name;
        }
        if (method.append !== undefined) {
          name = name + eval_str(method.append);
        }

        return { ...entity, name };
      })
    );
  };

  return rename;
}
