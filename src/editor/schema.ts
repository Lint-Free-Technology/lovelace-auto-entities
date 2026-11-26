import { getAreas, getConfigEntries, getDevices, getEntities, getFloors, getLabels } from "../helpers";
import { SPECIAL_TYPES, SortConfig } from "../types";
import { localize, TranslationKey } from "../localize";

const ruleKeys = [
  "area",
  "attributes",
  "device",
  "domain",
  "entity_category",
  "entity_id",
  "floor",
  "group",
  "group_expanded",
  "hidden_by",
  "integration",
  "label",
  "last_changed",
  "last_triggered",
  "last_updated",
  "level",
  "device_manufacturer",
  "device_model",
  "name",
  "state",
  "state_translated",
];

const ruleKeySelector = (hass) => ({
  type: "select",
  options: ruleKeys
    .map((key): [string, string] => [
      key,
      localize(`rule.${key}` as TranslationKey, hass),
    ])
    .sort(([, a], [, b]) => a.localeCompare(b)),
});

const filterValueSelector = {
  attributes: { object: {} },
  area: { 
    choose: {
      translation_key: "choose",
      choices: {
        area: { selector: { area: {} } },
        custom: { selector: { text: {} } }
      }
    } 
  },
  domain: { text: {} },
  device: { 
    choose: {
      translation_key: "choose",
      choices: {
        device: { selector: { device: {} } },
        custom: { selector: { text: {} } }
      } 
    }
  },
  entity_id: { 
    choose: {
      translation_key: "choose",
      choices: {
        entity: { selector: { entity: {} } },
        custom: { selector: { text: {} } }
      } 
    }
  },
  floor: { 
    choose: {
      translation_key: "choose",
      choices: {
        floor: { selector: { floor: {} } },
        custom: { selector: { text: {} } }
      }
    }
  },
  group: { 
    choose: {
      translation_key: "choose",
      choices: {
        group: { selector: { entity: {} } },
        custom: { selector: { text: {} } }
      } 
    }
  },
  group_expanded: { 
    choose: {
      translation_key: "choose",
      choices: {
        group: { selector: { entity: {} } },
        custom: { selector: { text: {} } }
      } 
    }
  },
  integration: { 
    choose: {
      translation_key: "choose",
      choices: {
        integration: { selector: { config_entry: {} } },
        custom: { selector: { text: {} } }
      }
    }
  },
  label: { 
    choose: {
      translation_key: "choose",
      choices: {
        label: { selector: { label: {} } },
        custom: { selector: { text: {} } }
      }
    }
  },
};

const filterChooseValidators = {
  entity_id: {
    validator: async (hass, value) => { return getEntities(hass).then((entities) => { return value in entities; }).catch(() => { return false; }); },
    choose_valid: (value) => { return { entity: value, active_choice: "entity" }; },
    choose_custom: (value) => { return { custom: value, active_choice: "custom" }; },
  },
  device: {
    validator: async (hass, value) => { return getDevices(hass).then((devices) => { return value in devices; }).catch(() => { return false; }); },
    choose_valid: (value) => { return { device: value, active_choice: "device" }; },
    choose_custom: (value) => { return { custom: value, active_choice: "custom" }; },
  },
  area: {
    validator: async (hass, value) => { return getAreas(hass).then((areas) => { return value in areas; }).catch(() => { return false; }); },
    choose_valid: (value) => { return { area: value, active_choice: "area" }; },
    choose_custom: (value) => { return { custom: value, active_choice: "custom" }; },
  },
  floor: {
    validator: async (hass, value) => { return getFloors(hass).then((floors) => { return value in floors; }).catch(() => { return false; }); },
    choose_valid: (value) => { return { floor: value, active_choice: "floor" }; },
    choose_custom: (value) => { return { custom: value, active_choice: "custom" }; },
  },
  group: {
    validator: async (hass, value) => { return getEntities(hass).then((entities) => { return value in entities; }).catch(() => { return false; }); },
    choose_valid: (value) => { return { group: value, active_choice: "group" }; },
    choose_custom: (value) => { return { custom: value, active_choice: "custom" }; },
  },
  group_expanded: {
    validator: async (hass, value) => { return getEntities(hass).then((entities) => { return value in entities; }).catch(() => { return false; }); },
    choose_valid: (value) => { return { group: value, active_choice: "group" }; },
    choose_custom: (value) => { return { custom: value, active_choice: "custom" }; },
  },
  integration: {  
    validator: async (hass, value) => { return getConfigEntries(hass, "type_filter", ["device", "hub", "service" ]).then((entries) => { return value in entries; }).catch(() => { return false; }); },
    choose_valid: (value) => { return { integration: value, active_choice: "integration" }; },
    choose_custom: (value) => { return { custom: value, active_choice: "custom" }; },
  },
  label: {
    validator: async (hass, value) => { return getLabels(hass).then((labels) => { return value in labels; }).catch(() => { return false; }); },
    choose_valid: (value) => { return { label: value, active_choice: "label" }; },
    choose_custom: (value) => { return { custom: value, active_choice: "custom" }; },
  }
}

