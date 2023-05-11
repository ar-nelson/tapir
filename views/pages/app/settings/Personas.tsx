import { SettingsPage, UserDetail, view } from "$/views/components/mod.ts";
import { Persona } from "$/models/types.ts";

export const SettingsPersonasPage = view<
  { user: UserDetail; personas: Persona[] }
>(
  ({ user, personas }, { strings }) => (
    <SettingsPage title={strings.settings.personas} user={user}>
      <ul>
        {personas.map((p) => (
          <li>
            <a
              href={`/app/settings/personas/edit/${encodeURIComponent(p.name)}`}
            >
              {p.displayName} (@{p.name})
            </a>
          </li>
        ))}
      </ul>
    </SettingsPage>
  ),
);
