-- Operator-approved additive schema. Public official information, no private profiles.
-- Never executed at application startup. Seed an independently approved exact digest.
BEGIN;
DEFINE TABLE IF NOT EXISTS maple_policy_sources SCHEMAFULL PERMISSIONS NONE;
DEFINE FIELD IF NOT EXISTS release_digest ON maple_policy_sources TYPE string;
DEFINE FIELD IF NOT EXISTS source_id ON maple_policy_sources TYPE string;
DEFINE FIELD IF NOT EXISTS body_sha256 ON maple_policy_sources TYPE string;
DEFINE FIELD IF NOT EXISTS source_json ON maple_policy_sources TYPE string;
DEFINE INDEX IF NOT EXISTS release_source ON maple_policy_sources FIELDS release_digest,source_id UNIQUE;
DEFINE TABLE IF NOT EXISTS maple_policy_versions SCHEMAFULL PERMISSIONS NONE;
DEFINE FIELD IF NOT EXISTS digest ON maple_policy_versions TYPE string;
DEFINE FIELD IF NOT EXISTS version ON maple_policy_versions TYPE string;
DEFINE FIELD IF NOT EXISTS manifest_json ON maple_policy_versions TYPE string;
DEFINE FIELD IF NOT EXISTS approved_at ON maple_policy_versions TYPE string;
DEFINE INDEX IF NOT EXISTS digest_unique ON maple_policy_versions FIELDS digest UNIQUE;
DEFINE TABLE IF NOT EXISTS maple_policy_active SCHEMAFULL PERMISSIONS NONE;
DEFINE FIELD IF NOT EXISTS digest ON maple_policy_active TYPE string;
DEFINE FIELD IF NOT EXISTS version ON maple_policy_active TYPE string;
DEFINE FIELD IF NOT EXISTS activated_at ON maple_policy_active TYPE string;
CREATE ONLY maple_schema:policy_registry_v1 CONTENT {version:1};
COMMIT;
