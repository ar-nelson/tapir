FROM caddy:2

COPY --chmod=644 certs/TestRootCA.pem /usr/local/share/ca-certificates/TestRootCA.crt
RUN update-ca-certificates

COPY caddy/Caddyfile /etc/caddy/Caddyfile
