# Dockerfiles

Every `FROM` that is not `scratch`, an earlier stage, or a build argument.

- Target: a newer tag of the same flavor (same suffix such as `-bookworm-slim`, same precision) at least `minReleaseAgeDays` old, and always a digest pin:
  `FROM node:26.13.0-bookworm-slim@sha256:<digest>`. Keep a readable tag in front of the digest; the digest decides what is pulled.
- `node` images take their major from the Node.js LTS rule; other images take the newest same-flavor tag.
- Non Docker Hub registries (ghcr.io, quay.io, ECR): `plan` lists them for review; resolve the digest with `docker buildx imagetools inspect <ref>` and pin it the same way.
- Verify with `docker build` when Docker is running; otherwise record that the image was not built.
- OS release changes (bookworm to trixie) are majors: package names and paths in `RUN` steps may change.
