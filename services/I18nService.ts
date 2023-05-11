import { logError } from "$/lib/error.ts";
import { I18nState } from "$/lib/html.ts";
import { InjectableAbstract, Singleton } from "$/lib/inject.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import defaultEnglishStrings from "$/resources/strings/en-US.json" assert {
  type: "json",
};

@InjectableAbstract()
export class I18nService {
  public readonly state: Promise<I18nState>;

  constructor(public readonly locale: string | Promise<string> = "en-US") {
    // TODO: validate locale name
    const localePromise = typeof locale === "string"
      ? Promise.resolve(locale)
      : locale;
    this.state = localePromise.then(async (l) => ({
      date: new Intl.DateTimeFormat(l, { dateStyle: "long" }),
      dateTime: new Intl.DateTimeFormat(l, {
        dateStyle: "full",
        timeStyle: "full",
      }),
      number: new Intl.NumberFormat(l),
      relativeTime: new Intl.RelativeTimeFormat(l, {
        numeric: "auto",
      }),
      strings:
        await (l === "en-US"
          ? defaultEnglishStrings
          : import(`$/resources/strings/${l}.json`, {
            assert: { type: "json" },
          })
            .catch((e) => {
              logError(
                `Failed to load strings for locale ${l}; using en-US strings instead`,
                e,
              );
              return defaultEnglishStrings;
            })),
    }));
  }
}

@Singleton(I18nService)
export class I18nServiceImpl extends I18nService {
  constructor(instanceConfigStore: InstanceConfigStore) {
    // TODO: Support changing locale while running
    super(instanceConfigStore.get().then((c) => c.locale));
  }
}
