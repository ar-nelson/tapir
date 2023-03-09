import { Router } from "$/deps.ts";
import { Injectable } from "$/lib/inject.ts";
import { NodeInfoController } from "$/controllers/NodeInfoController.ts";
import * as urls from "$/lib/urls.ts";

@Injectable()
export class NodeInfoRouter extends Router {
  constructor(controller: NodeInfoController) {
    super();

    this.get(
      urls.nodeInfoDirectory,
      (ctx) => ctx.response.body = controller.nodeInfoDirectory(),
    ).get(
      urls.nodeInfoV2_0,
      (ctx) => ctx.response.body = controller.nodeInfoV2_0(),
    );
  }
}
