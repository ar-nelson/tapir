// deno-lint-ignore-file no-explicit-any
declare const htm: {
  bind<HResult>(
    h: (type: any, props: Record<string, any>, ...children: any[]) => HResult,
  ): (strings: TemplateStringsArray, ...values: any[]) => HResult | HResult[];
};
export default htm;
