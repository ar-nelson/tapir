import { h, View, view } from "$/lib/html.ts";
import { sprintf } from "$/deps.ts";
import { ServerDetail } from "$/views/types.ts";
import { Icon } from "$/views/components/Icon.tsx";
import { RelativeDateTime } from "$/views/components/RelativeDateTime.tsx";
import buildMeta from "$/resources/buildMeta.json" assert { type: "json" };

export const PublicGlobalNav = view<{ server: ServerDetail }>((
  { server },
) => (
  <aside class="public-global-nav">
    <header>
      <a class="public-server-name-link" href="/">
        <h1>{server.name}</h1>
      </a>
      <div class="summary">{server.summary}</div>
      <nav>
        <ul class="top-links">
          {server.links.map((l) => (
            <li>
              <a href={l.url}>
                <span>{l.name}</span> <Icon icon="chevron-right" />
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
    <footer>
      <small class="fine-print">
        {new View((i18n) => {
          const buildDate = new Date(buildMeta.buildDate);
          return sprintf(
            i18n.strings.footer,
            h(
              "a",
              { href: buildMeta.homepageUrl, target: "_blank" },
              buildMeta.name,
            ).render(i18n),
            buildMeta.version,
            RelativeDateTime({ date: buildDate }).render(i18n),
            h("a", { href: buildMeta.githubUrl, target: "_blank" }, "GitHub")
              .render(i18n),
          );
        })}
      </small>
    </footer>
  </aside>
));
