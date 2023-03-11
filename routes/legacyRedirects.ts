import { Router, Status } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";

@Injectable()
export class LegacyRedirectsRouter extends Router {
  constructor() {
    super();

    this.get("/users/:name", (ctx) => {
      ctx.response.status = Status.MovedPermanently;
      ctx.response.redirect(urls.activityPubActor(ctx.params.name));
    });
    this.post("/users/:name/inbox", (ctx) => {
      ctx.response.status = Status.PermanentRedirect;
      ctx.response.redirect(urls.activityPubInbox(ctx.params.name));
    });
    this.get("/users/:name/outbox", (ctx) => {
      ctx.response.status = Status.MovedPermanently;
      ctx.response.redirect(urls.activityPubOutbox(ctx.params.name));
    });
    this.get("/users/:name/followers", (ctx) => {
      ctx.response.status = Status.MovedPermanently;
      ctx.response.redirect(urls.activityPubFollowers(ctx.params.name));
    });
    this.get("/users/:name/following", (ctx) => {
      ctx.response.status = Status.MovedPermanently;
      ctx.response.redirect(urls.activityPubFollowing(ctx.params.name));
    });
    this.get("/users/:name/statuses/:id", (ctx) => {
      ctx.response.status = Status.MovedPermanently;
      ctx.response.redirect(urls.activityPubObject(ctx.params.id));
    });
    this.get("/users/:name/statuses/:id/activity", (ctx) => {
      ctx.response.status = Status.MovedPermanently;
      ctx.response.redirect(urls.activityPubActivity(ctx.params.id));
    });

    this.get("/@:name", (ctx) => {
      ctx.response.status = Status.MovedPermanently;
      ctx.response.redirect(urls.localProfile(ctx.params.name, {}));
    });
    this.get("/toot/:id", (ctx) => {
      ctx.response.status = Status.MovedPermanently;
      ctx.response.redirect(urls.localPost(ctx.params.id, {}));
    });
    this.get("/public/local", (ctx) => {
      ctx.response.status = Status.MovedPermanently;
      ctx.response.redirect("/pub/feed");
    });

    this.get("/media/local/:hash", (ctx) => {
      ctx.response.status = Status.MovedPermanently;
      ctx.response.redirect(urls.localMedia(ctx.params.hash));
    });
    this.get("/tapir-avatar.jpg", (ctx) => {
      ctx.response.status = Status.MovedPermanently;
      ctx.response.redirect("/static/tapir-avatar.jpg");
    });
  }
}
