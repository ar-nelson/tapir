import { view } from "$/lib/html.ts";

export const Icon = view<{ icon: string; class?: string; title?: string }>((
  { icon, class: className, title },
) => (
  <svg role="img" class={`icon${className ? ` ${className}` : ""}`}>
    {title && <title>${title}</title>}
    <use href={`/static/feather-sprite.svg#${icon}`} />
  </svg>
));
