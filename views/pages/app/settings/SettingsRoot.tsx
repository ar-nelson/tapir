import { SettingsPage, UserDetail, view } from "$/views/components/mod.ts";

export const SettingsRootPage = view<{ user: UserDetail }>(
  ({ user }, { strings }) => (
    <SettingsPage title={strings.settings.settings} user={user}>
      <p>settings root page</p>
    </SettingsPage>
  ),
);
