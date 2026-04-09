# auto-entities

Forked from [thomasloven/lovelace-auto-entities](https://github.com/thomasloven/lovelace-auto-entities) to continue development of the stalled project.

Automatically populate lovelace cards with entities matching certain criteria.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Lint-Free-Technology&repository=lovelace-auto-entities&category=plugin)

To install via HACS, add this repo [https://github.com/Lint-Free-Technology/lovelace-auto-entities](https://github.com/Lint-Free-Technology/lovelace-auto-entities) as a [custom HACS repository](https://www.hacs.xyz/docs/faq/custom_repositories/) using type `Dashboard`. Use the button above to do this in one step. You are best to remove [thomasloven/lovelace-auto-entities](https://github.com/thomasloven/lovelace-auto-entities) in your HACS to avoid confusion as to what repo you are using.

## Usage

```yaml
type: custom:auto-entities
card: <card>
card_param: <card_param>
entities:
  - <entity>
  - <entity>
filter:
  template: <template>
  include:
    - <filter>
    - <filter>
  exclude:
    - <filter>
    - <filter>

show_empty: <show_empty>
card_as_row: <card_as_row>
else: <else>
unique: <unique>
rename: <rename_method>
sort: <sort_method>
```

| Option | Type | Description | Default |
| -------- | ------ | ------------- | --------- |
| `card` | Dashboard card\* | The card to display. Specify this as you would specify any normal dashboard card, but omit the `entities` parameter. | `entities`-card |
| `entities` | List of Entities\*\* | Any entities added here will be added to the card before any filters are applied | |
| `filter` | | | |
| &nbsp;&nbsp;`template` | string | A jinja template evaluating to a list of entities to include | |
| &nbsp;&nbsp;`include` | List of [Filters](#filters) | A list of filters specifying which entities to add to the card | |
| &nbsp;&nbsp;`exclude` | List of [Filters](#filters) | A list of filters specifying which entities to remove from the card | |
| `show_empty` | `true`/`false` | Whether to display the card if there are no entities | `true` |
| `else` | Dashboard card\* | Card to display if the main card has no entities. Overrides `show_empty` | |
| `rename` | [Rename config](#renaming-entities) | How to rename the entities of the card | `none` |
| `sort` | [Sort config](#sorting-entities) | How to sort the entities of the card | `none` |
| `card_param` | string | The parameter of the card to populate with entities | `entities` |
| `card_as_row` | `true`/`false` | Set to `true` if you use auto-entities card as a nested row in an entities card. | `false` |

\* [Dashboard card](https://www.home-assistant.io/dashboards/cards/) \
\*\* [Entities](https://www.home-assistant.io/dashboards/entities/#options-for-entities)

### Filters

The two main filter sections `include` and `exclude` each takes a list of filters.

Each filter has a set of rules and will match entities which match **ALL** rules:

| Rule | Matches | Example |
| --- | --- | --- |
| `domain` | Entity domain | `light`, `binary_sensor`, `media_player` |
| `state` | Current state of entity. | `"on"`, `home`, `"3.14"`, `"Triggered"` |
| `state_translated` | Current state of entity as translated using Frontend language user setting. For numeric states always use `state` as translated numeric values will include formatting that will give unexpected results e.g. '3.14 s' => 3 | `Éteint`, `Maison`, `Déclenché` |
| `entity_id` :ab: | Full entity id | `light.bed_light`, `input_binary.weekdays_only` |
| `name` | Friendly name attribute | `Kitchen lights`, `Front door` |
| `group` :ab: | Entities in the group | `group.living_room_lights` |
| `group_expanded` :ab: | Entities in the group, recursively expanding any nested groups | `group.all_lights` |
| `area` :ab: | Entities in a given area. Also matches all entities belonging to a Device in the area. | `Kitchen` |
| `floor` :ab: | Entities on a given floor. Also matches all entities belonging to a Device on that floor. | `Second`, `Basement` |
| `level` | Entities on a given level. | `2`, `>1` |
| `device` :ab: | Entities belonging to a Device | `Thomas iPhone` |
| `label` :ab: | Entities that are tagged with a certain label | `Show on dashboard`, `Holiday light` |
| `device_manufacturer` | Entities belonging to a device by a given manufacturer | `IKEA` |
| `device_model` | Entities belonging to a device of a given model | `Hue white ambiance E26/E27 (8718696548738)` |
| `integration` :ab: | Entities included by a given integration. This is not possible for _all_ integrations. | `plex`, `input_boolean`, `xiaomi_miio`, `mobile_app` |
| `hidden_by` | Who has hidden an entity | `user`, `integration` |
| `attributes` | Map of `attribute: value` pairs to match | |
| `last_changed` | Time since last state change (defaults to minutes) | `< 15`, `> 2 d ago` |
| `last_updated` | Time since last update (defaults to minutes) | `< 15`, `> 2 d ago` |
| `entity_category` | [Entity category](https://developers.home-assistant.io/docs/core/entity#generic-properties) | `config`, `diagnostic` |
| | | |
| `not` | Matches entities that do _not_ match a filter | |
| `or` | Matches any in a list of filters | |
| `and` | Matches all in a list of filters | |

Special options:

| Option | Description |
| --- | --- |
| `options` | Map of configuration options to apply to the entity when passed to the card |
| `type` | If a `type` is given, the filter is handled as a complete entity description and passed along directly to the card |
| `rename` | [Rename config](#renaming-entities) applied to entities in _this filter only_ |
| `sort` | [Sort config](#sorting-entities) applied to entities in _this filter only_ |

NOTE: Filters marked :ab: use the choose selector in the visual editor to allow for direct object selection or custom string. When you use the visual editor on an older config, the yaml for filters using the choose selector will be upgraded accordingly. After upgrade you will see yaml for filters using choose selectors similar to that shown below. Both legacy and choose selector config are supported.

Legacy filter config:

```yaml
type: custom:auto-entities
card:
  type: entities
  title: Test Areas
filter:
  include:
    - options: {}
      area: kitchen
  exclude: []
```

Choose selector filter config:

```yaml
type: custom:auto-entities
card:
  type: entities
  title: Test Areas
filter:
  include:
    - options: {}
      area:
        area: kitchen
        active_choice: area
  exclude: []
```

### Template filter

The filter section `template` takes a jinja template which evaluates to a list of entities or entity objects.

## How it works

`auto-entities` creates a list of entities by:

1. Including every entity given in `entities:` (this allow nesting of `auto-entities`if you'd want to do that for some reason...)
2. Include every entity listed in a `filter.template` evaluation
3. Include all entities that matches **ALL** options of **ANY** filter in the `filter.include` section. The same entity may be included several times by different filters.
4. Remove all entities that matches **ALL** options on **ANY** filter in the `filter.exclude` section.

It then creates a card based on the configuration given in `card:`, and fills in `entities:` of that card with the entities from above.

The list of entities added to the card will be on the form:

```yaml
- entity: <entity_id>
  <options>
```

## Matching rules

### Wildcards

Any filter option can use `*` as a wildcard for string comparison. Note that strings must be quoted when doing this:

```yaml
filter:
  include:
    - name: "Bedroom *"
    - entity_id: "sensor.temperature_*_max"
```

### Regular expressions

Any filter option can use [javascript Regular Expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) for string comparison. To do this, enclose the regex in `/`. Also make sure to quote the string:

<!--- cSpell:disable --->
```yaml
filter:
  include:
    - name: "/^.* [Ll]ight$/"
    - entity_id: "/sensor.temperature_4[abd]/"
```
<!--- cSpell:disable --->

### Numerical comparison

Any filter option dealing with numerical quantities can use comparison operators if specified as a string (must be quoted):

```yaml
filter:
  include:
    - attributes:
        battery_level: "<= 50" # Attribute battery_level is 50 or less
    - state: "> 25" # State is greater than 25
    - attributes:
        count: "! 2" # Attribute count is not equal to 2
    - state: "= 12" # State is exactly 12 (also matches "12", "12.0" etc.)
    - state: "12" # State is exactly "12" but not e.g. "12.0"
```

> **Note**: Since `>` has a special function in yaml, the quotation marks are mandatory. `"> 25"`

### Time since an event

Any filter option dealing with an event time can filter entities by time elapsed since that event:

```yaml
filter:
  include:
    - attributes:
        last_seen: "> 1h ago" # Entity was seen more than 1 hour ago
    - last_updated: "< 20m ago" # Entity was updated less than 20 minutes ago
    - last_triggered: "> 1d ago" # Entity was triggered more than 1 day ago
```

All the numeric comparison operators are available.

### Repeating options

Any option can be used more than once by appending a number or string to the option name:

```yaml
filter:
  include:
    - state 1: "> 100"
      state 2: "< 200"
```

The filter above matches entities where the state is above 100 **AND** below 200. Compare to the following:

```yaml
filter:
  include:
    - state: "< 100"
    - state: "> 200"
```

The two filters above together match entities where the state is below 100 **OR** above 200.

### Object attributes

Some entity attributes actually contain several values. One example is `hs_color` for a light, which has one value for Hue and one for Saturation. Such values can be stepped into using keys or indexes separated by a colon (`:`):

```yaml
filter:
  include:
    - attributes:
        hs_color:1: ">30"
```

The example above matches lights with a `hs_color` saturation value greater than 30.

### Stringification

Some entity attributes are not text strings, but can be advanced structures. By starting the pattern to match with `$$` auto-entities will convert the attribute to JSON before comparing:

```yaml
filter:
  include:
    - attributes:
        entity_id: "$$*"
```

The example above matches any entity that has a `entity_id` attribute - i.e. all kinds of group entities.

## Renaming entities

Entities can be renamed either on a filter-by-filter basis by adding a `rename:` option to the filter, or all at once after all filters have been applied using the `rename:` option of `auto-entities` itself.

The initial name comes from one of two sources — `type` (Home Assistant-style name composition) or `method` (single-value extraction). When both are specified, **`type` takes precedence and `method` is ignored**. The `find`/`replace`/`prepend`/`append`/`eval_js` string operations are then applied to the result. If neither `type` nor `method` is set, string operations are applied to the entity's friendly name directly.

> [!TIP]
> If the card you are using supports Home Assistant `name:` config option you can use that in `options:` on your filter as an altrnative to `rename:` - `type` can be `entity`, `device`, `area`, `floor`.
>
> ```yaml
>   filter:
>     include:
>       - options:
>           name:
>             - type: area
>             - type: entity
> ````

```yaml
rename:
  # Option A — Home Assistant name parts
  # When set, this takes precedence over method.
  type: <type>           # string or list — see below
  separator: <separator>

  # Option B — single-value method (used only when type is not set)
  method: <method>
  attribute: <attribute>

  # Applied after whichever option is used
  # (if neither type nor method is set, these apply to the friendly name)
  find: <find>           # string or list — see below
  replace: <replace>     # string or list — see below
  prepend: <prepend>
  append: <append>
  eval_js: <eval_js>
```

### Option A — `type` (Home Assistant style)

Composes the entity name from one or more named parts, exactly as the Home Assistant frontend does. This gives a name that always matches what Home Assistant itself would display with the same name config.

- `type:` A single part name or a list of part names. Each part can be one of:
  - `entity` — the entity's own name from the registry (without device prefix). Entities that have no separate name fall back to the device name, mirroring Home Assistant's behaviour.
  - `device` — the device name
  - `area` — the area name
  - `floor` — the floor name
  - `{type: text, text: "..."}` — a literal string (YAML only)
- `separator:` String used to join multiple parts. Defaults to `" "` (space).

> **Note:** The visual editor lets you pick name parts from a multi-select list, but it does not support drag-to-reorder. To control the order of parts precisely, use YAML directly.

```yaml
# Just the entity part (no device prefix) — equivalent to HA's "entity" name
rename:
  type: entity

# Device + entity, comma-separated
rename:
  type:
    - device
    - entity
  separator: ", "

# Area prefix followed by the entity name
rename:
  type:
    - area
    - entity
```

### Option B — `method` (other single-value extraction)

> **Note:** When `type` is also set, `method` is ignored — `type` always takes precedence.

- `method:` One of `friendly_name`, `name`, `entity_id`, `domain`, `state`, `state_translated`, `attribute`, `device`, `area`, `remove_device`, or `remove_area`.
- `attribute:` Attribute to use as the name if `method: attribute`. Can be an _object attribute_ (e.g. `attribute: rgb_color:2`).

| Method | Description |
| --- | --- |
| `friendly_name` | Use the entity's friendly name (default HA name) |
| `name` | Same as `friendly_name` |
| `entity_id` | Use the full entity ID |
| `domain` | Use the entity domain only |
| `state` | Use the current state value |
| `state_translated` | Use the formatted/translated state value |
| `attribute` | Use a specific attribute (requires `attribute:`) |
| `device` | Use the device name |
| `area` | Use the area name |
| `remove_device` | Strip the device name prefix from the friendly name automatically |
| `remove_area` | Strip the area name prefix from the friendly name automatically |

### Automatic device/area name removal (`method`)

The `remove_device` and `remove_area` methods let you strip the device or area name prefix from the friendly name **without needing to know the name in advance**.

```yaml
rename:
  method: remove_device
```

e.g. device "Smart Plug", entity "Smart Plug energy" → "energy"

```yaml
rename:
  method: remove_area
```

e.g. area "Living Room", entity "Living Room temperature" → "temperature"

Both methods fall back gracefully to the original friendly name when no device or area is associated with the entity.

> **Note:** Using `type: entity` is the preferred modern approach and delegates to Home Assistant's own logic. Use `remove_device`/`remove_area` for older Home Assistant versions or when you need exact prefix-stripping behaviour.

### String operations (common options)

These apply after the name has been extracted by either `method` or `type`:

- `find:` A JavaScript regular expression string, **or a list of regex strings** for multiple sequential replacements. Matches in the extracted name are replaced with the corresponding `replace` entry.
- `replace:` Replacement string for `find`, **or a list of replacement strings** matching the `find` list. Defaults to `""` (empty string, i.e. the match is removed). When `find` is a list and `replace` is shorter, missing entries default to `""`. Operations are applied in order.
- `prepend:` A string to prepend to the name.
- `append:` A string to append to the name.
- `trim:` Set to `true` to trim leading and trailing whitespace from the name after all other operations.
- `eval_js:` Set to `true` to evaluate `${...}` template expressions in `replace`, `prepend`, and `append`. Available variables: `entity_id`, `entity` (entity name), `device` (device name), `area` (area name), `state` (state value string), `state_translated` (formatted/translated state value), `name` (extracted name before find/replace).

### Rename examples

Get just the entity part using `hass.formatEntityName` (recommended):

```yaml
rename:
  type: entity
```

Device and entity joined with " — ":

```yaml
rename:
  type:
    - device
    - entity
  separator: " — "
```

Remove a known prefix from all sensors:

```yaml
rename:
  method: friendly_name
  find: "^Living Room "
  replace: ""
```

Strip multiple patterns in sequence (list find/replace):

```yaml
rename:
  method: friendly_name
  find:
    - " energy daily"
    - "- plug"
  trim: true
```

> **Note:** `find` and `replace` lists are applied sequentially — each pair is processed in order. When `replace` has fewer entries than `find`, missing entries default to `""`. List find/replace can only be configured in YAML; the GUI editor will display a notice when lists are in use.

Strip the device name prefix automatically:

```yaml
rename:
  method: remove_device
```

Append the current state value using a JS template:

```yaml
rename:
  method: friendly_name
  append: " (${state})"
  eval_js: true
```

Prepend the area name if one is set (per-filter rename):

```yaml
filter:
  include:
    - domain: sensor
      rename:
        method: friendly_name
        prepend: "${area ? area + ': ' : ''}"
        eval_js: true
```

## Sorting entities

Entities can be sorted, either on a filter-by-filter basis by adding a `sort:` option to the filter, or all at once after all filters have been applied using the `sort:` option of `auto-entities` itself.

Sorting methods are specified as:

```yaml
sort:
  method: <method>
  reverse: <reverse>
  ignore_case: <ignore_case>
  attribute: <attribute>
  first: <first>
  count: <count>
  numeric: <numeric>
  ip: <ip>
```

- `method:` **Required** One of `domain`, `entity_id`, `name`, `friendly_name`, `device`, `area`, `state`, `attribute`, `last_changed`, `last_updated` or `last_triggered`.
  - `name` — sorts by the entity's display name **after** any `rename:` transformation. Falls back to the Home Assistant friendly name when no rename is configured.
  - `friendly_name` — sorts by the entity's original Home Assistant friendly name, **unaffected** by any `rename:` configuration.
- `reverse:` Set to `true` to reverse the order. Default: `false`.
- `ignore_case:` Set to `true` to make the sort case-insensitive. Default: `false`.
- `numeric:` Set to `true` to sort by numeric value. Default: `false` except for `last_changed`, `last_updated` and `last_triggered` sorting methods.
- `ip:` Set to `true` to sort IP addresses group by group (e.g. 192.168.1.2 will be before 192.168.1.100).
- `attribute:` Attribute to sort by if `method: attribute`. Can be an _object attribute_ as above (e.g. `attribute: rgb_color:2`)
- `first` and `count` can be used to only display `<count>` entities, starting with the `<first>` (starts with 0).

### Multiple sort levels

To sort by multiple criteria (e.g. primary sort by domain, secondary sort by name as a tiebreaker), supply an **array** of sort configs. The entities are first ordered by the first sort config; when two entities compare equal on that level, the next sort config is used, and so on.

> [!NOTE]
> Multiple sort levels must be configured in the **CODE EDITOR**. The GUI editor will show an info message when an array is detected.

```yaml
sort:
  - method: domain
  - method: friendly_name
    ignore_case: true
```

`first` and `count` pagination, when used with a multi-level sort array, are taken from the **first** element in the array:

```yaml
sort:
  - method: last_changed
    reverse: true
    count: 10        # show only the 10 most recently changed
  - method: friendly_name
    ignore_case: true
```

## Entity options

In the `options:` option of the filters, the string `this.entity_id` will be replaced with the matched entity_id. Useful for service calls - see below.

## Examples

Show all entities, except yahoo weather, groups and zones in a glance card:

```yaml
type: custom:auto-entities
card:
  type: glance
filter:
  include: [{}]
  exclude:
    - entity_id: "*yweather*"
    - domain: group
    - domain: zone
```

Show all gps `device_tracker`s with battery level less than 50:

```yaml
type: custom:auto-entities
card:
  type: entities
  title: Battery warning
filter:
  include:
    - domain: device_tracker
      options:
        secondary_info: last-changed
      attributes:
        battery: "< 50"
        source_type: gps
```

Show all lights that are on:

```yaml
type: custom:auto-entities
show_empty: false
card:
  type: glance
  title: Lights on
filter:
  include:
    - domain: light
      state: "on" # Remember that "on" and "off" are magic in yaml, and must always be quoted
      options:
        tap_action:
          action: toggle
```

Also show all lights that are on, except the hidden ones:

```yaml
type: custom:auto-entities
show_empty: false
card:
  type: entities
  title: Lights on
  show_header_toggle: false
filter:
  include:
    - domain: light
  exclude:
    - state: "off"
    - state: "unavailable"
    - hidden_by: "user"
```

Show everything that has "light" in its name, but isn't a light, and all switches in the living room:

```yaml
type: custom:auto-entities
card:
  type: entities
  title: Lights on
  show_header_toggle: false
filter:
  include:
    - name: /[Ll]ight/
      not:
        domain: light
    - type: section
    - domain: switch
      area: Living Room
```

List every sensor belonging to any iPhone:

```yaml
type: custom:auto-entities
card:
  type: entities
  title: Phones
  show_header_toggle: false
filter:
  include:
    - device: /iPhone/
```

List the five last triggered motion sensors:

```yaml
type: custom:auto-entities
card:
  type: entities
filter:
  include:
    - domain: binary_sensor
      attributes:
        device_class: motion
sort:
  method: last_changed
  reverse: true
  count: 5
```

Put all sensors in individual entity cards in a grid card:

```yaml
type: custom:auto-entities
card:
  type: grid
card_param: cards
filter:
  include:
    - domain: sensor
      options:
        type: entity
```

Turn on scenes by clicking them:

```yaml
type: custom:auto-entities
card:
  type: glance
filter:
  include:
    - domain: scene
      options:
        tap_action:
          action: call-service
          service: scene.turn_on
          service_data:
            # Note the magic value this.entity_id here
            entity_id: this.entity_id
```

Example using templates:

```yaml
type: custom:auto-entities
card:
  type: entities
filter:
  template: |
    {% for light in states.light %}
      {% if light.state == "on" %}
        {{ light.entity_id}},
      {% endif %}
    {% endfor %}
```

Or:

```yaml
template: "{{states.light | selectattr('state', '==', 'on') | map(attribute='entity_id') | list}}"
```

Templates also give great opportunity for customization:

```yaml
type: custom:auto-entities
card:
  type: entities
filter:
  template: |
    [{% for e in area_entities("bedroom") %}
      {'entity': '{{e}}',
       'name': 'Lamp at {{device_attr(e, "name").removesuffix("Light").removesuffix("Lights")}}',
      },
    {% endfor %}]
```
