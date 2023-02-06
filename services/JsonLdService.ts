import { Singleton } from "$/lib/inject.ts";
import { JsonLdContextFetcherService } from "$/services/JsonLdContextFetcherService.ts";
import { LongTermCache } from "$/services/LongTermCache.ts";
import {
  Context,
  isKeyword,
  JsonLdContext,
  JsonLdDocument,
  MutableContext,
} from "$/lib/jsonld.ts";

@Singleton()
export class JsonLd {
  constructor(
    private readonly contextFetcher: JsonLdContextFetcherService,
    private readonly cache: LongTermCache<Context>,
  ) {}

  async buildContext(
    ctxOrUrl: string | JsonLdContext | (string | JsonLdContext)[],
    parentContext?: Context,
  ): Promise<Context> {
    if (typeof ctxOrUrl === "string") {
      return this.cache.getOrSetAsync(ctxOrUrl, async () => {
        const json = await this.contextFetcher.getContext(ctxOrUrl);
        const mc = new MutableContext();
        if (parentContext) mc.merge(parentContext);
        mc.parse(json, ctxOrUrl);
        return mc;
      });
    } else if (Array.isArray(ctxOrUrl)) {
      let context = parentContext ?? new MutableContext();
      for (const c of ctxOrUrl) {
        context = await this.buildContext(c, context);
      }
      return context;
    } else {
      const mc = new MutableContext();
      if (parentContext) mc.merge(parentContext);
      mc.parse(ctxOrUrl, undefined, Object.keys(ctxOrUrl));
      return mc;
    }
  }

  async qualify(
    document: Record<string, unknown> | unknown[],
    parentContext?: Context,
  ): Promise<Record<string, unknown> | unknown[]> {
    if (Array.isArray(document)) {
      return Promise.all(document.map((x) => this.qualify(x, parentContext)));
    }
    let context = parentContext;
    if (document["@context"]) {
      context = await this.buildContext(
        document["@context"] as JsonLdContext,
        parentContext,
      );
    }
    if (context == null) {
      context = new MutableContext();
    }
    const expanded = context.qualifyOnce(document);
    for (const k in expanded) {
      if (isKeyword(k) && k !== "@value") {
        continue;
      }
      const v = expanded[k];
      if (v && typeof v === "object") {
        const o = v as JsonLdDocument;
        if (
          o["@value"] && typeof o["@value"] === "object" &&
          o["@type"] !== "@json"
        ) {
          if (o["@context"] !== undefined) {
            const subContext = await this.buildContext(o["@context"], context);
            o["@value"] = await this.qualify(
              o["@value"] as JsonLdDocument,
              subContext,
            );
          } else {
            o["@value"] = await this.qualify(
              o["@value"] as JsonLdDocument,
              context,
            );
          }
        } else {
          expanded[k] = await this.qualify(o, context);
        }
      }
    }
    delete expanded["@context"];
    return expanded;
  }

  private compactWithoutContext(
    document: Record<string, unknown> | unknown[],
    context: Context,
    usedLiterals: Set<string>,
  ): Record<string, unknown> | unknown[] {
    if (Array.isArray(document)) {
      return document.map((x) =>
        this.compactWithoutContext(x, context, usedLiterals)
      );
    }
    const compacted = context.compactOnce(document, usedLiterals);
    for (const k in compacted) {
      if (isKeyword(k)) {
        continue;
      }
      const v = compacted[k];
      if (v && typeof v === "object") {
        const o = v as JsonLdDocument;
        if (o["@type"] !== "@json") {
          compacted[k] = this.compactWithoutContext(o, context, usedLiterals);
        }
      }
    }
    return compacted;
  }

  compact(
    document: Record<string, unknown> | unknown[],
    context: Context,
  ): JsonLdDocument {
    const usedLiterals = new Set<string>(),
      root = this.compactWithoutContext(document, context, usedLiterals),
      contextJson = context.toJson(usedLiterals);
    return Array.isArray(root)
      ? {
        "@context": contextJson,
        "@value": root,
      }
      : { ...root, "@context": contextJson };
  }
}
