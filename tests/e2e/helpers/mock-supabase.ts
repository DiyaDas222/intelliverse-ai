/**
 * Tiny in-memory mock of the slice of supabase-js the webhook handler and
 * credit helpers use. Tables are arrays of plain objects. Each query starts
 * with `.from(table)` and returns a thenable builder that supports the
 * chained methods the production code uses: select / insert / upsert /
 * update / delete / eq / in / contains / limit / maybeSingle / single.
 */

export type Row = Record<string, any>;
export type Store = Record<string, Row[]>;

type Op = "select" | "insert" | "upsert" | "update" | "delete";

interface UpsertOpts {
  onConflict?: string;
}

function matches(row: Row, filters: Array<[string, any]>, ins: Array<[string, any[]]>, contains: Array<[string, Row]>) {
  for (const [c, v] of filters) if (row[c] !== v) return false;
  for (const [c, arr] of ins) if (!arr.includes(row[c])) return false;
  for (const [c, obj] of contains) {
    const target = row[c] ?? {};
    for (const k of Object.keys(obj)) if (target[k] !== (obj as any)[k]) return false;
  }
  return true;
}

class Builder {
  private filters: Array<[string, any]> = [];
  private ins: Array<[string, any[]]> = [];
  private _contains: Array<[string, Row]> = [];
  private op: Op = "select";
  private payload: any = null;
  private opts: UpsertOpts = {};
  private limitN: number | null = null;
  private mode: "many" | "maybeSingle" | "single" = "many";

  constructor(private store: Store, private table: string) {}

  select(_cols?: string) { this.op = "select"; return this; }
  insert(payload: any) { this.op = "insert"; this.payload = payload; return this; }
  upsert(payload: any, opts: UpsertOpts = {}) {
    this.op = "upsert"; this.payload = payload; this.opts = opts; return this;
  }
  update(payload: any) { this.op = "update"; this.payload = payload; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col: string, val: any) { this.filters.push([col, val]); return this; }
  in(col: string, arr: any[]) { this.ins.push([col, arr]); return this; }
  contains(col: string, obj: Row) { this._contains.push([col, obj]); return this; }
  limit(n: number) { this.limitN = n; return this; }
  maybeSingle() { this.mode = "maybeSingle"; return this.run(); }
  single() { this.mode = "single"; return this.run(); }
  order() { return this; }

  then<T>(onFulfilled: (v: any) => T) { return this.run().then(onFulfilled); }

  private rows(): Row[] {
    this.store[this.table] ||= [];
    return this.store[this.table];
  }

  private async run() {
    this.store[this.table] ||= [];
    const rows = this.rows();
    if (this.op === "select") {
      let out = rows.filter((r) => matches(r, this.filters, this.ins, this._contains));
      if (this.limitN != null) out = out.slice(0, this.limitN);
      // Return shallow copies so callers cannot mutate store rows by reference.
      const copy = out.map((r) => ({ ...r }));
      if (this.mode === "maybeSingle") return { data: copy[0] ?? null, error: null };
      if (this.mode === "single") return { data: copy[0], error: copy[0] ? null : { message: "no rows" } };
      return { data: copy, error: null };
    }
    if (this.op === "insert") {
      const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const r of arr) rows.push({ ...r });
      return { data: arr, error: null };
    }
    if (this.op === "upsert") {
      const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
      const conflictCols = (this.opts.onConflict ?? "id").split(",").map((c) => c.trim());
      for (const r of arr) {
        const existing = rows.find((row) => conflictCols.every((c) => row[c] === r[c]));
        if (existing) Object.assign(existing, r);
        else rows.push({ ...r });
      }
      return { data: arr, error: null };
    }
    if (this.op === "update") {
      const targets = rows.filter((r) => matches(r, this.filters, this.ins, this._contains));
      for (const r of targets) Object.assign(r, this.payload);
      return { data: targets, error: null };
    }
    if (this.op === "delete") {
      const keep = rows.filter((r) => !matches(r, this.filters, this.ins, this._contains));
      this.store[this.table] = keep;
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }
}

export interface MockSupabase {
  store: Store;
  from(table: string): Builder;
  rpc(name: string, args: Record<string, any>): Promise<{ data: any; error: any }>;
  __rpcHandlers: Record<string, (args: any) => any>;
}

export function createMockSupabase(seed: Store = {}): MockSupabase {
  const store: Store = JSON.parse(JSON.stringify(seed));
  const rpcHandlers: Record<string, (args: any) => any> = {};
  return {
    store,
    __rpcHandlers: rpcHandlers,
    from(table) { return new Builder(store, table); },
    async rpc(name, args) {
      const h = rpcHandlers[name];
      if (!h) return { data: null, error: { message: `unmocked rpc ${name}` } };
      try { return { data: await h(args), error: null }; }
      catch (e: any) { return { data: null, error: { message: e.message } }; }
    },
  };
}
