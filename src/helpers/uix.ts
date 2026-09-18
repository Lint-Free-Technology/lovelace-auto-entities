import type { LovelaceRowConfig } from "../types";

type CssPropertyReader = Pick<CSSStyleDeclaration, "getPropertyValue">;

export function apply_uix_entity_icon_styling(
  entity: LovelaceRowConfig,
  styles?: CssPropertyReader
): LovelaceRowConfig {
  if (!styles || !entity?.entity) return entity;

  const slug = entity.entity.replace(/\./g, "_");
  const icon = styles.getPropertyValue(`--uix-icon-for-${slug}`).trim();
  const color = styles
    .getPropertyValue(`--uix-icon-color-for-${slug}`)
    .trim();

  if (!icon && !color) return entity;

  return {
    ...entity,
    ...(icon ? { icon } : {}),
    ...(color ? { color } : {}),
  };
}
