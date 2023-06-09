import { AmmoniaBuilder, init } from "ammonia";

await init();

const builder = new AmmoniaBuilder();
builder.tags.delete("article");
builder.tags.delete("aside");
builder.tags.delete("details");
builder.tags.delete("footer");
builder.tags.delete("header");
builder.tags.delete("img");
builder.tags.delete("map");
builder.tags.delete("nav");
builder.tags.delete("summary");

builder.urlSchemes.add("at");
builder.urlSchemes.add("diaspora");
builder.urlSchemes.add("did");
builder.urlSchemes.add("gemini");
builder.urlSchemes.add("gopher");
builder.urlSchemes.add("ipfs");
builder.urlSchemes.add("nostr");
builder.urlSchemes.add("ssb");

export const sanitizer = builder.build();
