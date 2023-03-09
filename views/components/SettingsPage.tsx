import {
  Page,
  PrivateGlobalNav,
  UserDetail,
  view,
} from "$/views/components/mod.ts";

export const SettingsPage = view<
  { title: string; user: UserDetail; children?: unknown }
>(({ title, user, children }, { strings }) => (
  <Page title={`${user.serverName} - ${strings.settings.settings} - ${title}`}>
    <div class="page private-page settings-page">
      <PrivateGlobalNav user={user} />
      <div class="settings">
        <nav>
          <h2>{strings.settings.settings}</h2>
          <ul>
            <li>
              <a href="/app/settings/compose">{strings.nav.compose}</a>
            </li>
            <li>
              <a href="/app/settings/personas">{strings.settings.personas}</a>
              <ul>
                {
                  /*<li>
                  <a href="/app/settings/personas/new">
                    {strings.settings.newPersona}
                  </a>
                </li>*/
                }
                <li>
                  <a href="/app/settings/personas/followers">
                    {strings.settings.followers}
                  </a>
                </li>
              </ul>
            </li>
          </ul>
        </nav>
        <main>
          <h2>{title}</h2>
          {children}
        </main>
      </div>
    </div>
  </Page>
));
