---
"@oisin-ee/pi-tiers": patch
---

Skip tier targets that the model registry does not list. A model that the proxy does not serve yet, such as MiniMax before it is configured, now behaves like an unavailable target. Before, it stopped the turn with "Unknown model".
