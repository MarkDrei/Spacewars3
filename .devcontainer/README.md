Short guide: starting the PostgreSQL DB and running tests in the devcontainer

The PostgreSQL `db` service hosts both the `spacewars` (dev) and `spacewars_test`
(test) databases. The `database/init-test-db.sh` script creates `spacewars_test`
automatically the first time the container starts, so no manual setup is needed.

The devcontainer runs inside an isolated container. The Docker daemon runs
**outside** it. If `docker`/`docker compose` is not available inside your terminal,
that terminal is inside the devcontainer — use the host terminal for Docker commands.

Recommended workflow:

1. On the **host / Codespace terminal** (outside the devcontainer):

```bash
# Start the PostgreSQL service (creates both spacewars and spacewars_test)
docker compose up db -d
```

2. Inside the **devcontainer** (IDE terminal):

```bash
npm test          # run all tests
npm run dev       # start the Next.js dev server
```

The devcontainer already has `POSTGRES_TEST_HOST=db` and `POSTGRES_TEST_DB=spacewars_test`
set as environment variables (via `.devcontainer/docker-compose.yml`), so `npm test`
works without any extra steps.

Troubleshooting: if the `db` service is not running, start it from the host with
`docker compose up db -d` and wait for it to become healthy before running tests.
