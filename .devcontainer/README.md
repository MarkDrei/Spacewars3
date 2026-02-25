Short guide: starting the PostgreSQL DB and running tests in the devcontainer

If you are working inside this Codespace/Devcontainer, please note:

- The PostgreSQL services (`db` and `db-test`) are not automatically started from inside the devcontainer. The devcontainer runs in an isolated environment; the Docker daemon runs outside the container process.
- Tests (for example `npm test`) expect a reachable PostgreSQL instance on the Docker Compose network under the hostname `db`.

Recommended (safe) workflow:

1. On the host / Codespace terminal (not inside the isolated devcontainer):

```bash
# Start only the PostgreSQL services
docker compose up db db-test -d
```

2. Inside the devcontainer (IDE terminal):

```bash
# Ensure dependencies are installed and run tests
npm install
npm test
```

- Notes:
- The init script `./.devcontainer/init-db.sh` checks several hosts (localhost:5433, localhost:5432, then `db`) and waits for the database to become available. If `db` is reachable it will use that host automatically.
- If you want developers to run `docker`/`docker compose` from inside the container, you can mount the Docker socket and install the Docker CLI in the devcontainer. That gives the container access to the host daemon (security risk). See `devcontainer.json` for configuration.

Additional troubleshooting tip (when Docker is not available inside the container):

If `docker` is not available inside the devcontainer you can still create the test database from inside the container by connecting to the `db` service with `psql`. Example:

```bash
# create the test database by connecting to the db service
PGPASSWORD=spacewars psql -h db -U spacewars -d postgres -c "CREATE DATABASE spacewars_test;"
```

After creating the database the application will initialise tables and seed data automatically when tests run. For example: "ich habe mich mit psql -h db verbunden und die Datenbank erstellt, woraufhin das Projekt die Tabellen/Seeds anlegte und die Tests liefen."
