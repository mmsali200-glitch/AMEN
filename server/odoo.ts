// ── Odoo Account Type → CFO Classification ────────────────────────────────────
export function odooTypeToCfoType(accountType: string, code: string, name: string): string {
  const t = accountType?.toLowerCase() || "";
  if (t.includes("receivable"))       return "assets";
  if (t.includes("asset"))            return "assets";
  if (t.includes("payable"))          return "liabilities";
  if (t.includes("liability") || t.includes("credit_card")) return "liabilities";
  if (t.includes("equity"))           return "equity";
  if (t === "income")                 return "revenue";
  if (t === "income_other")           return "other_income";
  if (t === "expense_direct_cost" || t.includes("cogs")) return "cogs";
  if (t.includes("expense"))          return "expenses";
  if (t.includes("off_balance"))      return "other";
  // Fallback: classify by code prefix
  return classifyByCode(code, name);
}

function classifyByCode(code: string, name: string): string {
  const c = (code||"").trim();
  if (c.startsWith("1")) return "assets";
  if (c.startsWith("2")) return "liabilities";
  if (c.startsWith("3")) return "equity";
  if (c.startsWith("4")) return (name.includes("تكلفة")||name.toLowerCase().includes("cost")) ? "cogs" : "revenue";
  if (c.startsWith("5")) return "cogs";
  if (c.startsWith("6")) return "expenses";
  if (c.startsWith("7")) return "other_income";
  if (c.startsWith("8")) return "other_expenses";
  return "other";
}

// ── Odoo JSON-RPC Connector ────────────────────────────────────────────────────
export class OdooConnector {
  public url: string;
  public db: string;
  public username: string;
  public password: string;
  public uid: number | null = null;
  private sessionId: string | null = null;

  constructor(url: string, db: string, username: string, password: string) {
    this.url = url.replace(/\/$/, "");
    this.db = db;
    this.username = username;
    this.password = password;
  }

  private async rpc(endpoint: string, params: any): Promise<any> {
    const headers: Record<string,string> = { "Content-Type": "application/json" };
    if (this.sessionId) headers["Cookie"] = `session_id=${this.sessionId}`;
    const res = await fetch(`${this.url}${endpoint}`, {
      method: "POST", headers,
      body: JSON.stringify({ jsonrpc:"2.0", method:"call", id:Math.floor(Math.random()*99999), params }),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) { const m = setCookie.match(/session_id=([^;]+)/); if (m) this.sessionId = m[1]; }
    const data = await res.json();
    if (data.error) throw new Error(data.error?.data?.message || data.error?.message || JSON.stringify(data.error));
    return data.result;
  }

  async authenticate(): Promise<number> {
    const result = await this.rpc("/web/session/authenticate", { db:this.db, login:this.username, password:this.password });
    if (!result?.uid || result.uid === false) throw new Error("بيانات الدخول غير صحيحة");
    this.uid = result.uid;
    return this.uid!;
  }

  async getVersion(): Promise<string> {
    try { const i = await this.rpc("/web/webclient/version_info", {}); return i?.server_version?.split("-")[0] || "17"; } catch { return "17"; }
  }

  private async searchRead(model: string, domain: any[], fields: string[], limit = 1000, offset = 0): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    try {
      return await this.rpc("/web/dataset/call_kw", { model, method:"search_read", args:[domain], kwargs:{ fields, limit, offset, context:{ lang:"ar_001" } } });
    } catch {
      return await this.rpc("/web/dataset/call_kw", { model, method:"search_read", args:[domain], kwargs:{ fields, limit, offset } });
    }
  }

  // ── الشركات ────────────────────────────────────────────────────────────────
  async getCompanies(): Promise<any[]> {
    return this.searchRead("res.company", [], ["id","name","currency_id","partner_id","country_id","city","street","vat","phone","email"], 100);
  }

  // ── دليل الحسابات (Chart of Accounts) ─────────────────────────────────────
  async getChartOfAccounts(companyId: number): Promise<any[]> {
    // Odoo 17+ uses company_ids (Many2many), older uses company_id
    try {
      return await this.searchRead("account.account",
        [["company_ids","in",[companyId]]],
        ["id","code","name","account_type","internal_type","internal_group","currency_id","deprecated","reconcile"],
        5000
      );
    } catch {
      try {
        return await this.searchRead("account.account",
          [["company_id","=",companyId]],
          ["id","code","name","account_type","internal_type","internal_group","currency_id","deprecated","reconcile"],
          5000
        );
      } catch {
        // بدون فلتر شركة — يجلب كل الحسابات
        return await this.searchRead("account.account",
          [],
          ["id","code","name","account_type","currency_id","deprecated"],
          5000
        );
      }
    }
  }

