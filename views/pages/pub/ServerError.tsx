import { Icon, Page, ServerDetail, view } from "$/views/components/mod.ts";

export const ServerErrorPage = view<
  {
    server: ServerDetail;
    status: number;
    errorType?: string;
    errorMessage?: string;
  }
>((
  { server },
  { strings },
) => (
  <Page title={`${server.name} - ${strings.serverError}`}>
    <div class="page error-page">
      <main>
        <h1>{strings.serverError}</h1>
        <p>{strings.serverErrorText}</p>
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
