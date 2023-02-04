import { UnknownPageProps } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";

export default function NotFoundPage({ url }: UnknownPageProps) {
  return (
    <>
      <Head>
        <title>the void</title>
      </Head>
      <div style="text-align: center;">
        <img src="/tapir.jpg" alt="he is judging you for your ignorance" />
        <p>there is no page named {url.pathname}</p>
        <p>there never was</p>
        <p>maybe you imagined it?</p>
        <p>please seek professional help</p>
      </div>
    </>
  );
}
