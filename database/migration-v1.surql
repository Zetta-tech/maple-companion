-- Additive migration audit table. Apply only with the separate development migration approval.
-- No auth, grants, existing-record modifications or automatic startup execution.
BEGIN;
DEFINE TABLE IF NOT EXISTS maple_migrations SCHEMAFULL PERMISSIONS NONE;
DEFINE FIELD IF NOT EXISTS source_digest ON maple_migrations TYPE string;
DEFINE FIELD IF NOT EXISTS record_count ON maple_migrations TYPE int;
DEFINE FIELD IF NOT EXISTS owner_count ON maple_migrations TYPE int;
DEFINE FIELD IF NOT EXISTS counts_json ON maple_migrations TYPE string;
DEFINE FIELD IF NOT EXISTS committed_at ON maple_migrations TYPE string;
CREATE maple_schema:migration_v1 CONTENT { version: 1 };
COMMIT;
