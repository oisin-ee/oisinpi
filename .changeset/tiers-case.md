---
"@oisin-ee/pi-tiers": patch
---

Match tier targets to registry models and quota pools without regard to case. The tier file says `minimax-m3.1-flash`, but the provider lists `MiniMax-M3.1-Flash`. Before, the router treated that model as unlisted forever and filed its quota under the wrong pool. It now dispatches the registry's exact id and uses the `minimax` pool.
