import { getAreas, getConfigEntries, getDevices, getEntities, getFloors, getLabels } from "../helpers";

const ruleKeySelector = {
  type: "select",
  options: [
    ["area", "Area"],
    ["attributes", "Attribute"],
    ["device", "Device"],
    ["domain", "Domain"],
    ["entity_category", "Entity Category"],
    ["entity_id", "Entity ID"],
    ["floor", "Floor"],
    ["group", "Group"],
    ["hidden_by", "Hidden by"],
    ["integration", "Integration"],
    ["label", "Label"],
    ["last_changed", "Last Changed"],
    ["last_triggered", "Last Triggered"],
    ["last_updated", "Last Updated"],
    ["level", "Level"],
    ["device_manufacturer", "Manufacturer"],
    ["device_model", "Model"],
    ["name", "Name"],
    ["state", "State"],
    ["state_translated", "State Translated"],
  ],
};

const filterValueSelector = {
  attributes: { object: {} },
  area: { 
    choose: {
      choices: {
        area: { selector: { area: {} } },
        custom: { selector: { text: {} } }
      }
    } 
  },
  domain: { text: {} },
  device: { 
    choose: {
      choices: {
        device: { selector: { device: {} } },
        custom: { selector: { text: {} } }
      } 
    }
  },
  entity_id: { 
    choose: {
      choices: {
        entity: { selector: { entity: {} } },
        custom: { selector: { text: {} } }
      } 
    }
  },
  floor: { 
    choose: {
      choices: {
        floor: { selector: { floor: {} } },
        custom: { selector: { text: {} } }
      }
    }
  },
  group: { 
    choose: {
      choices: {
        group: { selector: { entity: {} } },
        custom: { selector: { text: {} } }
      } 
    }
  },
  integration: { 
    choose: {
      choices: {
        integration: { selector: { config_entry: {} } },
        custom: { selector: { text: {} } }
      }
    }
  },
  label: { 
    choose: {
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
  return ruleKeySelector.options.some(([k, v]) => k === key);
}

export const hasSelector = (filter) => {
  return Object.keys(filter).some((k) => k in filterValueSelector);
};

const ruleSchema = ([key, value], idx) => {
  if (["sort", "options"].includes(key)) {
    return undefined;
  }
  if (!ruleKeySelector.options.some(([k, v]) => k === key))
    return {
      type: "Constant",
      name: "Some rules are not shown",
      value: `The rule "${key}" is not supported by the GUI editor.
        Please switch to the CODE EDITOR to access all options.`,
    };

  return {
    type: "grid",
    name: "",
    schema: [
      {
        ...ruleKeySelector,
        name: `key_${idx}`,
        label: "Rule",
      },
      {
        name: `value_${idx}`,
        selector: filterValueSelector[key] ?? { text: {} },
        label: "",
      },
    ],
  };
};

export const filterSchema = (group) => {
  const filters = { ...group };
  delete filters.options;
  return [
    ...Object.entries(filters).map(ruleSchema).filter(Boolean),
    {
      ...ruleKeySelector,
      name: `key_new`,
      label: "New Rule ...",
    },
    {
      name: "options",
      label: "Options:",
      selector: { object: {} },
    },
  ];
};

export const migrate_custom_rule_values = async (hass, config, types, callback) => {
  const migrations = [];
  const promises = [];
  
  Object.values(Array.isArray(types) ? types : [types]).forEach((type) => {
    Object.values(config?.filter?.[type]).forEach((group, idx) => {
      const filters = { ...group as Object };
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

export const entitiesSchema = [
  {
    name: "entities",
    label: "Entities:",
    selector: { object: {} },
  },
];
export const templateSchema = [
  {
    name: "template",
    label: "Template:",
    selector: { template: {} },
  },
];

export const sortSchema = (method) => {
  const schema: any[] = [
    {
      name: "method",
      label: "Sort method",
      type: "select",
      options: [
        ["domain", "Entity Domain"],
        ["entity_id", "Entity ID"],
        ["friendly_name", "Friendly Name"],
        ["state", "Entity State"],
        ["last_changed", "Last Change"],
        ["last_updated", "Last Update"],
        ["last_triggered", "Last Trigger"],
        ["attribute", "Attribute"],
      ],
    },
    {
      type: "constant",
      name: "Sorting options:",
      value: "",
    },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "reverse", type: "boolean", label: "Reverse" },
        { name: "ignore_case", type: "boolean", label: "Ignore case" },
        { name: "numeric", type: "boolean", label: "Numeric sort" },
        { name: "ip", type: "boolean", label: "IP address sort" },
      ],
    },
  ];

  if (method !== undefined && !schema[0].options.some(([k, v]) => k === method))
    return [
      {
        type: "Constant",
        name: "GUI editor not available",
        value: `Sorting by ${method} is not supported by the GUI editor.
        Please switch to the CODE EDITOR to access all options.`,
      },
    ];

  if (method == "attribute") schema.push();
  schema.push({
    name: "attribute",
    label: "Attribute:",
    selector: { object: {} },
  });

  return schema;
};

export const cardOptionsSchema = [
  {
    type: "grid",
    name: "",
    schema: [
      {
        name: "show_empty",
        type: "boolean",
        label: "Show if empty",
      },
      {
        name: "card_as_row",
        type: "boolean",
        label: "Card as row",
      },
      {
        name: "card_param",
        type: "string",
        label: "Parameter to populate",
      },
    ],
  },
];
