import { view } from "$/lib/html.ts";
import { UserDetail } from "$/views/types.ts";

export const PrivateGlobalNav = view<{ user: UserDetail }>((
  { user },
) => (
  <header class="private-global-nav">
    <a class="private-server-name-link" href="/">
      <h1>{user.serverName}</h1>
    </a>
  </header>
));
