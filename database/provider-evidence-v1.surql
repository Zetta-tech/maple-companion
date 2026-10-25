-- PREPARED ONLY. Requires approved target/schema application. No startup migration.
-- Owner-private operation metadata, no raw messages, personal facts or credentials.
BEGIN;
DEFINE TABLE IF NOT EXISTS maple_provider_evidence SCHEMAFULL PERMISSIONS NONE;
DEFINE FIELD IF NOT EXISTS owner ON maple_provider_evidence TYPE string;
DEFINE FIELD IF NOT EXISTS key ON maple_provider_evidence TYPE string;
DEFINE FIELD IF NOT EXISTS purpose ON maple_provider_evidence TYPE string;
DEFINE FIELD IF NOT EXISTS digest ON maple_provider_evidence TYPE string;
DEFINE FIELD IF NOT EXISTS recorded_at ON maple_provider_evidence TYPE string;
DEFINE INDEX IF NOT EXISTS owner_purpose_key ON maple_provider_evidence FIELDS owner, purpose, key UNIQUE;
CREATE maple_schema:provider_evidence_v1 CONTENT { version: 1 };
COMMIT;
