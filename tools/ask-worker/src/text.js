// Shared by the Worker and the data builder: identical tokenizer/stemmer so index and queries agree.
export const STOP = new Set("a an the and or of to in on is are was were be been do does did i you we it this that for with as at by from can what how why who when my me your our not no have has had should would could about there their they them his her he she if so but all any more most than then into out up one will shall unto upon him us whom which".split(" "));
export function stem(w) {
  for (const suf of ["ings", "ing", "edly", "ed", "ies", "es", "s", "ly"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, w.length - suf.length) + (suf === "ies" ? "y" : "");
  }
  return w;
}
export function toks(s) {
  return (s.toLowerCase().replace(/’/g, "'").match(/[a-z]+/g) || []).filter(w => !STOP.has(w) && w.length > 1).map(stem);
}
export function shardOf(term, n) {
  let h = 2166136261;
  for (let i = 0; i < term.length; i++) { h ^= term.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h % n;
}
export const normQ = s => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\u00a0/g, " ");
