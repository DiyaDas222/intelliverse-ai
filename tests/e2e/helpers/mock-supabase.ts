/**
 * Minimal in-memory mock of the slice of supabase-js the webhook handler
 * and credit helpers exercise. Tables are arrays of plain objects. Each
 * `.from(table)` returns a thenable query builder supporting the methods
 * used in production: select / insert / upsert / update / delete / eq /
 * in / contains / limit / maybeSingle / single / order.
 */

export type Row = Record<string, any>;
export type Store = Record<string, Row[]>;

interface UpsertOpts {
  onConflict?: string;
}

function rowMatches(
  row: Row,
  filters: Array<[string, any]>,
  ins: Array<[string, any[]]>,
  contains: Array<[string, Row]>,
): boolean {
  for (const [c, v] of filters) if (row[c] !== v) return false;
  for (const [c, arr] of ins) if (!arr.includes(row[c])) return false;
  for (const [c, obj] of contains) {
    const target = row[c] ?? {};
    for (const k of Object.keys(obj)) if (target[k] !== (obj as any)[k]) return false;
  }
  return true;
}

function makeBuilder(store: Store, table: string) {
  const state = {
    filters: [] as Array<[string, any]>,
    ins: [] as Array<[string, any[]]>,
    containsFilters: [] as Array<[string, Row]>,
    op: "select" as "select" | "insert" | "upsert" | "update" | "delete",
    payload: null as any,
    opts: {} as UpsertOpts,
    limitN: null as number | null,
    mode: "many" as "many" | "maybeSingle" | "single",
  };

  store[table] ||= [];

  async function run(): Promise<{ data: any; error: any }> {
    const rows = (store[table] ||= []);
    if (state.op === "select") {
      let out = rows.filter((r) => rowMatches(r, state.filters, state.ins, state.containsFilters));
      if (state.limitN != null) out = out.slice(0, state.limitN);
      const copy = out.map((r) => ({ ...r }));
      if (state.mode === "maybeSingle") return { data: copy[0] ?? null, error: null };
      if (state.mode === "single") return { data: copy[0], error: copy[0] ? null : { message: "no rows" } };
      return { data: copy, error: null };
    }
    if (state.op === "insert") {
      const arr = Array.isArray(state.payload) ? state.payload : [state.payload];
      for (const r of arr) rows.push({ ...r });
      return { data: arr, error: null };
    }
    if (state.op === "upsert") {
      const arr = Array.isArray(state.payload) ? state.payload : [state.payload];
      const conflictCols = (state.opts.onConflict ?? "id").split(",").map((c) => c.trim());
      for (const r of arr) {
        const existing = rows.find((row) => conflictCols.every((c) => row[c] === r[c]));
        if (existing) Object.assign(existing, r);
        else rows.push({ ...r });
      }
      return { data: arr, error: null };
    }
    if (state.op === "update") {
      const targets = rows.filter((r) => rowMatches(r, state.filters, state.ins, state.containsFilters));
      for (const r of targets) Object.assign(r, state.payload);
      return { data: targets, error: null };
    }
    if (state.op === "delete") {
      store[table] = rows.filter((r) => !rowMatches(r, state.filters, state.ins, state.containsFilters));
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }

  const builder: any = {
    select(_cols?: string) { state.op = "select"; return builder; },
    insert(payload: any) { state.op = "insert"; state.payload = payload; return builder; },
    upsert(payload: any, opts: UpsertOpts = {}) {
      state.op = "upsert"; state.payload = payload; state.opts = opts; return builder;
    },
    update(payload: any) { state.op = "update"; state.payload = payload; return builder; },
    delete() { state.op = "delete"; return builder; },
    eq(col: string, val: any) { state.filters.push([col, val]); return builder; },
    in(col: string, arr: any[]) { state.ins.push([col, arr]); return builder; },
    contains(col: string, obj: Row) { state.containsFilters.push([col, obj]); return builder; },
    limit(n: number) { state.limitN = n; return builder; },
    order() { return builder; },
    maybeSingle() { state.mode = "maybeSingle"; return run(); },
    single() { state.mode = "single"; return run(); },
    then<T>(onFulfilled: (v: any) => T, onRejected?: (e: any) => any) {
      return run().then(onFulfilled, onRejected);
    },
  };
  return builder;
}

export interface MockSupabase {
  store: Store;
  from(table: string): any;
  rpc(name: string, args: Record<string, any>): Promise<{ data: any; error: any }>;
  __rpcHandlers: Record<string, (args: any) => any>;
}

export function createMockSupabase(seed: Store = {}): MockSupabase {
  const store: Store = JSON.parse(JSON.stringify(seed));
  const rpcHandlers: Record<string, (args: any) => any> = {};
  return {
    store,
    __rpcHandlers: rpcHandlers,
    from(table: string) { return makeBuilder(store, table); },
    async rpc(name, args) {
      const h = rpcHandlers[name];
      if (!h) return { data: null, error: { message: `unmocked rpc ${name}` } };
      try { return { data: await h(args), error: null }; }
      catch (e: any) { return { data: null, error: { message: e.message } }; }
    },
  };
}
