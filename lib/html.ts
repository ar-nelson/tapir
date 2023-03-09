import { htm } from "$/deps.ts";
import defaultEnglishStrings from "$/resources/strings/en-US.json" assert {
  type: "json",
};

export interface I18nState {
  readonly date: Intl.DateTimeFormat;
  readonly dateTime: Intl.DateTimeFormat;
  readonly number: Intl.NumberFormat;
  readonly relativeTime: Intl.RelativeTimeFormat;
  readonly strings: typeof defaultEnglishStrings;
}

export class View {
  constructor(public readonly render: (i18n: I18nState) => string) {}
}

export function view<Props>(
  fn: (props: Props, i18n: I18nState) => View,
): (props: Props) => View {
  return (props) => new View((i18n) => fn(props, i18n).render(i18n));
}

const selfClosingTags: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "command",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const literalBooleanAttrs: ReadonlySet<string> = new Set([
  "aria-hidden",
]);

type Children<P> = P extends { children: unknown[] } ? P["children"]
  : (P extends { children: unknown } ? [P["children"]] : never[]);

export function h(
  name: string,
  attrs?: Record<string, unknown> | null,
  ...children: unknown[]
): View;
export function h<Props>(
  component: (props: Props) => View,
  props: Omit<Props, "children">,
  ...children: Children<Props>
): View;

export function h(
  elem: string | ((props: Record<string, unknown>) => View),
  attrs?: Record<string, unknown> | null,
  ...children: unknown[]
): View {
  return jsx(elem as string, { ...attrs, children });
}

export function jsx(name: string, attrs?: Record<string, unknown> | null): View;
export function jsx<Props>(
  component: (props: Props) => View,
  props: Props,
): View;

export function jsx(
  elem: string | ((props: Record<string, unknown>) => View),
  props?: Record<string, unknown> | null,
): View {
  if (!props) props = {};
  if (typeof elem === "function") {
    return elem(props);
  }

  const { children: childrenProp = [], ...attrs } = props,
    children = Array.isArray(childrenProp)
      ? childrenProp.flat()
      : [childrenProp];

  return new View((i18n) =>
    `<${elem}${
      Object.entries(attrs!).map(([k, v]) => renderAttribute(k, v)).join("")
    }>${renderHtml(children, i18n)}${
      children.length || !selfClosingTags.has(elem) ? `</${elem}>` : ""
    }`
  );
}

export { jsx as jsxDEV, jsx as jsxs };

export function Fragment({ children }: { children: unknown }): View {
  return new View((i18n) => renderHtml(children, i18n));
}

function renderAttribute(key: string, value: unknown): string {
  if (value == null) return "";
  switch (typeof value) {
    case "boolean":
      if (literalBooleanAttrs.has(key)) {
        return ` ${key}="${value}"`;
      } else {
        return value ? ` ${key}` : "";
      }
    case "number":
    case "bigint":
      return ` ${key}="${value}"`;
    default:
      return ` ${key}="${
        (typeof value === "string" ? value : JSON.stringify(value))
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
      }"`;
  }
}

function renderHtml(value: unknown, i18n: I18nState): string {
  if (value == null || value === false) {
    return "";
  } else if (Array.isArray(value)) {
    return value.map((v) => renderHtml(v, i18n)).join("");
  } else if (value instanceof View) {
    return value.render(i18n);
  } else {
    return (typeof value === "string" ? value : JSON.stringify(value))
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll(/\s+/mg, " ");
  }
}

const htmlOrArray = htm.bind(h);
export const html = (...params: Parameters<typeof htmlOrArray>): View => {
  const result = htmlOrArray(...params);
  if (Array.isArray(result)) {
    return new View((i18n) => renderHtml(result, i18n));
  }
  return result;
};
