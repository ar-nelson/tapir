const existing = JSON.parse(
  await Deno.readTextFile("resources/buildMeta.json"),
);
existing.buildDate = (new Date()).toJSON();
await Deno.writeTextFile("resources/buildMeta.json", JSON.stringify(existing));
