# C2.4–C2.7 Fast-track TDD Plan

1. RED/GREEN pure classifier: eligible, historical, foreign tenant, ambiguous owner, active workflow, personal/unclassified.
2. RED/GREEN organisation destination resolver: zero/one/multiple owner organisations; ordinary memberships never imply ownership.
3. RED/GREEN tenant-application approval: bulk preflight, transactionally migrate eligible Property and linked Accommodation, preserve history, rollback, retry and concurrency.
4. RED/GREEN read-only discovery: bounded projections, aggregate/bulk reads, metrics, explicit refusal of write flags.
5. Gate Hotel prevention, tenant isolation, PA-04C, Web/Mobile, lint, architecture, build and diff.

No production execution, migration, commit, push or deployment.
