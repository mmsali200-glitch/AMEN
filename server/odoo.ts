export class OdooConnector {
  private url: string;
  private db: string;
  private username: string;
  private password: string;
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
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc:"2.0", method:"call", id:Math.floor(Math.random()*99999), params }),
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/session_id=([^;]+)/);
      if (match) this.sessionId = match[1];
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error?.data?.message || data.error?.message || JSON.stringify(data.error));
    return data.result;
  }

  async authenticate(): Promise<number> {
    const result = await this.rpc("/web/session/authenticate", {
      db: this.db, login: this.username, password: this.password,
    });
    if (!result?.uid || result.uid === false) {
      throw new Error("بيانات الدخول غير صحيحة — تأكد من اسم المستخدم وكلمة المرور");
    }
    this.uid = result.uid;
    return this.uid!;
  }

  async getVersion(): Promise<string> {
    try {
      const info = await this.rpc("/web/webclient/version_info", {});
      return info?.server_version?.split("-")[0] || "17";
    } catch { return "unknown"; }
  }

  // ── الشركات المتاحة في Odoo ──────────────────────────────────────────────
  async getCompanies(): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    return this.searchRead("res.company", [],
      ["id","name","currency_id","partner_id","country_id","city","street","vat"],
      100
    );
  }

  // ── دليل الحسابات لشركة معينة ─────────────────────────────────────────────
  async getChartOfAccounts(companyId: number): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    return this.searchRead("account.account",
      [["company_id","=",companyId]],
      ["code","name","account_type","deprecated"],
      2000
    );
  }

  // ── الشركاء (العملاء والموردون) ───────────────────────────────────────────
  async getPartners(companyId: number): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    return this.searchRead("res.partner",
      ["|",["customer_rank",">",0],["supplier_rank",">",0]],
      ["id","name","customer_rank","supplier_rank","email","phone","vat","country_id","city"],
      3000
    );
  }

  // ── إحصاء القيود ──────────────────────────────────────────────────────────
  async countEntries(companyId: number, dateFrom: string | null, dateTo: string | null): Promise<number> {
    if (!this.uid) await this.authenticate();
    const domain: any[] = [["company_id","=",companyId],["state","=","posted"]];
    if (dateFrom) domain.push(["date",">=",dateFrom]);
    if (dateTo) domain.push(["date","<=",dateTo]);
    return this.rpc("/web/dataset/call_kw", {
      model:"account.move", method:"search_count", args:[domain], kwargs:{}
    });
  }

  // ── جلب القيود ────────────────────────────────────────────────────────────
  async getJournalEntries(companyId: number, dateFrom: string | null, dateTo: string | null, limit = 200, offset = 0): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    const domain: any[] = [["company_id","=",companyId],["state","=","posted"]];
    if (dateFrom) domain.push(["date",">=",dateFrom]);
    if (dateTo) domain.push(["date","<=",dateTo]);
    return this.searchRead("account.move", domain,
      ["name","ref","date","state","journal_id","amount_total","partner_id","move_type","currency_id"],
      limit, offset
    );
  }

  // ── سطور القيود ───────────────────────────────────────────────────────────
  async getJournalLines(moveIds: number[]): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    if (!moveIds.length) return [];
    return this.searchRead("account.move.line",
      [["move_id","in",moveIds],["display_type","in",["product","other"]]],
      ["move_id","account_id","name","debit","credit","date","partner_id"],
      5000
    );
  }

  // ── كل السطور لحساب الرصيد الافتتاحي (ما قبل الفترة) ─────────────────────
  async getOpeningBalanceLines(companyId: number, beforeDate: string): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    const domain: any[] = [
      ["company_id","=",companyId],
      ["move_id.state","=","posted"],
      ["date","<",beforeDate],
      ["display_type","in",["product","other"]],
    ];
    return this.searchRead("account.move.line", domain,
      ["account_id","debit","credit","date"],
      50000
    );
  }

  private async searchRead(model: string, domain: any[], fields: string[], limit = 500, offset = 0): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    try {
      return await this.rpc("/web/dataset/call_kw", {
        model, method:"search_read",
        args:[domain],
        kwargs:{ fields, limit, offset, context:{ lang:"ar_001" } },
      });
    } catch {
      return await this.rpc("/web/dataset/call_kw", {
        model, method:"search_read",
        args:[domain],
        kwargs:{ fields, limit, offset },
      });
    }
  }
}
