# FC27 historical match import

The authorized `FCClubsDerived_v6_FC27.store` import contributes 94 distinct league matches for LEO XI (79638, common-gen5), dated 25 September–9 October 2026 in Amsterdam. At review time 20 already existed, so 74 are new. Source SQLite integrity and all match score/timestamp comparisons passed. Club totals (101 matches), current roster and attendance are preserved.

`data/imports/fc27-history.json` contains canonical match records. Original SQLite tables duplicate the same 94 matches and must not be added together. Apple timestamps are converted to Unix seconds by adding 978307200. Player counters and event strings are copied without filling missing fields or changing contradictory events. The current decoder rejects inconsistent events independently of named counters.

The one-time startup migration writes only missing `match:<id>` records into the existing Cloudflare Durable Object storage and records a version, source SHA-256, count and time. The migration runs transactionally and is idempotent across deployments/restarts. Existing match records take precedence, `latest` and `recentMatchIds` stay unchanged, and the weekly archive is rebuilt from the expanded history. `/api/archive` exposes the migration record as `historyImport`.

SQLite player lists lack EA IDs. Known names are mapped to observed EA IDs from the live archive. Serhantes and unobserved opponent players receive explicit `historical:<club>:<name-hash>` identifiers. Imported provisional IDs are reconciled automatically when a future EA record supplies a real ID; usernames and statistics are preserved.

The source file, live archive backup and club snapshot backup were retained locally; they are not published as application assets. The normalized match bundle is committed for reproducible migration. To reproduce:

```sh
python3 scripts/convert-store-history.py /path/to/source.store --archive /path/to/live-archive-backup.json --output data/imports/fc27-history.json
```

Backfill adds history, not seven missing records: the file contains 94 of 101 club matches. It does not supply historical skill ratings or reconstruct unavailable event counters.
