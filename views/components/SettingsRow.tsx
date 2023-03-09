import { view } from "$/lib/html.ts";

export const SettingsRow = view<
  { label: string; name?: string; sublabel?: string; children?: unknown }
>(({ label, name, sublabel, children }) => (
  <div>
    <dt>
      {name ? <label for={name}>{label}</label> : <p>{label}</p>}
      {sublabel && (
        <p>
          <small>{sublabel}</small>
        </p>
      )}
    </dt>
    <dd>{children}</dd>
  </div>
));
