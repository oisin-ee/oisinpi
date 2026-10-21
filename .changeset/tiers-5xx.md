---
"@oisin-ee/pi-tiers": patch
---

Treat a provider-side failure of one target as transient, so the tier moves to its next target instead of stopping. This covers HTTP 500 and 504, `internal_server_error`, `server_error` and `empty_stream`.
