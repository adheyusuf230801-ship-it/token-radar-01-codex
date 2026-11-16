# token-radar-01-codex
[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/adheyusuf230801-ship-it/token-radar-01-codex/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/adheyusuf230801-ship-it/token-radar-01-codex/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Northstar Radar is a token launch radar: a sealed DefiLlama snapshot goes in, and a ranked board of pre-token protocol records with conditional implied values and concrete farm plans comes out. It uses Node 22 standard library only, with an offline dashboard and a separate market-cap list for protocols that record a token.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

The input is the sealed snapshot from the kit.

## The model

Value = round(TVL × 0.32 × (1 + clamp(7d change, −60, 120) / 200) × (0.70 + 0.30 × sqrt(min(age, 1460) / 1460)) × (1 + min(6, max(0, chain count − 1)) / 100)). Unknown age uses 365 days; missing growth uses 0%. Category changes farm actions only. Age is measured against the sealed snapshot; outputs contain durations, not dates. The 40 watchlist records and 160 largest below-floor records that record no token are ranked by value, with slug ordering for ties.

## Remaining capture and submission work

The three real dashboard captures are in `screenshots/`: `1-board.jpg` (75 KiB), `2-detail.jpg` (108 KiB), and `3-filtered.jpg` (75 KiB). Each is a 1280 × 800 JPEG. The dossier has been rebuilt from these captures, and the entry is ready for the kit check and submission.

Remaining submission steps are to bundle the original harness transcripts, run the kit check, and submit.

Referral: pe031vr5
