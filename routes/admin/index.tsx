import { Head } from "$fresh/runtime.ts";

export default function AdminIndex() {
  return (
    <>
      <Head>
        <title>tapir admin</title>
      </Head>
      <header>
        <h1>tapir admin</h1>
        <p>don't touch anything important</p>
      </header>
      <hr />
      <main>
        <ul>
          <li>
            <a href="/admin/toot">New toot</a>
          </li>
          <li>
            <a href="/admin/personas">Personas</a>
          </li>
          <li>
            <a href="/admin/followers">Followers</a>
          </li>
        </ul>
      </main>
    </>
  );
}
