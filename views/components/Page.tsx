import { View, view } from "$/lib/html.ts";

export const Page = view<{ title: string; head?: View; children?: unknown }>(
  ({ title, head, children }, i18n) => (
    <html lang={i18n.number.resolvedOptions().locale.split("-")[0]}>
      <head>
        <title>{title}</title>
        <link rel="stylesheet" href="/static/tapir.css" />
        {head}
      </head>
      <body>
        {children}
      </body>
    </html>
  ),
);
