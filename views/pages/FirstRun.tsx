import {
  Page,
  SettingsInput,
  SettingsRow,
  view,
} from "$/views/components/mod.ts";
import { TapirConfig } from "$/schemas/tapir/TapirConfig.ts";

export const FirstRunPage = view<{ defaults: TapirConfig }>((
  { defaults },
  { strings: { firstRun: strings } },
) => (
  <Page title={strings.pageTitle}>
    <div class="page first-run-page">
      <main>
        <h1>{strings.heading}</h1>
        <form method="post" action="./doFirstRun" class="settings-form">
          <fieldset>
            <legend>{strings.instance}</legend>
            <dl>
              <SettingsInput
                name="domain"
                label={strings.domain}
                sublabel={strings.domainHint}
                type="text"
                value={defaults.domain}
                required
              />
              <SettingsInput
                name="url"
                label={strings.url}
                sublabel={strings.urlHint}
                type="text"
                value={defaults.url}
                required
              />
              <SettingsInput
                name="port"
                label={strings.port}
                sublabel={strings.portHint}
                type="number"
                value={defaults.port}
                min="80"
                max="65535"
                required
              />
              <SettingsInput
                name="adminEmail"
                label={strings.adminEmail}
                sublabel={strings.adminEmailHint}
                type="text"
                placeholder="admin@example.com"
                value={defaults.instance?.adminEmail}
                required
              />
              <SettingsInput
                name="displayName"
                label={strings.displayName}
                sublabel={strings.displayNameHint}
                type="text"
                value={defaults.instance?.displayName ??
                  strings.displayNameDefault}
                required
              />
              <SettingsInput
                name="summary"
                label={strings.summary}
                sublabel={strings.summaryHint}
                type="text"
                value={defaults.instance?.summary ?? strings.summaryDefault}
              />
            </dl>
          </fieldset>
          <fieldset>
            <legend>{strings.login}</legend>
            <p>{strings.loginHint}</p>
            <dl>
              <SettingsInput
                name="loginName"
                label={strings.loginName}
                type="text"
                placeholder="admin"
                value={defaults.auth?.username}
                required
              />
              <SettingsInput
                name="password"
                label={strings.password}
                type="password"
                value={defaults.auth?.password}
                required
              />
              <SettingsInput
                name="confirmPassword"
                label={strings.confirmPassword}
                type="password"
                value={defaults.auth?.password}
                required
              />
            </dl>
          </fieldset>
          <fieldset>
            <legend>{strings.storage}</legend>
            <p>{strings.storageHint}</p>
            <dl>
              <SettingsInput
                name="dataDir"
                label={strings.dataDir}
                sublabel={strings.dataDirHint}
                type="text"
                value={defaults.dataDir}
                required
              />
              <SettingsRow
                label={strings.localDatabaseType}
                name="localDatabaseType"
              >
                <select
                  name="localDatabaseType"
                  id="localDatabaseType"
                  required
                >
                  <option
                    value="inmemory"
                    selected={defaults.localDatabase?.type === "inmemory"}
                  >
                    {strings.inmemoryLocal}
                  </option>
                  <option
                    value="sqlite"
                    selected={defaults.localDatabase?.type === "sqlite"}
                  >
                    {strings.databaseSqlite}
                  </option>
                </select>
              </SettingsRow>
              <SettingsRow label={strings.localRepoType}>
                <select name="localRepoType" id="localRepoType" required>
                  <option
                    value="inmemory"
                    selected={defaults.localMedia?.type === "inmemory"}
                  >
                    {strings.inmemoryLocal}
                  </option>
                  <option
                    value="file"
                    selected={defaults.localMedia?.type === "file"}
                  >
                    {strings.repoFile}
                  </option>
                </select>
              </SettingsRow>
              <SettingsRow label={strings.remoteDatabaseType}>
                <select
                  name="remoteDatabaseType"
                  id="remoteDatabaseType"
                  required
                >
                  <option
                    value="inmemory"
                    selected={defaults.remoteDatabase?.type === "inmemory"}
                  >
                    {strings.inmemory}
                  </option>
                  <option
                    value="sqlite"
                    selected={defaults.remoteDatabase?.type === "sqlite"}
                  >
                    {strings.databaseSqlite}
                  </option>
                </select>
              </SettingsRow>
              <SettingsRow label={strings.remoteRepoType}>
                <select name="remoteRepoType" id="remoteRepoType" required>
                  <option
                    value="inmemory"
                    selected={defaults.remoteMedia?.type === "inmemory"}
                  >
                    {strings.inmemory}
                  </option>
                  <option
                    value="file"
                    selected={defaults.remoteMedia?.type === "file"}
                  >
                    {strings.repoFile}
                  </option>
                </select>
              </SettingsRow>
              <SettingsInput
                name="remoteDatabaseMaxObjects"
                label={strings.remoteDatabaseMaxObjects}
                sublabel={strings.remoteDatabaseMaxObjectsHint}
                type="number"
                value={defaults.remoteDatabase?.maxObjects}
              />
              <SettingsInput
                name="remoteRepoMaxSizeMB"
                label={strings.remoteRepoMaxSizeMB}
                sublabel={strings.remoteRepoMaxSizeMBHint}
                type="number"
                value={defaults.remoteMedia?.maxSizeMB}
              />
            </dl>
          </fieldset>
          <fieldset>
            <legend>{strings.mainPersona}</legend>
            <p>{strings.mainPersonaHint}</p>
            <dl>
              <SettingsInput
                name="mainPersonaName"
                label={strings.mainPersonaName}
                placeholder={strings.mainPersonaNamePlaceholder}
                value={defaults.mainPersona?.name}
                type="text"
                required
              />
              <SettingsInput
                name="mainPersonaDisplayName"
                label={strings.mainPersonaDisplayName}
                placeholder={strings.mainPersonaDisplayNamePlaceholder}
                value={defaults.mainPersona?.displayName}
                type="text"
                required
              />
              <SettingsInput
                name="mainPersonaSummary"
                label={strings.mainPersonaSummary}
                value={defaults.mainPersona?.summary}
                type="text"
              />
              <SettingsInput
                name="mainPersonaRequestToFollow"
                label={strings.mainPersonaRequestToFollow}
                checked={defaults.mainPersona?.requestToFollow}
                type="checkbox"
              />
            </dl>
          </fieldset>
          <div>
            <input type="submit" value={strings.submit} />
          </div>
        </form>
      </main>
    </div>
  </Page>
));
