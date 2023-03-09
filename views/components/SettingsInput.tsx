import { SettingsRow, view } from "$/views/components/mod.ts";

export const SettingsInput = view<
  {
    label: string;
    name?: string;
    sublabel?: string;
    type: string;
    [rest: string]: unknown;
  }
>(({ label, name, sublabel, ...rest }) => (
  <SettingsRow label={label} name={name} sublabel={sublabel}>
    <input name={name} id={name} {...rest} />
  </SettingsRow>
));
