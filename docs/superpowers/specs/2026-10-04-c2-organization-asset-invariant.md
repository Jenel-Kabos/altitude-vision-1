# C2.4–C2.7 Organization / Asset Invariant — Delta Map

| Gap | Root cause | Dependency | Batch | Migration impact | Decision |
|---|---|---|---|---|---|
| New Hotel for independent | Hotel self-service historically allowed `tenant:null` | canonical owner/Admin membership | A | prevention only | resolved by brief |
| Owner portfolio transition | tenant application provisioning does not inspect assets | pure asset classifier | B/C/D | local transactional writes | resolved by brief |
| Existing owned organisation | provisioning rejects every membership | canonical owner membership resolution | B | no second tenant | resolved by brief |
| Multiple owned organisations | no deterministic destination | owner organisation cardinality | B | none; 409 | resolved by brief |
| Historical properties | no eligibility classification | asset cycle + completed workflow facts | C | KEEP HISTORY | resolved by brief |
| Active workflows | no preflight | bulk reservation/transaction facts | C | none; 409 | resolved by brief |
| Linked Accommodation | Property transition can diverge linked tenant | Property-first graph migration | D | same transaction | resolved by brief |
| Legacy discovery | A–F audit is generic and relation resolution can be N+1 | projected/batched organisation audit | E | read-only | resolved by brief |

Dependency: prevention → canonical owner destination → pure classification → transactional graph transition → read-only discovery.

The transition is attached to the already transactional tenant-application approval. It never trusts request tenant/owner IDs. Platform administration remains distinct from ownership.
