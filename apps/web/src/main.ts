import type { APIResponse, TodoDTO } from "@repo/dto";

import "./style.css";

interface Endpoint {
  label: string;
  url: string;
}

/** One timed request: client round trip plus what the server reported. */
interface Sample {
  rttMs: number;
  appMs: number;
  dbMs: number;
  platform: string;
  region: string;
}

type BenchTest = "ping" | "ping-db" | "list" | "write";

const STORAGE_KEY = "pingdo.endpoints";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------------------
// Endpoints

function defaultEndpoints(): Endpoint[] {
  const raw = (import.meta.env.VITE_ENDPOINTS as string | undefined) ?? "";
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [label, ...rest] = pair.split("=");
      return { label: label!.trim(), url: normalizeUrl(rest.join("=")) };
    });
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function loadEndpoints(): Endpoint[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Endpoint[];
  } catch {
    // Storage unavailable or corrupt — fall back to the build-time defaults.
  }
  return defaultEndpoints();
}

function saveEndpoints() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(endpoints));
  } catch {
    // Non-fatal: endpoints just won't survive a reload.
  }
}

let endpoints = loadEndpoints();

// ---------------------------------------------------------------------------
// Timed fetch

function parseServerTiming(header: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of (header ?? "").split(",")) {
    const [name, ...params] = part.trim().split(";");
    const dur = params.find((p) => p.trim().startsWith("dur="));
    if (name && dur) out[name] = Number(dur.trim().slice(4));
  }
  return out;
}

