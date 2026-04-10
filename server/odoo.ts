export class OdooConnector {
  private url: string;
  private db: string;
  private username: string;
  private password: string;
  private uid: number | null = null;
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
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: Math.floor(Math.random()*10000), params }),
    });

    // Extract session cookie if present
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/session_id=([^;]+)/);
      if (match) this.sessionId = match[1];
    }

    const data = await res.json();
    if (data.error) {
      const msg = data.error?.data?.message || data.error?.message || JSON.stringify(data.error);
      throw new Error(msg);
    }
    return data.result;
  }

  async authenticate(): Promise<number> {
    // Method 1: web/session/authenticate
    try {
      const result = await this.rpc("/web/session/authenticate", {
        db: this.db,
        login: this.username,
        password: this.password,
      });

      if (result?.uid && result.uid !== false) {
        this.uid = result.uid;
        return this.uid!;
      }

      // uid = false means wrong credentials
      if (result?.uid === false) {
        throw new Error("بيانات الدخول غير صحيحة — تأكد من اسم المستخدم وكلمة المرور");
      }
    } catch (e: any) {
      if (e.message.includes("بيانات الدخول") || e.message.includes("Access Denied")) {
        throw e;
      }
      // Try method 2 if first failed with network error
    }

    // Method 2: xmlrpc/2/common
    try {
      const res = await fetch(`${this.url}/xmlrpc/2/common`, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: `<?xml version="1.0"?><methodCall><methodName>authenticate</methodName><params><param><value>${this.db}</value></param><param><value>${this.username}</value></param><param><value>${this.password}</value></param><param><value><struct></struct></value></param></params></methodCall>`,
      });
      const text = await res.text();
      const match = text.match(/<int>(\d+)<\/int>/);
      if (match && parseInt(match[1]) > 0) {
        this.uid = parseInt(match[1]);
        return this.uid;
      }
      throw new Error("فشل التحقق من الهوية عبر xmlrpc");
    } catch (e2: any) {
      throw new Error(`فشل الاتصال بـ Odoo: ${e2.message}`);
    }
  }

  async callKW(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    if (!this.uid) await this.authenticate();
    return this.rpc("/web/dataset/call_kw", {
      model,
      method,
      args,
      kwargs: { uid: this.uid, ...kwargs },
    });
  }

  async searchRead(model: string, domain: any[], fields: string[], limit = 500, offset = 0): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    try {
      return await this.rpc("/web/dataset/call_kw", {
        model,
        method: "search_read",
        args: [domain],
        kwargs: { fields, limit, offset, context: { lang: "ar_001", uid: this.uid } },
      });
    } catch {
      // Fallback without lang
      return await this.rpc("/web/dataset/call_kw", {
        model,
        method: "search_read",
        args: [domain],
        kwargs: { fields, limit, offset },
      });
    }
  }

  async getVersion(): Promise<string> {
    try {
      const info = await this.rpc("/web/webclient/version_info", {});
      return info?.server_version?.split("-")[0] || "17";
    } catch {
      try {
        const res = await fetch(`${this.url}/web/webclient/version_info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc:"2.0", method:"call", params:{} }),
        });
        const d = await res.json();
        return d?.result?.server_version?.split("-")[0] || "17";
      } catch {
        return "17";
      }
    }
  }

  async getCompanies(): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    return this.searchRead("res.company", [], ["id", "name", "currency_id"], 100);
  }

  async countEntries(companyId: number | null, dateFrom: string, dateTo: string): Promise<number> {
    if (!this.uid) await this.authenticate();
    const domain: any[] = [["state","=","posted"],["date",">=",dateFrom],["date","<=",dateTo]];
    if (companyId) domain.push(["company_id","=",companyId]);
    try {
      return await this.rpc("/web/dataset/call_kw", {
        model:"account.move", method:"search_count", args:[domain], kwargs:{}
      });
    } catch { return 0; }
  }

  async getJournalEntries(companyId: number | null, dateFrom: string, dateTo: string, limit = 200, offset = 0): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    const domain: any[] = [["state","=","posted"],["date",">=",dateFrom],["date","<=",dateTo]];
    if (companyId) domain.push(["company_id","=",companyId]);
    return this.searchRead("account.move", domain,
      ["name","ref","date","state","journal_id","amount_total","partner_id","move_type"],
      limit, offset
    );
  }

  async getJournalLines(moveIds: number[]): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    if (!moveIds.length) return [];
    return this.searchRead("account.move.line",
      [["move_id","in",moveIds],["display_type","in",["product","other","payment_term"]]],
      ["move_id","account_id","name","debit","credit","date","partner_id","balance"],
      5000
    );
  }
}
