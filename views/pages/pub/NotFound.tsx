import { Icon, Page, ServerDetail, view } from "$/views/components/mod.ts";

export const NotFoundPage = view<{ server: ServerDetail }>((
  { server },
  { strings },
) => (
  <Page title={`${server.name} - ${strings.notFound}`}>
    <div class="page error-page">
      <main>
        <h1>{strings.notFound}</h1>
        <p>{strings.notFoundText}</p>
        <p>
          <a href="/" id="backlink" onclick="history.back(); return false;">
            <Icon icon="arrow-left" /> {strings.errorBack}
          </a>
          <script>
            document.getElementById("backlink").setAttribute('href',document.referrer||'/')
          </script>
        </p>
      </main>
    </div>
  </Page>
));
