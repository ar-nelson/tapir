import { Injectable } from "$/lib/inject.ts";
import { I18nService } from "$/services/I18nService.ts";
import { ViewRouter } from "$/services/ViewRouter.ts";
import { SettingsController } from "$/controllers/SettingsController.ts";
import { Context, REDIRECT_BACK, Status } from "$/deps.ts";

import { SettingsRootPage } from "$/views/pages/app/settings/SettingsRoot.tsx";
import { SettingsPersonasPage } from "$/views/pages/app/settings/Personas.tsx";
import { SettingsEditPersonaPage } from "$/views/pages/app/settings/EditPersona.tsx";
import { SettingsFollowersPage } from "$/views/pages/app/settings/Followers.tsx";
import { ComposePage } from "$/views/pages/app/Compose.tsx";

@Injectable()
export class SettingsRouter extends ViewRouter {
  constructor(controller: SettingsController, i18n: I18nService) {
    super(i18n);

    this.getView(
      "/",
      async () => SettingsRootPage(await controller.settingsRoot()),
    );
    this.getView(
      "/personas",
      async () => SettingsPersonasPage(await controller.personasForm()),
    );

    this.getView(
      "/personas/edit/:name",
      async (ctx) =>
        SettingsEditPersonaPage(
          await controller.editPersonaForm(ctx.params.name),
        ),
    );
    this.post("/personas/edit/:name/submit", async (ctx) => {
      const form = await ctx.request.body({ type: "form-data" }).value.read();
      await controller.doUpdatePersona(ctx.params.name, form);
      ctx.response.redirect(REDIRECT_BACK, "/app/settings/personas");
    });

    this.getView(
      "/personas/followers",
      async () => SettingsFollowersPage(await controller.followersForm()),
    );
    this.post("/personas/followers/accept", async (ctx: Context) => {
      const form = await ctx.request.body({ type: "form" }).value;
      ctx.assert(form.has("id"), Status.BadRequest);
      await controller.doAcceptFollow(form.get("id")!);
      ctx.response.redirect(REDIRECT_BACK, "/app/settings/personas/followers");
    });
    this.post("/personas/followers/reject", async (ctx: Context) => {
      const form = await ctx.request.body({ type: "form" }).value;
      ctx.assert(form.has("id"), Status.BadRequest);
      await controller.doRejectFollow(form.get("id")!);
      ctx.response.redirect(REDIRECT_BACK, "/app/settings/personas/followers");
    });

    this.getView(
      "/compose",
      async () => ComposePage(await controller.composeForm()),
    );
    this.post("/compose/submit", async (ctx) => {
      const form = await ctx.request.body({ type: "form-data" }).value.read();
      await controller.doCreatePost(form);
      ctx.response.redirect(REDIRECT_BACK, "/app/settings/compose");
    });
  }
}
