import { NodeInfoController } from "$/controllers/NodeInfoController.ts";
import { Context, Router } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import * as urls from "$/lib/urls.ts";
import { RouterState } from "./main.ts";

@Injectable()
export class NodeInfoRouter extends Router {
  constructor(controller: NodeInfoController) {
    super();

    this.get(
      urls.nodeInfoDirectory,
      (ctx: Context<RouterState>) => {
        ctx.state.isJson = true;
        ctx.response.body = controller.nodeInfoDirectory();
      },
    ).get(
      urls.nodeInfoV2_1,
      async (ctx: Context<RouterState>) => {
        ctx.state.isJson = true;
        ctx.response.headers.set(
          "content-type",
          'application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.1#"',
        );
        ctx.response.body = await controller.nodeInfoV2_1();
      },
    ).get(
      urls.nodeInfoV2_0,
      async (ctx: Context<RouterState>) => {
        ctx.state.isJson = true;
        ctx.response.headers.set(
          "content-type",
          'application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.0#"',
        );
        ctx.response.body = await controller.nodeInfoV2_0();
      },
    );
  }
}
