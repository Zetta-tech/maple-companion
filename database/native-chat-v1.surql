-- Additive operational metadata only. No credentials, grants, deletion, or AM facts.
-- Apply explicitly to an approved database; never from application startup.
BEGIN;
DEFINE TABLE IF NOT EXISTS maple_native_sessions SCHEMAFULL PERMISSIONS NONE;
DEFINE FIELD IF NOT EXISTS owner ON maple_native_sessions TYPE string;
DEFINE FIELD IF NOT EXISTS key ON maple_native_sessions TYPE string;
DEFINE FIELD IF NOT EXISTS session_json ON maple_native_sessions TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON maple_native_sessions TYPE string;
DEFINE INDEX IF NOT EXISTS owner_key ON maple_native_sessions FIELDS owner, key UNIQUE;
DEFINE TABLE IF NOT EXISTS maple_native_requests SCHEMAFULL PERMISSIONS NONE;
DEFINE FIELD IF NOT EXISTS owner ON maple_native_requests TYPE string;
DEFINE FIELD IF NOT EXISTS key ON maple_native_requests TYPE string;
DEFINE FIELD IF NOT EXISTS digest ON maple_native_requests TYPE string;
DEFINE FIELD IF NOT EXISTS status ON maple_native_requests TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON maple_native_requests TYPE string;
DEFINE FIELD IF NOT EXISTS result_json ON maple_native_requests TYPE string | null;
DEFINE INDEX IF NOT EXISTS owner_key ON maple_native_requests FIELDS owner, key UNIQUE;
DEFINE INDEX IF NOT EXISTS owner_status ON maple_native_requests FIELDS owner, status;
DEFINE TABLE IF NOT EXISTS maple_native_guard SCHEMAFULL PERMISSIONS NONE;
DEFINE FIELD IF NOT EXISTS owner ON maple_native_guard TYPE string;
DEFINE FIELD IF NOT EXISTS epoch ON maple_native_guard TYPE int;
DEFINE INDEX IF NOT EXISTS owner_unique ON maple_native_guard FIELDS owner UNIQUE;
CREATE maple_schema:native_chat_v1 CONTENT { version: 1 };
COMMIT;
