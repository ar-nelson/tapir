import {
  Page,
  PublicGlobalNav,
  ServerDetail,
  view,
} from "$/views/components/mod.ts";

export const IndexPage = view<{ server: ServerDetail }>(({ server }) => (
  <Page title={server.name}>
    <div class="page index-page">
      <PublicGlobalNav server={server} />
    </div>
  </Page>
));
