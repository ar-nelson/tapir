import { Head } from "$fresh/runtime.ts";

export default function Home() {
  return (
    <>
      <Head>
        <title>tapir: mastodon for one</title>
      </Head>
      <div>
        <img src="/tapir.jpg" alt="our mascot, the majestic tapir" />
        <p>
          This is Tapir, a Mastodon-compatible Fediverse server for single-user
          instances.
        </p>
        <p>
          It only contains hardcoded data for now, but don't let that stop you.
          You can federate with it! You can connect a Mastodon client to it!
          It's pre-alpha and might send you garbage data! Isn't this exciting?
        </p>
        <p>
          I'm building Tapir in real time here at tapir.social. I'll devblog
          about my work on Tapir, on Tapir, as I build it:{" "}
          <a href="/@tapir">@tapir@tapir.social</a>
        </p>
        <p>
          I'm{" "}
          <a href="https://mastodon.online/@arnelson">Adam Nelson</a>, and I
          approve this message. Stay fresh, cheese bags.
        </p>
      </div>
    </>
  );
}
