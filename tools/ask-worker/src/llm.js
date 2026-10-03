const URL_ = 'https://api.openai.com/v1/';
async function post(env, path, body, timeoutMs = 45000) {
  const r = await fetch(URL_ + path, { method: 'POST', headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) { const t = await r.text(); throw new Error('openai ' + r.status + ' ' + t.slice(0, 160).replace(/sk-[A-Za-z0-9_-]+/g, 'sk-…')); }
  return r.json();
}
export async function respond(env, { model, system, input, schemaName, schema, maxOut, effort }) {
  const body = { model, instructions: system, input, max_output_tokens: maxOut, store: false, text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } } };
  if (/^(gpt-5|o\d)/.test(model)) body.reasoning = { effort: effort || 'low' }; else body.temperature = 0.2;
  const d = await post(env, 'responses', body);
  const msg = (d.output || []).find(o => o.type === 'message'); const txt = msg && msg.content && msg.content.find(c => c.type === 'output_text');
  if (!txt) throw new Error('openai: no output (' + (d.incomplete_details && d.incomplete_details.reason || d.status) + ')');
  return { json: JSON.parse(txt.text), usage: { in: d.usage?.input_tokens || 0, out: d.usage?.output_tokens || 0, cached: d.usage?.input_tokens_details?.cached_tokens || 0, reasoning: d.usage?.output_tokens_details?.reasoning_tokens || 0 }, model };
}
export async function embed(env, text) {
  const d = await post(env, 'embeddings', { model: 'text-embedding-3-small', input: text, dimensions: 512 }, 15000);
  return { vec: d.data[0].embedding, tokens: d.usage?.total_tokens || 0 };
}
