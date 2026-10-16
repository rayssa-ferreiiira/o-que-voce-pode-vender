// uso: BASE=https://... ADMIN=senha CODIGO=XYZ node simulador/simular.mjs [ids...]
import fs from "fs";
import { PERSONAS } from "./personas.mjs";

const BASE = process.env.BASE;
const ADMIN = process.env.ADMIN;
const CODIGO = process.env.CODIGO || "SIMULA";
const SAIDA = new URL("./saida/", import.meta.url).pathname;
fs.mkdirSync(SAIDA, { recursive: true });

class Jarra {
  c = {};
  guardar(r) { for (const s of r.headers.getSetCookie?.() ?? []) { const [kv] = s.split(";"); const [k, ...v] = kv.split("="); this.c[k.trim()] = v.join("="); } }
  get h() { return Object.entries(this.c).map(([k, v]) => `${k}=${v}`).join("; "); }
}

async function req(j, caminho, opts = {}) {
  const r = await fetch(BASE + caminho, { redirect: "manual", ...opts, headers: { cookie: j.h, ...(opts.headers || {}) } });
  j.guardar(r);
  return r;
}

async function simular(p) {
  const j = new Jarra();
  await req(j, `/c/${CODIGO}`);
  const conversa = [];
  const t0 = Date.now();
  let fase = "explorando";
  const tempos = [];
  for (let volta = 0; volta < 40 && fase !== "email" && fase !== "concluida"; volta++) {
    let msg;
    if (volta === 0 && p.inicio) msg = p.inicio;
    else {
      const r = await fetch(BASE + "/api/admin/persona", { method: "POST", headers: { "content-type": "application/json", "x-admin-senha": ADMIN }, body: JSON.stringify({ persona: p.texto, conversa }) });
      msg = (await r.json()).texto;
    }
    conversa.push({ autor: "cliente", texto: msg });
    const ti = Date.now();
    let primeiro = 0;
    const r = await req(j, "/api/conversa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texto: msg }) });
    if (!r.ok) { console.log(p.id, "erro", r.status, await r.text()); break; }
    let resposta = "", buf = "";
    const dec = new TextDecoder();
    for await (const pedaco of r.body) {
      buf += dec.decode(pedaco, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const ev = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
        if (ev.t === "delta") { if (!primeiro) primeiro = Date.now() - ti; resposta += ev.texto; }
        if (ev.t === "fim") fase = ev.fase;
        if (ev.t === "erro") console.log(p.id, "erro stream", ev.texto);
      }
    }
    tempos.push({ primeiro, total: Date.now() - ti });
    conversa.push({ autor: "ray", texto: resposta });
    // dá tempo pro anotador em segundo plano
    await new Promise((s) => setTimeout(s, 2500));
  }
  const res = { id: p.id, fase, trocas: conversa.filter((m) => m.autor === "cliente").length, minutos: ((Date.now() - t0) / 60000).toFixed(1), tempos, conversa };
  if (fase === "email") {
    const r = await req(j, "/api/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `sim+${p.id}@teste.trama` }) });
    const { id } = await r.json();
    const tm = Date.now();
    for (let k = 0; k < 120; k++) {
      const m = await (await fetch(`${BASE}/api/mapa/${id}`)).json();
      if (m.status !== "gerando") { res.mapa = m.mapa; res.mapaStatus = m.status; break; }
      await new Promise((s) => setTimeout(s, 2000));
    }
    res.mapaSegundos = ((Date.now() - tm) / 1000).toFixed(0);
    res.mapaId = id;
    await fetch(BASE + "/api/admin/teste", { method: "POST", headers: { cookie: `ovpv_admin=${ADMIN}`, "content-type": "application/x-www-form-urlencoded" }, body: `email=sim%2B${p.id}%40teste.trama&teste=1`, redirect: "manual" });
  }
  fs.writeFileSync(`${SAIDA}${p.id}.json`, JSON.stringify(res, null, 2));
  const md = conversa.map((m) => `**${m.autor === "ray" ? "Ray" : "Cliente"}:** ${m.texto}`).join("\n\n");
  fs.writeFileSync(`${SAIDA}${p.id}.md`, `# ${p.id} (${res.fase}, ${res.trocas} trocas, ${res.minutos} min, mapa ${res.mapaSegundos ?? "-"}s)\n\n${md}\n`);
  console.log(p.id, res.fase, res.trocas, "trocas", res.minutos, "min", "mapa", res.mapaSegundos, "s", res.mapaStatus ?? "");
}

const ids = process.argv.slice(2);
const alvo = ids.length ? PERSONAS.filter((p) => ids.includes(p.id)) : PERSONAS;
await Promise.all(alvo.map((p) => simular(p).catch((e) => console.log(p.id, "falhou", e.message))));
