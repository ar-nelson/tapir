import {
  SettingsInput,
  SettingsPage,
  SettingsRow,
  UserDetail,
  view,
} from "$/views/components/mod.ts";
import { Persona } from "$/models/Persona.ts";

export const ComposePage = view<{ user: UserDetail; personas: Persona[] }>(
  ({ user, personas }, { strings }) => (
    <SettingsPage title={strings.nav.compose} user={user}>
      <form
        method="post"
        action="./compose/submit"
        enctype="multipart/form-data"
        class="settings-form"
      >
        <dl>
          <SettingsRow name="persona" label="Tooting as persona">
            <select name="persona" id="persona">
              {personas.map((p) => (
                <option value={p.name}>{p.displayName} (@{p.name})</option>
              ))}
            </select>
          </SettingsRow>
          <SettingsRow name="content" label="Your content">
            <textarea name="content" id="content"></textarea>
          </SettingsRow>
          <SettingsInput
            name="image"
            label="Image attachment"
            type="file"
            accept="image/*"
          />
          <SettingsRow name="alt" label="Image alt text">
            <textarea name="alt" id="alt"></textarea>
          </SettingsRow>
        </dl>
        <input type="submit" value="speak forth" />
      </form>
    </SettingsPage>
  ),
);
