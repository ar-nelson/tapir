FROM tootsuite/mastodon

USER root
COPY --chmod=644 certs/TestRootCA.pem /usr/local/share/ca-certificates/TestRootCA.crt
RUN update-ca-certificates

USER mastodon
