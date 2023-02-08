import { Singleton } from "$/lib/inject.ts";
import { JsonLdContextFetcherService } from "$/services/JsonLdContextFetcherService.ts";
import { LongTermCache } from "$/services/LongTermCache.ts";
import { urlJoin } from "$/lib/urls.ts";
import {
  Context,
  isKeyword,
  JsonLdContext,
  JsonLdDocument,
  MutableContext,
} from "$/lib/jsonld.ts";

@Singleton()
export class JsonLdService {
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

  async processValue(value: unknown, options: {
    context: Context;
    expandTerms: boolean;
    expandValues: boolean;
    type?: string;
    container: string;
    extras?: Record<string, unknown>;
    usedLiterals?: Set<string>;
  }): Promise<unknown> {
    const { context, expandTerms, expandValues, container } = options;
    if (Array.isArray(value)) {
      if (
        expandValues || container === "@list" || container === "@set" ||
        value.length !== 1
      ) {
        return (await Promise.all(
          value.map((v) =>
            this.processValue(v, { ...options, container: "@value" })
          ),
        )).flat();
      }
      return this.processValue(value[0], options);
    }
    let finalValue = value;
    if (typeof value === "string") {
      switch (options.type) {
        case "@vocab":
          if (expandTerms) {
            finalValue = context.expandTerm(value);
          } else {
            const { compacted, rule } = context.compactTerm(value);
            if (options.usedLiterals && rule) {
              options.usedLiterals.add(rule);
            }
            finalValue = compacted;
          }
          break;
        case "@id":
          if (context.base != null) {
            if (expandTerms && !context.base.includes(":")) {
              finalValue = urlJoin(context.base, value);
            }
            if (!expandTerms && value.startsWith(context.base)) {
              finalValue = value.slice(context.base.length);
            }
          }
      }
    } else if (value != null && typeof value === "object") {
      const map = value as Record<string, unknown>;
      for (const k of [container, "@value", "@list", "@set"]) {
        if (k in map) {
          const { "@type": newType, [k]: containerValue, ...extras } = map;
          return this.processValue(containerValue, {
            ...options,
            type: newType as string ?? options.type,
            container: k,
            extras,
          });
        }
      }
    }
    if (options.type === "@json") {
      finalValue = {
        ...options.extras ?? {},
        [container]: finalValue,
        "@type": "@json",
      };
    } else if (finalValue && typeof finalValue === "object") {
      finalValue = await this.processDocument(finalValue as JsonLdDocument, {
        ...options,
        internal: true,
      });
    } else if (expandValues) {
      finalValue = {
        ...options.extras ?? {},
        [container]: finalValue,
        ...options.type ? { "@type": options.type } : {},
      };
    }
    return expandValues ? [finalValue] : finalValue;
  }

  async processDocument(
    { "@context": contextJson, ...document }: JsonLdDocument,
    options: {
      context?: Context;
      expandTerms?: boolean;
      expandValues?: boolean;
      usedLiterals?: Set<string>;
      internal?: boolean;
    } = {},
  ): Promise<JsonLdDocument> {
    const parentContext = options.context ?? new MutableContext(),
      context = contextJson
        ? await this.buildContext(contextJson, parentContext)
        : parentContext,
      expandTerms = options.expandTerms ?? true,
      expandValues = options.expandValues ?? false,
      processed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(document)) {
      const fullKey = (expandTerms && !isKeyword(k))
        ? context.expandTerm(k) ?? k
        : k;
      let mappedKey = fullKey;
      if (!expandTerms) {
        const container = (v && typeof v === "object")
            ? Object.keys(v).filter(isKeyword).find((c) =>
              context.longToShort.has(`${c}:${k}`)
            )
            : undefined,
          { compacted, rule } = context.compactTerm(k, container);
        if (options.usedLiterals && rule) {
          options.usedLiterals.add(rule);
        }
        mappedKey = compacted;
      }
      if (mappedKey === null) {
        continue;
      } else if (mappedKey === undefined) {
        mappedKey = fullKey;
      }
      if (isKeyword(fullKey)) {
        if (fullKey === "@type" && typeof v === "string" && !isKeyword(v)) {
          if (expandTerms) {
            processed[mappedKey] = context.expandTerm(v);
          } else {
            const { compacted, rule } = context.compactTerm(v);
            if (options.usedLiterals && rule) {
              options.usedLiterals.add(rule);
            }
            processed[mappedKey] = compacted;
          }
        } else {
          processed[mappedKey] = v;
        }
      } else {
        processed[mappedKey] = await this.processValue(v, {
          ...options,
          expandTerms,
          expandValues,
          context,
          type: context.types.get(fullKey),
          container: context.containers.get(fullKey) ?? "@value",
        });
      }
    }
    if (expandTerms || (options.internal && !contextJson)) {
      return processed;
    }
    return {
      "@context": context.toJson(options.usedLiterals),
      ...processed,
    };
  }
}