export const isRuleKeySelector = (key) => {
  return ruleKeys.includes(key);
}

export const hasSelector = (filter) => {
  return Object.keys(filter).some((k) => k in filterValueSelector);
};

const ruleSchema = (hass, [key, value], idx) => {
  if (["sort", "options"].includes(key)) {
    return undefined;
  }
  if (!ruleKeys.includes(key))
    return {
      type: "Constant",
      name: "Some rules are not shown",
      label: localize("filter.unsupported_title", hass),
      value: localize("filter.unsupported_rule", hass, { rule: key }),
    };

  return {
    type: "grid",
    name: "",
    column_min_width: filterValueSelector[key] !== undefined ? "100%" : undefined,
    schema: [
      {
        ...ruleKeySelector(hass),
        name: `key_${idx}`,
        label: localize("filter.rule", hass),
      },
      {
        name: `value_${idx}`,
        selector: filterValueSelector[key] ?? { text: {} },
        label: "",
      },
    ],
  };
};

export const filterSchema = (hass, group) => {
  const filters = { ...group };
  delete filters.options;
  delete filters.uix_entity_icon_styling;
  return [
    ...Object.entries(filters)
      .map((rule, idx) => ruleSchema(hass, rule, idx))
      .filter(Boolean),
    {
      ...ruleKeySelector(hass),
      name: `key_new`,
      label: localize("filter.new_rule", hass),
    },
    {
      name: "options",
      label: localize("filter.options", hass),
      selector: { object: {} },
    },
  ];
};

export const stylingSchema = (hass) => [
  {
    name: "uix_entity_icon_styling",
    type: "boolean",
    label: localize("filter.uix_styling", hass),
  },
];

export const migrate_custom_rule_values = async (hass, config, types, callback) => {
  const migrations = [];
  const promises = [];
  
  Object.values(Array.isArray(types) ? types : [types]).forEach((type) => {
    if (!config?.filter?.[type]) return;
    Object.values(config?.filter?.[type]).forEach((group, idx) => {
      const filters: any = { ...group as Object };
      if (SPECIAL_TYPES.includes(filters.type)) return;
      Object.entries(filters).forEach(([key, value]) => {
        if (key in filterChooseValidators && typeof value === "string") {
          const promise = filterChooseValidators[key].validator(hass, value).then((is_valid) => {
            if (is_valid) {
              const new_value = filterChooseValidators[key].choose_valid(value);
              migrations.push({new_value, idx, type, key});
            } else {
              const new_value = filterChooseValidators[key].choose_custom(value);
              migrations.push({new_value, idx, type, key});
            }
          });
          promises.push(promise);
        }
      });
    });
  });
  
  await Promise.all(promises);
  callback(migrations);
};

export const rule_to_form = (group) => {
  const filters = { ...group };
  const options = { ...group.options };
  delete filters.options;
  delete filters.uix_entity_icon_styling;
  return Object.assign(
    {},
    ...Object.entries(filters).map(([key, value], idx) => ({
      [`key_${idx}`]: key,
      [`value_${idx}`]: value,
    })),
    { options }
  );
};

export const form_to_rule = (config, filter): Object => {
  const data = {};
  data["options"] = filter.options;
  Object.keys(filter)
    .filter((k) => /^key_\d+$/.test(k))
    .forEach((k) => {
      const idx = k.split("_")[1];
      const ruleKey = filter[k];
      if (ruleKey !== undefined) {
        data[ruleKey] = filter[`value_${idx}`] ?? "";
      }
    });
  if (filter.key_new !== undefined) {
    data[filter.key_new] = "";
  }
  return data;
};

