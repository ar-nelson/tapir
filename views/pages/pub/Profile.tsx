import {
  Page,
  PostDetail,
  ProfileDetail,
  PublicGlobalNav,
  PublicPostFeed,
  ServerDetail,
  view,
} from "$/views/components/mod.ts";
import { sprintf } from "$/deps.ts";

export const PublicProfilePage = view<
  { server: ServerDetail; profile: ProfileDetail; posts: PostDetail[] }
>(({ server, profile, posts }, { strings, number, date }) => (
  <Page
    title={`${server.name} - ${
      sprintf(strings.profile.title, profile.displayName, profile.name)
    }`}
  >
    <div class="page public-page profile-page">
      <PublicGlobalNav server={server} />
      <main>
        <header class="profile-header">
          <div
            class="profile-banner"
            style={profile.bannerUrl &&
              `background-image: url('${profile.bannerUrl}');`}
          />
          <div class="profile-content">
            <div class="profile-avatar">
              <img src={profile.avatarUrl} loading="lazy" />
            </div>
            <h2>
              {profile.displayName}{" "}
              <span class="profile-name-username">({profile.name})</span>
            </h2>
            <div class="summary">{profile.summary}</div>
            <dl class="profile-stats">
              {profile.createdAt && (
                <div>
                  <dt>{strings.profile.createdAt}</dt>
                  <dd>
                    <time datetime={profile.createdAt.toISO()}>
                      {date.format(profile.createdAt.toJSDate())}
                    </time>
                  </dd>
                </div>
              )}
              <div>
                <dt>{strings.profile.posts}</dt>
                <dd>{number.format(profile.postCount ?? 0)}</dd>
              </div>
              <div>
                <dt>{strings.profile.following}</dt>
                <dd>{number.format(profile.followingCount ?? 0)}</dd>
              </div>
              <div>
                <dt>{strings.profile.followers}</dt>
                <dd>{number.format(profile.followerCount ?? 0)}</dd>
              </div>
            </dl>
          </div>
        </header>
        <PublicPostFeed posts={posts} />
      </main>
    </div>
  </Page>
));
