import { Page, view } from "$/views/components/mod.ts";

export const FirstRunErrorPage = view<undefined>((
  _,
  { strings: { firstRun: strings } },
) => (
  <Page title={strings.authError}>
    <main>
      <h1>{strings.authError}</h1>
      <p>{strings.authErrorText}</p>
    </main>
  </Page>
));
