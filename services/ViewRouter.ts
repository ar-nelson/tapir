import { RouteParams, Router, RouterContext, State, Status } from "$/deps.ts";
import { View } from "$/lib/html.ts";
import { I18nService } from "$/services/I18nService.ts";

export abstract class ViewRouter extends Router {
  constructor(private readonly i18nService: I18nService) {
    super();
  }

  getView<
    R extends string,
    P extends RouteParams<R> = RouteParams<R>,
    // deno-lint-ignore no-explicit-any
    S extends State = Record<string, any>,
  >(
    route: R,
    handler: (
      ctx: RouterContext<R, P, S>,
    ) => View | null | Promise<View | null>,
  ): void {
    this.get<R, P, S>(route, async (ctx: RouterContext<R, P, S>) => {
      const viewOrPromise = handler(ctx),
        view = viewOrPromise instanceof View
          ? viewOrPromise
          : viewOrPromise && await viewOrPromise;
      ctx.assert(view != null, Status.NotFound);
      ctx.response.type = "html";
      ctx.response.body = view.render(await this.i18nService.state);
    });
  }
}
