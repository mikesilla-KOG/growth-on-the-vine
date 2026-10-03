# gotv-ask — Cloudflare Worker behind previews/ask/ (PREVIEW ONLY)

Answers a visitor's Bible question with ONE integrated answer built only from retrieved BSB verses and Pastor Kincer sermon passages.
Deployed at https://gotv-ask.growonthevine.workers.dev (workers.dev; no custom route). CORS allows only https://growonthevine.com and https://www.growonthevine.com.

## Pipeline (POST /ask  {"q": "..."} )
1. Origin check, JSON/length check (≤300 chars), answer cache (Cache API, 24 h; hits cost nothing and don't count against limits).
2. Regex crisis pre-check -> canned care message + 988 (US), no AI call.
3. Limits (KV): per-IP 10/hour & 40/day (key = SHA-256(day|ip|salt), no raw IPs stored), global daily cap (`GLOBAL_CAP`, default 60).
4. Planner (gpt-4.1-mini, JSON): intent (bible_question | crisis | medical_legal | off_topic | manipulation), keywords, topics, likely refs, sermon query. Non-Bible intents get a polite canned reply.
5. Retrieval: whole-BSB BM25 (precomputed weights in 64 static shards) + OpenBible topic passages + planner refs (validated against the BSB) ; sermons = BM25 + text-embedding-3-small cosine (RRF), top 8 paragraphs.
6. Relevance judge (gpt-5.2): each sermon paragraph direct / partial / none; "none" ones are dropped (this is what yields "not covered in the sermons yet").
7. Compose (gpt-5.4-mini, strict JSON schema; prompt in src/prompts.js). Citation markers `[[b:V3|exact words]]`, `[[k:S2|exact words]]`, `[[s:S2]]`, `[[v:V3]]`.
8. Server-side validation (src/validate.js): every BSB quote must be an exact stretch of the supplied verse; every Kincer quote an exact stretch of the transcript paragraph; no ellipsis; length caps; text copied from sources outside markers is flagged; style lint (no named speakers, no "agrees with"); one retry with feedback; then repair (whole best-matching sentence) or drop. The client receives structured JSON (no HTML).
9. Logs: only anonymised question text (emails/phones/links stripped) + coverage, KV, 30-day TTL, successful answers only. No IP stored except the hashed rate-limit key.

## Build / deploy (needs Node 22 for wrangler; secrets come from env, never from files)
    npm install
    node build/build_data.mjs          # regenerates public/ (BSB chapters, BM25 shards, topics, sermons + embeddings). Inputs: /workspace/gotv-work/ask/bsb/bsb.txt, data/topic-scores.txt, /workspace/gotv-repo/messages/*/content.json
    export CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=...
    printf %s "$OPENAI_API_KEY" | npx wrangler secret put OPENAI_API_KEY
    npx wrangler secret put DEBUG_KEY  # optional: lets the owner bypass the per-IP limit / cache for testing
    npx wrangler deploy
`public/` is generated (about 11 MB) and is not committed to the website repo. Re-run build_data whenever sermons are added.
