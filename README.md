# tapir: mastodon for one

A small, efficient Mastodon-compatible Fediverse server for single-user
instances. Based on Deno. I'm building this live on the web at
[tapir.social](https://tapir.social), and you can interact with it now!

Tapir is a work in progress and currently everything is hardcoded. There's no
reason to try using it yet.

Planned features:

- broad fediverse compatibility (quote toots, emoji reactions, etc.)
- install directly from a URL with one Deno command
- run with limited permissions (just `--allow-net` and a single folder)
- sqlite and postgres backends
- multiple personas (users) with one login and one home timeline
- personas can have different timeline styles (make it look like Pixelfed)
- build your own federated timeline from multiple servers
- post scheduling
- sophisticated filter rules and a customizable home timeline algorithm
- visitors cannot view other servers' posts through your instance
- follow RSS feeds, Nitter feeds, maybe Nostr feeds
- personal full-text search
- oauth login (but only for one account)
- a plugin system
- lovable and mischievous tapir mascot