export const nonFilterSchema = [
  {
    name: "data",
    label: " ",
    selector: { object: {} },
  },
];

export const entitiesSchema = (hass) => [
  {
    name: "entities",
    label: localize("filter.entities", hass),
    selector: { object: {} },
  },
];
export const templateSchema = (hass) => [
  {
    name: "template",
    label: localize("filter.template", hass),
    selector: { template: {} },
  },
];

type FormNumericSortConfig = SortConfig["numeric"] | "default";
type FormSortConfig = Omit<SortConfig, "numeric"> & {
  numeric?: FormNumericSortConfig;
};

/**
 * The card configuration distinguishes an omitted numeric setting from an
 * explicit `false`: timestamp sorts default to numeric only when it is
 * omitted. Keep that distinction while the GUI form is being edited.
 */
export function sortDataForForm(sort?: SortConfig): FormSortConfig {
  if (!sort) return {};
  const numeric =
    sort.numeric === undefined
      ? "default"
      : sort.numeric === "off"
        ? false
        : sort.numeric === "true"
          ? true
          : sort.numeric;
  return { ...sort, numeric };
}

export function sortDataFromForm(sort?: FormSortConfig): SortConfig {
  if (!sort) return undefined;
  if (sort.numeric === "default") {
    const { numeric, ...rest } = sort;
    return rest as SortConfig;
  }
  // Older saved configurations may still use the string form.
  if (sort.numeric === "off") return { ...sort, numeric: false };
  if ((sort.numeric as unknown) === "true") {
    return { ...sort, numeric: true };
  }
  return sort as SortConfig;
}

export const sortSchema = (hass, method) => {
  const schema: any[] = [
    {
      name: "method",
      label: localize("sort.method", hass),
      type: "select",
      options: [
        ["domain", localize("sort.domain", hass)],
        ["entity_id", localize("sort.entity_id", hass)],
        ["name", localize("sort.name", hass)],
        ["friendly_name", localize("sort.friendly_name", hass)],
        ["device", localize("sort.device", hass)],
        ["area", localize("sort.area", hass)],
        ["state", localize("sort.state", hass)],
        ["last_changed", localize("sort.last_changed", hass)],
        ["last_updated", localize("sort.last_updated", hass)],
        ["last_triggered", localize("sort.last_triggered", hass)],
        ["attribute", localize("sort.attribute", hass)],
      ],
    },
    {
      type: "constant",
      name: "Sorting options:",
      label: localize("sort.options", hass),
      value: "",
    },
    {
      type: "grid",
      name: "",
      schema: [
        {
          name: "reverse",
          type: "boolean",
          label: localize("sort.reverse", hass),
        },
        {
          name: "ignore_case",
          type: "boolean",
          label: localize("sort.ignore_case", hass),
        },
        {
          name: "numeric",
          type: "select",
          label: localize("sort.numeric", hass),
          options: [
            ["default", localize("sort.numeric_default", hass)],
            [false, localize("sort.numeric_off", hass)],
            [true, localize("sort.numeric_on", hass)],
            ["nan_last", localize("sort.numeric_nan_last", hass)],
            ["nan_first", localize("sort.numeric_nan_first", hass)],
          ],
        },
        { name: "ip", type: "boolean", label: localize("sort.ip", hass) },
        {
          name: "divider",
          type: "boolean",
          label: localize("sort.divider", hass),
        },
        {
          name: "section",
          type: "boolean",
          label: localize("sort.section", hass),
        },
        {
          name: "label",
          selector: { object: {} },
          label: localize("sort.section_label", hass),
        },
      ],
    },
  ];

  if (method !== undefined && !schema[0].options.some(([k, v]) => k === method))
    return [
      {
        type: "Constant",
        name: "GUI editor not available",
        label: localize("common.gui_unavailable", hass),
        value: localize("sort.unsupported_method", hass, { method }),
      },
    ];

  if (method == "attribute") schema.push();
  schema.push({
    name: "attribute",
    label: localize("sort.attribute_field", hass),
    selector: { object: {} },
  });

  return schema;
};

