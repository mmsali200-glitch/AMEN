// Odoo JSON-RPC Connector
export class OdooConnector {
  private url: string;
  private db: string;
  private username: string;
  private password: string;
  private uid: number | null = null;

  constructor(url: string, db: string, username: string, password: string) {
    this.url = url.replace(/\/$/, "");
    this.db = db;
    this.username = username;
    this.password = password;
  }

  private async rpc(endpoint: string, params: any): Promise<any> {
    const res = await fetch(`${this.url}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.data?.message || data.error.message || "Odoo RPC Error");
    return data.result;
  }

  async authenticate(): Promise<number> {
    const result = await this.rpc("/web/session/authenticate", {
      db: this.db, login: this.username, password: this.password,
    });
    if (!result?.uid) throw new Error("فشل تسجيل الدخول إلى Odoo");
    this.uid = result.uid;
    return this.uid;
  }

  async searchRead(model: string, domain: any[], fields: string[], limit = 1000, offset = 0): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    return this.rpc("/web/dataset/call_kw", {
      model, method: "search_read",
      args: [domain],
      kwargs: { fields, limit, offset, context: { lang: "ar_001" } },
    });
  }

  async getVersion(): Promise<string> {
    try {
      const info = await this.rpc("/web/webclient/version_info", {});
      return info?.server_version || "17";
    } catch { return "17"; }
  }

  async getCompanies(): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    return this.searchRead("res.company", [], ["id", "name", "currency_id"], 100);
  }

  async getJournalEntries(companyId: number | null, dateFrom: string, dateTo: string, limit = 500, offset = 0): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    const domain: any[] = [
      ["state", "=", "posted"],
      ["date", ">=", dateFrom],
      ["date", "<=", dateTo],
    ];
    if (companyId) domain.push(["company_id", "=", companyId]);
    return this.searchRead("account.move", domain,
      ["name", "ref", "date", "state", "journal_id", "amount_total", "partner_id", "narration", "move_type"],
      limit, offset
    );
  }

  async getJournalLines(moveIds: number[]): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    if (!moveIds.length) return [];
    return this.searchRead("account.move.line", [["move_id", "in", moveIds]],
      ["move_id", "account_id", "name", "debit", "credit", "date", "partner_id", "analytic_distribution"],
      5000
    );
  }

  async getAccounts(): Promise<any[]> {
    return this.searchRead("account.account", [], ["code", "name", "account_type"], 2000);
  }

  async getPartners(): Promise<any[]> {
    return this.searchRead("res.partner",
      ["|", ["customer_rank", ">", 0], ["supplier_rank", ">", 0]],
      ["id", "name", "customer_rank", "supplier_rank", "email", "phone"], 2000
    );
  }

  async countEntries(companyId: number | null, dateFrom: string, dateTo: string): Promise<number> {
    if (!this.uid) await this.authenticate();
    const domain: any[] = [["state","=","posted"],["date",">=",dateFrom],["date","<=",dateTo]];
    if (companyId) domain.push(["company_id","=",companyId]);
    return this.rpc("/web/dataset/call_kw", {
      model:"account.move", method:"search_count", args:[domain], kwargs:{}
    });
  }
}