async function timedFetch<T>(
  endpoint: Endpoint,
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; sample: Sample }> {
  const start = performance.now();
  const res = await fetch(`${endpoint.url}/api/v1${path}`, {
    ...init,
    cache: "no-store",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = (await res.json()) as APIResponse<T>;
  const rttMs = performance.now() - start;

  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

  const timing = parseServerTiming(res.headers.get("Server-Timing"));
  return {
    data: body.data,
    sample: {
      rttMs,
      appMs: timing.app ?? 0,
      dbMs: timing.db ?? 0,
      platform: res.headers.get("X-Pingdo-Platform") ?? "?",
      region: res.headers.get("X-Pingdo-Region") ?? "?",
    },
  };
}

// ---------------------------------------------------------------------------
// Benchmark

/** Runs one iteration of a test. `write` is two requests (create + delete),
 *  so its sample sums both. */
async function runOnce(endpoint: Endpoint, test: BenchTest): Promise<Sample> {
  switch (test) {
    case "ping":
      return (await timedFetch(endpoint, "/ping")).sample;
    case "ping-db":
      return (await timedFetch(endpoint, "/ping/db")).sample;
    case "list":
      return (await timedFetch(endpoint, "/todos")).sample;
    case "write": {
      const created = await timedFetch<TodoDTO>(endpoint, "/todos", {
        method: "POST",
        body: JSON.stringify({ title: `bench ${new Date().toISOString()}` }),
      });
      const deleted = await timedFetch(endpoint, `/todos/${created.data.id}`, {
        method: "DELETE",
      });
      return {
        ...deleted.sample,
        rttMs: created.sample.rttMs + deleted.sample.rttMs,
        appMs: created.sample.appMs + deleted.sample.appMs,
        dbMs: created.sample.dbMs + deleted.sample.dbMs,
      };
    }
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const ms = (n: number) => `${n.toFixed(1)} ms`;

function renderResultRow(row: HTMLTableRowElement, endpoint: Endpoint, samples: Sample[]) {
  const rtts = samples.map((s) => s.rttMs).sort((a, b) => a - b);
  const app = avg(samples.map((s) => s.appMs));
  const last = samples[samples.length - 1];
  const cells = [
    endpoint.label,
    last ? `${last.platform} · ${last.region}` : "…",
    String(samples.length),
    ms(rtts[0] ?? 0),
    ms(percentile(rtts, 50)),
    ms(percentile(rtts, 95)),
    ms(rtts[rtts.length - 1] ?? 0),
    ms(app),
    ms(avg(samples.map((s) => s.dbMs))),
    ms(Math.max(0, percentile(rtts, 50) - app)),
  ];
  row.replaceChildren(
    ...cells.map((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      return td;
    }),
  );
}

function renderErrorRow(row: HTMLTableRowElement, endpoint: Endpoint, err: unknown) {
  const label = document.createElement("td");
  label.textContent = endpoint.label;
  const msg = document.createElement("td");
  msg.className = "error";
  msg.colSpan = 9;
  msg.textContent = err instanceof Error ? err.message : String(err);
  row.replaceChildren(label, msg);
}

async function runBenchmark() {
  const button = $<HTMLButtonElement>("bench-run");
  const test = $<HTMLSelectElement>("bench-test").value as BenchTest;
  const count = Math.max(1, Math.min(500, Number($<HTMLInputElement>("bench-count").value) || 1));
  const tbody = $<HTMLTableSectionElement>("bench-results");

  button.disabled = true;
  tbody.replaceChildren();

  for (const endpoint of endpoints) {
    const row = tbody.insertRow();
    renderResultRow(row, endpoint, []);
    try {
      // Warm-up: pays for DNS, TLS, the CORS preflight and any cold start so
      // the measured requests reflect a warm, kept-alive connection.
      await runOnce(endpoint, test);
      const samples: Sample[] = [];
      for (let i = 0; i < count; i++) {
        samples.push(await runOnce(endpoint, test));
        renderResultRow(row, endpoint, samples);
      }
    } catch (err) {
      renderErrorRow(row, endpoint, err);
    }
  }

  button.disabled = false;
}

// ---------------------------------------------------------------------------
// Todos

function currentTodoEndpoint(): Endpoint | undefined {
  const url = $<HTMLSelectElement>("todo-endpoint").value;
  return endpoints.find((e) => e.url === url);
}

function showTodoLatency(action: string, sample: Sample) {
  $("todo-latency").textContent =
    `${action}: ${ms(sample.rttMs)} round trip · app ${ms(sample.appMs)} · db ${ms(sample.dbMs)} · ${sample.platform} ${sample.region}`;
}

function showTodoError(err: unknown) {
  $("todo-latency").textContent = err instanceof Error ? err.message : String(err);
}

async function loadTodos() {
  const endpoint = currentTodoEndpoint();
  const list = $<HTMLUListElement>("todo-list");
  if (!endpoint) {
    list.replaceChildren();
    return;
  }
  try {
    const { data, sample } = await timedFetch<TodoDTO[]>(endpoint, "/todos");
    showTodoLatency("list", sample);
    list.replaceChildren(...data.map((todo) => todoItem(endpoint, todo)));
  } catch (err) {
    showTodoError(err);
  }
}

function todoItem(endpoint: Endpoint, todo: TodoDTO): HTMLLIElement {
  const li = document.createElement("li");
  li.classList.toggle("done", todo.completed);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = todo.completed;
  checkbox.addEventListener("change", async () => {
    try {
      const { sample } = await timedFetch<TodoDTO>(endpoint, `/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: checkbox.checked }),
      });
      li.classList.toggle("done", checkbox.checked);
      showTodoLatency("update", sample);
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      showTodoError(err);
    }
  });

  const title = document.createElement("span");
  title.className = "grow";
  title.textContent = todo.title;

  const remove = document.createElement("button");
  remove.className = "ghost";
  remove.textContent = "Delete";
  remove.addEventListener("click", async () => {
    try {
      const { sample } = await timedFetch(endpoint, `/todos/${todo.id}`, { method: "DELETE" });
      li.remove();
      showTodoLatency("delete", sample);
    } catch (err) {
      showTodoError(err);
    }
  });

  li.append(checkbox, title, remove);
  return li;
}

$<HTMLFormElement>("todo-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const endpoint = currentTodoEndpoint();
  const input = $<HTMLInputElement>("todo-title");
  const title = input.value.trim();
  if (!endpoint || !title) return;
  try {
    const { data, sample } = await timedFetch<TodoDTO>(endpoint, "/todos", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    input.value = "";
    $("todo-list").prepend(todoItem(endpoint, data));
    showTodoLatency("create", sample);
  } catch (err) {
    showTodoError(err);
  }
});

$("todo-endpoint").addEventListener("change", loadTodos);

// ---------------------------------------------------------------------------
// Endpoint management

function renderEndpoints() {
  const list = $<HTMLUListElement>("endpoint-list");
  list.replaceChildren(
    ...endpoints.map((endpoint, i) => {
      const li = document.createElement("li");
      const text = document.createElement("span");
      text.className = "grow";
      text.textContent = `${endpoint.label} — ${endpoint.url}`;
      const remove = document.createElement("button");
      remove.className = "ghost";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        endpoints.splice(i, 1);
        saveEndpoints();
        renderEndpoints();
      });
      li.append(text, remove);
      return li;
    }),
  );

  const select = $<HTMLSelectElement>("todo-endpoint");
  const previous = select.value;
  select.replaceChildren(
    ...endpoints.map((endpoint) => new Option(endpoint.label, endpoint.url)),
  );
  if (endpoints.some((e) => e.url === previous)) select.value = previous;
  void loadTodos();
}

$<HTMLFormElement>("endpoint-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const label = $<HTMLInputElement>("endpoint-label");
  const url = $<HTMLInputElement>("endpoint-url");
  endpoints.push({ label: label.value.trim(), url: normalizeUrl(url.value) });
  saveEndpoints();
  label.value = "";
  url.value = "";
  renderEndpoints();
});

$("bench-run").addEventListener("click", runBenchmark);

renderEndpoints();
