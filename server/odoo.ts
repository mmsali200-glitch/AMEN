/**
 * OdooConnector - موصل Odoo ERP الكامل عبر JSON-RPC
 * يدعم الإصدارات 14-19 مع اكتشاف تلقائي للإصدار
 */

interface OdooConfig {
  url: string;
  database: string;
  username: string;
  password: string;
}

interface JournalEntry {
  odooMoveId: number;
  name: string;
  ref: string | null;
  journalName: string;
  journalType: string;
  date: string;
  state: string;
  totalDebit: number;
  totalCredit: number;
  partnerName: string | null;
  narration: string | null;
  lines: JournalLine[];
}

interface JournalLine {
  odooLineId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  partnerName: string | null;
  label: string | null;
  debit: number;
  credit: number;
  date: string;
}

export class OdooConnector {
  private url: string;
  private database: string;
  private username: string;
  private password: string;
  private uid: number | null = null;
  private version: number = 16;

  constructor(config: OdooConfig) {
    this.url = config.url.replace(/\/$/, "");
    this.database = config.database;
    this.username = config.username;
    this.password = config.password;
  }

  // ── JSON-RPC Call ──────────────────────────────────────────────────────────
  private async rpc(endpoint: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    const response = await fetch(`${this.url}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        id: Math.floor(Math.random() * 100000),
        params: { service: method.includes("/") ? method.split("/")[0] : "object", method, args, kwargs },
      }),
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.data?.message || data.error.message || "Odoo RPC Error");
    return data.result;
  }

  // ── تسجيل الدخول ──────────────────────────────────────────────────────────
  async authenticate(): Promise<number> {
    const result = await fetch(`${this.url}/web/dataset/call_kw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: 1,
        params: {
          model: "res.users",
          method: "authenticate",
          args: [this.database, this.username, this.password, {}],
          kwargs: {},
        },
      }),
    });

    if (!result.ok) throw new Error(`فشل الاتصال: ${result.status}`);
    const data = await result.json();

    // طريقة بديلة - common/authenticate
    if (!data.result || typeof data.result !== "number") {
      const auth = await fetch(`${this.url}/web/session/authenticate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", method: "call", id: 1,
          params: { db: this.database, login: this.username, password: this.password },
        }),
      });
      const authData = await auth.json();
      if (!authData.result?.uid) throw new Error("فشل تسجيل الدخول — تحقق من البيانات");
      this.uid = authData.result.uid;
      return this.uid;
    }

    this.uid = data.result;
    return this.uid;
  }

  // ── اكتشاف الإصدار ────────────────────────────────────────────────────────
  async detectVersion(): Promise<number> {
    try {
      const info = await fetch(`${this.url}/web/webclient/version_info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }),
      });
      const data = await info.json();
      const serverVersion = data.result?.server_version || "16.0";
      this.version = parseInt(serverVersion.split(".")[0]) || 16;
    } catch {
      this.version = 16;
    }
    return this.version;
  }

  // ── استدعاء نموذج Odoo ────────────────────────────────────────────────────
  private async callModel(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    if (!this.uid) throw new Error("يجب تسجيل الدخول أولاً");

    const response = await fetch(`${this.url}/web/dataset/call_kw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: Math.floor(Math.random() * 100000),
        params: {
          model, method,
          args: [[this.database, this.uid, this.password], ...args],
          kwargs,
        },
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.data?.message || "Odoo Error");
    return data.result;
  }

  // ── طريقة أبسط للقراءة ────────────────────────────────────────────────────
  private async searchRead(model: string, domain: any[], fields: string[], opts: any = {}): Promise<any[]> {
    const response = await fetch(`${this.url}/web/dataset/call_kw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", method: "call", id: Math.floor(Math.random() * 100000),
        params: {
          model,
          method: "search_read",
          args: [domain],
          kwargs: {
            fields,
            limit: opts.limit || 200,
            offset: opts.offset || 0,
            order: opts.order || "id asc",
            context: { active_test: false },
          },
        },
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.data?.message || "Search Read Error");
    return data.result || [];
  }

  // ── اكتشاف الشركات ────────────────────────────────────────────────────────
  async discoverCompanies(): Promise<Array<{ id: number; name: string; currency: string }>> {
    const companies = await this.searchRead("res.company", [[["active", "=", true]]], ["id", "name", "currency_id"]);
    return companies.map((c: any) => ({
      id: c.id,
      name: c.name,
      currency: c.currency_id?.[1]?.split(" ")[0] || "USD",
    }));
  }

  // ── سحب القيود المحاسبية ─────────────────────────────────────────────────
  async fetchJournalEntries(opts: {
    companyId?: number;
    dateFrom?: string;
    dateTo?: string;
    lastWriteDate?: string;
    postedOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: JournalEntry[]; total: number }> {
    const domain: any[] = [];

    if (opts.postedOnly !== false) domain.push(["state", "=", "posted"]);
    if (opts.dateFrom) domain.push(["date", ">=", opts.dateFrom]);
    if (opts.dateTo) domain.push(["date", "<=", opts.dateTo]);
    if (opts.lastWriteDate) domain.push(["write_date", ">", opts.lastWriteDate]);
    if (opts.companyId) {
      if (this.version >= 18) {
        domain.push(["company_ids", "in", [opts.companyId]]);
      } else {
        domain.push(["company_id", "=", opts.companyId]);
      }
    }

    const fields = ["id", "name", "ref", "journal_id", "date", "state", "amount_total", "partner_id", "narration", "line_ids"];

    const moves = await this.searchRead("account.move", domain, fields, {
      limit: opts.limit || 100,
      offset: opts.offset || 0,
      order: "date asc, id asc",
    });

    const entries: JournalEntry[] = [];

    for (const move of moves) {
      const lineIds: number[] = move.line_ids || [];
      if (lineIds.length === 0) continue;

      let lines: JournalLine[] = [];
      try {
        const lineData = await this.searchRead("account.move.line",
          [["id", "in", lineIds]],
          ["id", "account_id", "partner_id", "name", "debit", "credit", "date"]
        );

        lines = lineData.map((l: any) => ({
          odooLineId: l.id,
          accountCode: l.account_id?.[1]?.split(" ")[0] || "",
          accountName: l.account_id?.[1] || "",
          accountType: "",
          partnerName: l.partner_id ? l.partner_id[1] : null,
          label: l.name || null,
          debit: l.debit || 0,
          credit: l.credit || 0,
          date: move.date,
        }));
      } catch {
        // تجاهل أخطاء السطور
      }

      entries.push({
        odooMoveId: move.id,
        name: move.name,
        ref: move.ref || null,
        journalName: move.journal_id?.[1] || "",
        journalType: "",
        date: move.date,
        state: move.state,
        totalDebit: lines.reduce((s: number, l: JournalLine) => s + l.debit, 0),
        totalCredit: lines.reduce((s: number, l: JournalLine) => s + l.credit, 0),
        partnerName: move.partner_id ? move.partner_id[1] : null,
        narration: move.narration || null,
        lines,
      });
    }

    return { entries, total: moves.length };
  }

  // ── اختبار الاتصال ────────────────────────────────────────────────────────
  async testConnection(): Promise<{ success: boolean; version: number; companies: any[] }> {
    await this.authenticate();
    await this.detectVersion();
    const companies = await this.discoverCompanies();
    return { success: true, version: this.version, companies };
  }
}
