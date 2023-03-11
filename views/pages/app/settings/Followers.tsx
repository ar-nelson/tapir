import {
  FollowDetail,
  FollowRequestDetail,
  SettingsPage,
  UserDetail,
  view,
} from "$/views/components/mod.ts";
import { Persona } from "$/models/Persona.ts";

const FollowerLink = ({ follow }: { follow: FollowDetail }) => (
  <a href={follow.url}>{follow.displayName} ({follow.name})</a>
);

const PostButton = (
  { url, id, text }: { url: string; id: string; text: string },
) => (
  <form method="post" action={url} style="display: inline-block;">
    <input type="hidden" name="id" value={id} />
    <input type="submit" value={text} />
  </form>
);

export const SettingsFollowersPage = view<{
  user: UserDetail;
  followersByPersona: {
    persona: Persona;
    followers: FollowDetail[];
    requests: FollowRequestDetail[];
  }[];
}>(
  ({ user, followersByPersona }, { strings }) => (
    <SettingsPage title={strings.settings.followers} user={user}>
      {followersByPersona.map(({ persona, followers, requests }) => (
        <>
          <section>
            <h2>{persona.displayName} (@{persona.name})</h2>
            <section>
              <h3>Followers ({followers.length})</h3>
              <ul>
                {followers.map((f) => (
                  <li>
                    <FollowerLink follow={f} />
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3>Follow Requests ({requests.length})</h3>
              <ul>
                {requests.map((r) => (
                  <li>
                    <FollowerLink follow={r} /> -{" "}
                    <PostButton
                      url="./followers/accept"
                      id={r.id}
                      text="Accept"
                    />{" "}
                    -{" "}
                    <PostButton
                      url="./followers/reject"
                      id={r.id}
                      text="Reject"
                    />
                  </li>
                ))}
              </ul>
            </section>
          </section>
        </>
      ))}
    </SettingsPage>
  ),
);