  // ── الدفاتر المحاسبية ─────────────────────────────────────────────────────
  async getJournals(companyId: number): Promise<any[]> {
    try {
      return await this.searchRead("account.journal",
        [["company_id","=",companyId]],
        ["id","name","code","type","currency_id","default_account_id"],
        200
      );
    } catch {
      return await this.searchRead("account.journal",
        [],
        ["id","name","code","type"],
        200
      );
    }
  }

  // ── الشركاء (عملاء + موردون) ──────────────────────────────────────────────
  async getPartners(): Promise<any[]> {
    const fields = ["id","name","ref","email","phone","mobile","vat","street","city","country_id","customer_rank","supplier_rank","is_company"];
    try {
      return await this.searchRead("res.partner",
        ["|",["customer_rank",">",0],["supplier_rank",">",0]],
        fields, 5000
      );
    } catch {
      // fallback بدون بعض الحقول
      return await this.searchRead("res.partner",
        ["|",["customer_rank",">",0],["supplier_rank",">",0]],
        ["id","name","email","phone","customer_rank","supplier_rank"], 5000
      );
    }
  }

  // ── العملات ───────────────────────────────────────────────────────────────
  async getCurrencies(): Promise<any[]> {
    try {
      return await this.searchRead("res.currency", [["active","=",true]],
        ["id","name","symbol","rate","active"], 100);
    } catch {
      return await this.searchRead("res.currency", [["active","=",true]],
        ["id","name","symbol","active"], 100);
    }
  }

  // ── المنتجات ──────────────────────────────────────────────────────────────
  async getProducts(companyId: number): Promise<any[]> {
    return this.searchRead("product.product", [],
      ["id","name","type","categ_id","list_price","standard_price"], 3000);
  }

  // ── الضرائب ───────────────────────────────────────────────────────────────
  async getTaxes(companyId: number): Promise<any[]> {
    try {
      return await this.searchRead("account.tax",
        [["company_id","=",companyId]],
        ["id","name","type_tax_use","amount","amount_type","active"], 500);
    } catch {
      return [];
    }
  }

  // ── الحسابات التحليلية ────────────────────────────────────────────────────
  async getAnalyticAccounts(companyId: number): Promise<any[]> {
    try {
      return await this.searchRead("account.analytic.account",
        [],
        ["id","name","code"], 1000);
    } catch { return []; }
  }

  // ── إحصاء القيود ──────────────────────────────────────────────────────────
  async countEntries(companyId: number, dateFrom: string | null, dateTo: string | null): Promise<number> {
    if (!this.uid) await this.authenticate();
    const domain: any[] = [["company_id","=",companyId],["state","=","posted"]];
    if (dateFrom) domain.push(["date",">=",dateFrom]);
    if (dateTo)   domain.push(["date","<=",dateTo]);
    return this.rpc("/web/dataset/call_kw", { model:"account.move", method:"search_count", args:[domain], kwargs:{} });
  }

  // ── القيود المحاسبية ──────────────────────────────────────────────────────
  async getJournalEntries(companyId: number, dateFrom: string | null, dateTo: string | null, limit = 200, offset = 0): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    const domain: any[] = [["company_id","=",companyId],["state","=","posted"]];
    if (dateFrom) domain.push(["date",">=",dateFrom]);
    if (dateTo)   domain.push(["date","<=",dateTo]);
    return this.searchRead("account.move", domain,
      ["id","name","ref","date","state","journal_id","amount_total","partner_id","move_type","currency_id","narration","payment_state"],
      limit, offset
    );
  }

  // ── سطور القيود ───────────────────────────────────────────────────────────
  async getJournalLines(moveIds: number[]): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    if (!moveIds.length) return [];
    return this.searchRead("account.move.line",
      [["move_id","in",moveIds],["display_type","not in",["line_section","line_note"]]],
      ["id","move_id","account_id","name","debit","credit","date","partner_id",
       "journal_id","quantity","price_unit","tax_ids","analytic_distribution","ref",
       "full_reconcile_id","reconciled","amount_currency","currency_id"],
      10000
    );
  }

  // ── الرصيد الافتتاحي ──────────────────────────────────────────────────────
  async getOpeningBalanceLines(companyId: number, beforeDate: string): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    try {
      return await this.searchRead("account.move.line",
        [["company_id","=",companyId],["move_id.state","=","posted"],["date","<",beforeDate],
         ["display_type","not in",["line_section","line_note"]]],
        ["account_id","debit","credit","date"],
        100000
      );
    } catch {
      // Odoo 17+ - try without company filter in domain
      return await this.searchRead("account.move.line",
        [["move_id.state","=","posted"],["move_id.company_id","=",companyId],["date","<",beforeDate],
         ["display_type","not in",["line_section","line_note"]]],
        ["account_id","debit","credit","date"],
        100000
      );
    }
  }
}
