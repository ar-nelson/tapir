import { FirstRunController } from "$/controllers/FirstRunController.ts";
import { I18nService } from "$/services/I18nService.ts";
import { ViewRouter } from "$/services/ViewRouter.ts";

import { FirstRunPage } from "$/views/pages/FirstRun.tsx";
import { FirstRunErrorPage } from "$/views/pages/FirstRunError.tsx";

export class FirstRunRouter extends ViewRouter {
  constructor(controller: FirstRunController, securityKey: string) {
    super(new I18nService());

    this.getView(
      `/${securityKey}/firstRun`,
      async () => FirstRunPage({ defaults: await controller.setup() }),
    );
    this.post(
      `/${securityKey}/doFirstRun`,
      async (ctx) => {
        const config = await controller.submitSetup(
            await ctx.request.body({ type: "form" }).value,
          ),
          link = ctx.request.url.hostname === config.domain
            ? config.url
            : `http://${ctx.request.url.hostname}:${config.port}`;
        ctx.response.type = "html";
        // TODO: Use locale and language here
        ctx.response.body = `<!doctype html><html>
  <head>
    <title>The Tapir Awakes</title>
    <meta http-equiv="refresh" content="5;URL='${link}'" />
  </head>
  <body>
    <p>Waiting 5 seconds for the Tapir server to restart...</p>
    <p><a href="${link}">Click here if you are not automatically redirected.</a></p>
  </body>
</html>`;
      },
    );

    // TODO: Remove dependency on static files
    this.get(
      "/static/:file",
      (ctx) => ctx.send({ root: "static", path: ctx.params.file }),
    );

    this.getView("/", () => FirstRunErrorPage(undefined));
    this.get("/(.*)", (ctx) => {
      ctx.response.redirect("/");
    });
  }
}
