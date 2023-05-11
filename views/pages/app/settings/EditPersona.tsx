import {
  SettingsInput,
  SettingsPage,
  SettingsRow,
  UserDetail,
  view,
} from "$/views/components/mod.ts";
import { Persona } from "$/models/types.ts";

export const SettingsEditPersonaPage = view<
  { user: UserDetail; persona: Persona }
>(
  ({ user, persona }, { strings }) => (
    <SettingsPage title={strings.settings.editPersona} user={user}>
      <form
        action={`./${encodeURIComponent(persona.name)}/submit`}
        method="post"
        enctype="multipart/form-data"
        class="settings-form"
      >
        <dl>
          <SettingsInput
            name="displayName"
            label="Display name"
            type="text"
            value={persona.displayName}
          />
          <SettingsInput
            name="linkTitle"
            label="Link title"
            type="text"
            value={persona.linkTitle ?? ""}
          />
          <SettingsRow name="summary" label="Summary blurb">
            <textarea name="summary" id="summary">{persona.summary}</textarea>
          </SettingsRow>
        </dl>
        <input type="submit" value="refine your identity" />
      </form>
    </SettingsPage>
  ),
);
