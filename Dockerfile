FROM denoland/deno

EXPOSE 9100
WORKDIR /srv

COPY deps.ts .
COPY deno.json .
COPY deno.lock .
COPY import_map.json .
COPY tapir.ts .
COPY controllers ./controllers
COPY lib ./lib
COPY models ./models
COPY resources ./resources
COPY routes ./routes
COPY schemas ./schemas
COPY services ./services
COPY static ./static
COPY views ./views

RUN chown -R deno .

USER deno
RUN deno check tapir.ts

ENTRYPOINT deno task start