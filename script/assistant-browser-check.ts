/**
 * Development-only real-browser check, for when the shared browser tester is occupied.
 * Uses an isolated Chromium profile and normal password login. Never prints or saves keys.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import WebSocket from "ws";

if (process.env.NODE_ENV !== "development" || !process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Browser QA is restricted to explicitly selected development.");
}
const { pool } = await import("../server/db");
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const password = `Qa8!${randomBytes(30).toString("base64url")}`;
const treeId = randomUUID(), memberId = randomUUID();
let userId = "", chrome: ChildProcess | undefined, ws: WebSocket | undefined;
const profile = await mkdtemp(`${tmpdir()}/assistant-browser-`);
const port = 19873;
async function seed(args: string[], stdin = ""): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", "scripts/qa-demo-user.ts", ...args, "--confirm-development"], { env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", b => { out += b; });
    child.stderr.on("data", () => {});
    child.on("exit", code => code === 0 ? resolve(out) : reject(new Error("QA account helper failed")));
    child.stdin.end(stdin);
  });
}
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let seq = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
function cdp(method: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws!.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.delete(id)) reject(new Error(`Browser command timed out: ${method}`)); }, 20000).unref();
  });
}
async function evaluate(expression: string) {
  const value = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (value.exceptionDetails) throw new Error("Browser expression failed");
  return value.result?.value;
}
async function waitFor(expression: string, label: string) {
  for (let i = 0; i < 60; i++) {
    if (await evaluate(expression)) return;
    await delay(200);
  }
  throw new Error(`Browser check timed out: ${label}`);
}
const click = async (selector: string) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
function check(value: any, message: string) { if (!value) throw new Error(message); }
async function screenshot(name: string) {
  // One-time token must be dismissed before capturing any screenshot.
  check(!(await evaluate('Boolean(document.querySelector("[data-testid=assistant-key-token]"))')), "Secret panel must be closed before screenshots");
  await mkdir("screenshots", { recursive: true });
  const shot = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 75 });
  await writeFile(`screenshots/${name}.jpg`, Buffer.from(shot.data, "base64"));
}
try {
  const account = JSON.parse(await seed(["create"], password));
  userId = account.id;
  await pool.query("INSERT INTO family_trees(id,name,owner_id,root_member_id) VALUES($1,'Assistant browser QA',$2,$3)", [treeId, userId, memberId]);
  await pool.query("INSERT INTO family_members(id,tree_id,first_name,claimed_by_user_id) VALUES($1,$2,'Casey QA',$3)", [memberId, treeId, userId]);
  chrome = spawn("/repl/tools/bin/chromium", [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    `--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });
  let targets: any[];
  for (let i = 0; ; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[]; break; }
    catch { if (i > 60) throw new Error("Headless browser unavailable"); await delay(200); }
  }
  ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => { ws!.once("open", resolve); ws!.once("error", () => reject(new Error("Browser connection failed"))); });
  ws.on("message", data => {
    const message = JSON.parse(data.toString());
    if (!message.id) return;
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter?.reject(new Error("Browser protocol error"));
    else waiter?.resolve(message.result);
  });
  await cdp("Page.enable"); await cdp("Runtime.enable");
  await cdp("Page.navigate", { url: `${origin}/login` });
  await waitFor('location.pathname === "/login" && document.readyState === "complete"', "login page");
  const login = await evaluate(`(async()=>{const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(${JSON.stringify({ email: account.email, password })})});return r.status})()`);
  check(login === 200, "Normal password login failed");
  await cdp("Page.navigate", { url: `${origin}/account/settings` });
  await waitFor('Boolean(document.querySelector("[data-testid=input-assistant-key-name]"))', "assistant settings");
  await evaluate(`(()=>{const e=document.querySelector("[data-testid=input-assistant-key-name]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"Browser QA tool");e.dispatchEvent(new Event("input",{bubbles:true}));})()`);
  await click("[data-testid=select-assistant-tree]");
  await waitFor('Boolean([...document.querySelectorAll("[role=option]")].find(e=>e.textContent.includes("Assistant browser QA")))', "tree selector");
  await evaluate('[...document.querySelectorAll("[role=option]")].find(e=>e.textContent.includes("Assistant browser QA")).click()');
  await click("[data-testid=select-assistant-member]");
  await waitFor('Boolean([...document.querySelectorAll("[role=option]")].find(e=>e.textContent.includes("Casey QA")))', "profile selector");
  await evaluate('[...document.querySelectorAll("[role=option]")].find(e=>e.textContent.includes("Casey QA")).click()');
  await waitFor('!document.querySelector("[data-testid=button-create-assistant-key]").disabled', "create enabled");
  await click("[data-testid=button-create-assistant-key]");
  await waitFor('Boolean(document.querySelector("[data-testid=assistant-key-token] input"))', "one-time key");
  const token = await evaluate('document.querySelector("[data-testid=assistant-key-token] input").value');
  check(typeof token === "string" && token.startsWith("fr_agent_"), "Expected a one-time assistant key");
  await click("[data-testid=button-copy-assistant-token]");
  await click('[aria-label="Dismiss key"]');
  check(!(await evaluate('Boolean(document.querySelector("[data-testid=assistant-key-token]"))')), "Token dismissal failed");
  const settings = await evaluate('(async()=>await(await fetch("/api/agent/settings")).json())()');
  const keyId = settings.keys.find((k: any) => k.treeId === treeId).id;
  check(!JSON.stringify(settings).includes(token), "Settings must not expose the key");
  const request = async (path: string, method = "GET", body?: any) => evaluate(`(async()=>{const r=await fetch(${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{Authorization:${JSON.stringify(`Bearer ${token}`)},"Content-Type":"application/json"},${body ? `body:JSON.stringify(${JSON.stringify(body)}),` : ""}});return {status:r.status,data:await r.json()}})()`);
  const draft = await request("/api/agent/people", "POST", { name: "Maria Browser QA", label: "mother", of: "member", requestId: randomUUID() });
  check(draft.status === 202, "Body-ID draft creation failed");
  const before = await request("/api/agent/tree");
  check(!before.data.members.some((m: any) => m.name === "Maria Browser QA"), "Draft must stay hidden");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor(`Boolean(document.querySelector("[data-testid=button-approve-assistant-action-${draft.data.actionId}]"))`, "draft in member UI");
  await click(`[data-testid=button-approve-assistant-action-${draft.data.actionId}]`);
  await waitFor(`!document.querySelector("[data-testid=button-approve-assistant-action-${draft.data.actionId}]")`, "site acceptance");
  const after = await request("/api/agent/tree");
  check(after.data.members.some((m: any) => m.name === "Maria Browser QA"), "Accepted draft must be visible");
  check(after.data.labels.some((l: any) => l.label === "mother"), "Accepted relationship missing");
  await screenshot("assistant-settings-desktop");
  await click(`[data-testid=button-review-stop-${keyId}]`);
  await waitFor(`Boolean(document.querySelector("[data-testid=button-review-renew-${keyId}]")) && !document.querySelector("[data-testid=button-review-stop-${keyId}]")`, "paused UI");
  check((await request("/api/agent/people", "POST", { name: "Paused QA", requestId: randomUUID() })).status === 403, "Paused write must fail");
  check((await request("/api/agent/tree")).status === 200, "Paused read should remain allowed");
  await click(`[data-testid=button-review-renew-${keyId}]`);
  await waitFor(`Boolean(document.querySelector("[data-testid=button-review-stop-${keyId}]"))`, "renewal UI");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate('document.querySelector("#assistant-access-title").scrollIntoView()');
  await screenshot("assistant-settings-mobile");
  check(await evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), "Mobile page overflows horizontally");
  await cdp("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
  const revokeClick = click(`[data-testid=button-revoke-assistant-key-${keyId}]`);
  await delay(400);
  await cdp("Page.handleJavaScriptDialog", { accept: true });
  await revokeClick;
  await waitFor(`!document.querySelector("[data-testid=button-revoke-assistant-key-${keyId}]")`, "revoked UI");
  check((await request("/api/agent/tree")).status === 401, "Revoked key must fail");
  check((await request("/api/agent/people", "POST", { name: "Revoked QA", requestId: randomUUID() })).status === 401, "Revoked write must fail");
  check(!(await evaluate('Boolean(document.querySelector("[data-testid=assistant-key-token]"))')), "Plaintext key must not reappear");
  check((await evaluate('(async()=>await(await fetch("/api/agent/health")).json())()')).ok === true, "Public health failed");
  console.log("PASS: normal sign-in, one-time key, copy/dismiss, JSON task ID, hidden draft, site approval, pause/read/write rules, renewal, revocation, desktop/mobile layout.");
} finally {
  ws?.close(); chrome?.kill("SIGTERM");
  if (userId) {
    for (const table of ["assistant_actions", "assistant_keys", "relationships", "family_events"]) await pool.query(`DELETE FROM ${table} WHERE tree_id=$1`, [treeId]);
    await pool.query("DELETE FROM family_members WHERE tree_id=$1", [treeId]);
    await pool.query("DELETE FROM family_trees WHERE id=$1 AND owner_id=$2", [treeId, userId]);
    await seed(["revoke", userId]);
    console.log("QA fixtures removed; synthetic credentials and sessions revoked.");
  }
  await pool.end();
  await delay(200);
  await rm(profile, { recursive: true, force: true });
}
