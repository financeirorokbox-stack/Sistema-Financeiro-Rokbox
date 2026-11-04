import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CID = Deno.env.get("BLING_CLIENT_ID")!;
const CSECRET = Deno.env.get("BLING_CLIENT_SECRET")!;
const CID2 = Deno.env.get("BLING2_CLIENT_ID") || "";
const CSECRET2 = Deno.env.get("BLING2_CLIENT_SECRET") || "";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEVICE = "rokbox_financeiro";
const BLING = "https://api.bling.com.br/Api/v3";
const sb = createClient(SB_URL, SB_KEY);
async function getSecret() { const { data } = await sb.rpc("get_bling_sync_secret"); return data; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function credsFor(acct) { return acct === 2 ? { cid: CID2, csecret: CSECRET2, tokenKey: "blingTokens2" } : { cid: CID, csecret: CSECRET, tokenKey: "blingTokens" }; }
function keyFor(acct) { return acct === 2 ? "blingCustos2" : "blingCustos"; }
function rowId(chave) { const s = DEVICE + "|" + chave; let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }
async function setKey(chave, obj) { await sb.from("sistema_dados").upsert({ id: rowId(chave), device_id: DEVICE, chave, valor: JSON.stringify(obj), atualizado_em: new Date().toISOString() }, { onConflict: "id" }); }
async function getKey(chave) { const { data } = await sb.from("sistema_dados").select("valor").eq("device_id", DEVICE).eq("chave", chave).maybeSingle(); return data ? JSON.parse(data.valor) : null; }
async function tokenReq(params, acct) { const c = credsFor(acct); const r = await fetch(`${BLING}/oauth/token`, { method: "POST", headers: { "Authorization": `Basic ${btoa(`${c.cid}:${c.csecret}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() }); const j = await r.json(); if (!r.ok) throw new Error("token " + r.status + ": " + JSON.stringify(j)); return j; }
async function accessToken(acct) { const c = credsFor(acct); const t = await getKey(c.tokenKey); if (!t) throw new Error("Ainda nao autorizado (acct " + acct + ")."); if (Date.now() > (t.obtained_at || 0) + ((t.expires_in || 0) - 60) * 1000) { const nt = await tokenReq({ grant_type: "refresh_token", refresh_token: t.refresh_token }, acct); await setKey(c.tokenKey, { ...nt, obtained_at: Date.now() }); return nt.access_token; } return t.access_token; }
async function G(path, at) { for (let t = 0; t < 4; t++) { const r = await fetch(`${BLING}${path}`, { headers: { "Authorization": `Bearer ${at}`, "Accept": "application/json" } }); if (r.status === 429) { await sleep(1500); continue; } const j = await r.json().catch(() => ({})); return { status: r.status, data: j }; } return { status: 429, data: {} }; }

async function pull(acct) {
  const at = await accessToken(acct);
  const map = {}; let total = 0, comCusto = 0;
  let pagina = 1;
  while (pagina <= 300) {
    const r = await G(`/produtos?pagina=${pagina}&limite=100`, at);
    if (r.status !== 200) throw new Error("produtos " + r.status + ": " + JSON.stringify(r.data));
    const rows = (r.data && r.data.data) || [];
    for (const p of rows) { const sku = String(p.codigo || "").trim(); if (!sku) continue; const c = +p.precoCusto || 0; if (!map[sku]) map[sku] = { custo: 0, colecao: "", preco: 0 }; map[sku].custo = +c.toFixed(2); map[sku].preco = +(+p.preco || 0).toFixed(2); if (c > 0) comCusto++; total++; }
    if (rows.length < 100) break;
    pagina++; await sleep(180);
  }
  const catR = await G(`/categorias/produtos?pagina=1&limite=100`, at);
  let cats = ((catR.data && catR.data.data) || []).map((c) => ({ id: c.id, descricao: c.descricao, idPai: (c.categoriaPai && c.categoriaPai.id) || 0 }));
  cats.sort((a, b) => (a.idPai === 0 ? 0 : 1) - (b.idPai === 0 ? 0 : 1));
  const catNome = {}; cats.forEach((c) => { catNome[c.id] = c.descricao; });
  for (const c of cats) {
    let pg = 1;
    while (pg <= 200) {
      const r = await G(`/produtos?pagina=${pg}&limite=100&idCategoria=${c.id}`, at);
      if (r.status !== 200) break;
      const rows = (r.data && r.data.data) || [];
      for (const p of rows) { const sku = String(p.codigo || "").trim(); if (!sku) continue; if (!map[sku]) map[sku] = { custo: +(+p.precoCusto || 0).toFixed(2), colecao: "", preco: +(+p.preco || 0).toFixed(2) }; map[sku].colecao = c.descricao; }
      if (rows.length < 100) break;
      pg++; await sleep(150);
    }
  }
  let comColecao = 0; Object.values(map).forEach((v) => { if (v.colecao) comColecao++; });
  await setKey(keyFor(acct), { atualizado: new Date().toISOString(), total: Object.keys(map).length, comCusto, comColecao, categorias: catNome, map });
  return { ok: true, acct, produtos: total, skus: Object.keys(map).length, comCusto, semCusto: Object.keys(map).length - comCusto, comColecao, categorias: cats.length };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  try {
    const SECRET = await getSecret();
    if (!SECRET || req.headers.get("x-sync-key") !== SECRET) return new Response(JSON.stringify({ erro: "nao autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
    const acct = url.searchParams.get("acct") === "2" ? 2 : 1;
    const r = await pull(acct);
    return new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json" } });
  } catch (e) { return new Response(JSON.stringify({ ok: false, erro: e?.message || String(e) }), { status: 500, headers: { "Content-Type": "application/json" } }); }
});
