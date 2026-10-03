#!/bin/bash
# wrapper: runs wrangler with the bundled Node 22 (system node is 20). Needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in env.
cd "$(dirname "$0")"; exec ./node_modules/.bin/node node_modules/wrangler/bin/wrangler.js "$@"