export const renameSchema = (hass, method, type?, find?, replace?) => {
  const knownMethods = [
    "friendly_name", "entity_id", "domain", "state", "state_translated", "attribute",
    "device", "area", "remove_device", "remove_area",
  ];

  if (method && !knownMethods.includes(method))
    return [
      {
        type: "Constant",
        name: "GUI editor not available",
        label: localize("common.gui_unavailable", hass),
        value: localize("rename.unsupported_method", hass, { method }),
      },
    ];

  return [
    // ── Home Assistant name parts (hass.formatEntityName) ────────────────
    {
      type: "constant",
      name: "Home Assistant name parts:",
      label: localize("rename.name_parts_title", hass),
      value: "",
    },
    {
      type: "grid",
      name: "",
      schema: [
        {
          name: "type",
          label: localize("rename.name_parts", hass),
          selector: {
            select: {
              multiple: true,
              custom_value: false,
              options: [
                { value: "entity", label: localize("rename.part_entity", hass) },
                { value: "device", label: localize("rename.part_device", hass) },
                { value: "area", label: localize("rename.part_area", hass) },
                { value: "floor", label: localize("rename.part_floor", hass) },
              ],
            },
          },
        },
        {
          name: "separator",
          label: localize("rename.separator", hass),
          selector: { text: {} },
        },
      ],
    },
    // ── Other (single-value extraction) ──────────────────────────────────
    {
      type: "constant",
      name: "Other (single-value extraction):",
      label: localize("rename.other_title", hass),
      value: "",
    },
    {
      name: "method",
      label: localize("rename.method", hass),
      type: "select",
      options: [
        ["", localize("rename.method_none", hass)],
        ["friendly_name", localize("rename.method_friendly_name", hass)],
        ["entity_id", localize("rename.method_entity_id", hass)],
        ["domain", localize("rename.method_domain", hass)],
        ["state", localize("rename.method_state", hass)],
        ["state_translated", localize("rename.method_state_translated", hass)],
        ["attribute", localize("rename.method_attribute", hass)],
        ["device", localize("rename.method_device", hass)],
        ["area", localize("rename.method_area", hass)],
        ["remove_device", localize("rename.method_remove_device", hass)],
        ["remove_area", localize("rename.method_remove_area", hass)],
      ],
    },
    {
      name: "attribute",
      label: localize("rename.attribute", hass),
      selector: { text: {} },
    },
    // ── String operations ─────────────────────────────────────────────────
    {
      type: "constant",
      name: "String operations (applied in order: find/replace → prepend → append → trim → capitalize). Find/replace can be a single value or a list of values in YAML.",
      label: localize("rename.string_operations", hass),
      value: "",
    },
    ...(Array.isArray(find) || Array.isArray(replace)
      ? [
          {
            type: "constant",
            name: "Find/Replace as list",
            label: localize("rename.list_title", hass),
            value: localize("rename.list_info", hass),
          },
        ]
      : [
          {
            type: "grid",
            name: "",
            schema: [
              {
                name: "find",
                label: localize("rename.find", hass),
                selector: { text: {} },
              },
              {
                name: "replace",
                label: localize("rename.replace", hass),
                selector: { text: {} },
              },
              {
                name: "prepend",
                label: localize("rename.prepend", hass),
                selector: { text: {} },
              },
              {
                name: "append",
                label: localize("rename.append", hass),
                selector: { text: {} },
              },
            ],
          },
        ]),
    {
      name: "trim",
      type: "boolean",
      label: localize("rename.trim", hass),
    },
    {
      name: "capitalize",
      type: "boolean",
      label: localize("rename.capitalize", hass),
    },
    {
      name: "eval_js",
      type: "boolean",
      label: localize("rename.eval_js", hass),
    },
    {
      name: "ignore_case",
      type: "boolean",
      label: localize("rename.ignore_case", hass),
    },
  ];
};

export const cardOptionsSchema = (hass) => [
  {
    type: "grid",
    name: "",
    schema: [
      {
        name: "show_empty",
        type: "boolean",
        label: localize("card.show_empty", hass),
      },
      {
        name: "card_as_row",
        type: "boolean",
        label: localize("card.card_as_row", hass),
      },
      {
        name: "uix_entity_icon_styling",
        type: "boolean",
        label: localize("filter.uix_styling", hass),
      },
      {
        name: "card_param",
        type: "string",
        label: localize("card.card_param", hass),
      },
    ],
  },
];
