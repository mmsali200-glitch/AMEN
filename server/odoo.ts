// ══════════════════════════════════════════════════════════════════════════════
// Odoo Universal Connector — يدعم الإصدارات 16, 17, 18, 19
// ══════════════════════════════════════════════════════════════════════════════

// ── تصنيف نوع الحساب → تصنيف CFO ────────────────────────────────────────────
export function odooTypeToCfoType(accountType: string, code: string, name: string): string {
  const t = (accountType || "").toLowerCase().trim();

  // تصنيف Odoo الأصلي (الأدق)
  if (t === "asset_receivable")       return "assets";
  if (t === "asset_cash")             return "assets";
  if (t === "asset_current")          return "assets";
  if (t === "asset_non_current")      return "assets";
  if (t === "asset_prepayments")      return "assets";
  if (t === "asset_fixed")            return "assets";
  if (t === "liability_payable")      return "liabilities";
  if (t === "liability_credit_card")  return "liabilities";
  if (t === "liability_current")      return "liabilities";
  if (t === "liability_non_current")  return "liabilities";
  if (t === "equity")                 return "equity";
  if (t === "equity_unaffected")      return "equity";
  if (t === "income")                 return "revenue";
  if (t === "income_other")           return "other_income";
  if (t === "expense_direct_cost")    return "cogs";
  if (t === "expense_depreciation")   return "expenses";
  if (t === "expense")                return "expenses";
  if (t === "off_balance")            return "other";

  // Odoo 16 internal_type / internal_group
  if (t === "receivable")  return "assets";
  if (t === "payable")     return "liabilities";
  if (t === "liquidity")   return "assets";
  if (t === "other")       return classifyByCode(code, name);

  // تصنيف بالكود كـ fallback
  return classifyByCode(code, name);
}

function classifyByCode(code: string, name: string): string {
  const c = (code || "").trim();
  const n = (name || "").toLowerCase();
  if (c.startsWith("1")) return "assets";
  if (c.startsWith("2")) return "liabilities";
  if (c.startsWith("3")) return "equity";
  if (c.startsWith("4")) return (n.includes("تكلفة") || n.includes("cost") || n.includes("cogs")) ? "cogs" : "revenue";
  if (c.startsWith("5")) return "cogs";
  if (c.startsWith("6")) return "expenses";
  if (c.startsWith("7")) return "other_income";
  if (c.startsWith("8")) return "other_expenses";
  return "other";
}

// ── Odoo Version Info ─────────────────────────────────────────────────────────
interface OdooVersionInfo {
  major: number;       // 16, 17, 18, 19
  full: string;        // "17.0", "18.0-20240101"
  usesCompanyIds: boolean;   // true for 17+
  hasAccountType: boolean;   // true for 16+
  hasInternalType: boolean;  // true for 15-16
}

// ── JSON-RPC Helper ───────────────────────────────────────────────────────────
async function rpcCall(url: string, endpoint: string, params: any, sessionId?: string): Promise<any> {
  const headers: Record<string,string> = { "Content-Type": "application/json" };
  if (sessionId) headers["Cookie"] = `session_id=${sessionId}`;

  const res = await fetch(`${url}${endpoint}`, {
    method: "POST", headers,
    body: JSON.stringify({ jsonrpc:"2.0", method:"call", id: Date.now(), params }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error?.data?.message || data.error?.message || JSON.stringify(data.error));

  const sc = res.headers.get("set-cookie");
  const sid = sc?.match(/session_id=([^;]+)/)?.[1];
  return { result: data.result, sessionId: sid };
}

// ══════════════════════════════════════════════════════════════════════════════
export class OdooConnector {
  public url: string;
  public db: string;
  public username: string;
  public password: string;
  public uid: number | null = null;
  private sessionId: string | null = null;
  public version: OdooVersionInfo = { major:16, full:"16", usesCompanyIds:false, hasAccountType:true, hasInternalType:true };

  constructor(url: string, db: string, username: string, password: string) {
    this.url = url.replace(/\/$/, "");
    this.db = db;
    this.username = username;
    this.password = password;
  }

  // ── المصادقة ─────────────────────────────────────────────────────────────
  async authenticate(): Promise<number> {
    const { result, sessionId } = await rpcCall(this.url, "/web/session/authenticate", {
      db: this.db, login: this.username, password: this.password,
    });
    if (!result?.uid || result.uid === false)
      throw new Error("بيانات الدخول غير صحيحة — تحقق من اسم المستخدم وكلمة المرور");
    this.uid = result.uid;
    if (sessionId) this.sessionId = sessionId;
    await this.detectVersion();
    return this.uid!;
  }

  // ── اكتشاف الإصدار ────────────────────────────────────────────────────────
  async detectVersion(): Promise<void> {
    try {
      const { result } = await rpcCall(this.url, "/web/webclient/version_info", {}, this.sessionId || undefined);
      const full = result?.server_version || "16.0";
      const major = parseInt(full.split(".")[0]) || 16;
      this.version = {
        major,
        full,
        usesCompanyIds: major >= 17,
        hasAccountType: major >= 16,
        hasInternalType: major <= 16,
      };
    } catch {
      this.version = { major:16, full:"16.0", usesCompanyIds:false, hasAccountType:true, hasInternalType:true };
    }
  }

  // ── searchRead الأساسي ────────────────────────────────────────────────────
  private async searchRead(model: string, domain: any[], fields: string[], limit = 1000, offset = 0): Promise<any[]> {
    if (!this.uid) await this.authenticate();
    try {
      const { result } = await rpcCall(this.url, "/web/dataset/call_kw", {
        model, method: "search_read",
        args: [domain],
        kwargs: { fields, limit, offset, context: { lang: "ar_001", allowed_company_ids: [] } },
      }, this.sessionId || undefined);
      return Array.isArray(result) ? result : [];
    } catch {
      const { result } = await rpcCall(this.url, "/web/dataset/call_kw", {
        model, method: "search_read",
        args: [domain],
        kwargs: { fields, limit, offset },
      }, this.sessionId || undefined);
      return Array.isArray(result) ? result : [];
    }
  }

  // ── searchCount ────────────────────────────────────────────────────────────
  private async searchCount(model: string, domain: any[]): Promise<number> {
    if (!this.uid) await this.authenticate();
    const { result } = await rpcCall(this.url, "/web/dataset/call_kw", {
      model, method: "search_count", args: [domain], kwargs: {},
    }, this.sessionId || undefined);
    return Number(result) || 0;
  }

  // ── بناء domain الشركة حسب الإصدار ──────────────────────────────────────
  private companyDomain(companyId: number, model = ""): any[] {
    // نماذج تستخدم company_ids في 17+
    const multiModels = ["account.account"];
    if (this.version.usesCompanyIds && multiModels.includes(model)) {
      return [["company_ids", "in", [companyId]]];
    }
    return [["company_id", "=", companyId]];
  }

  // ── الشركات المتاحة ────────────────────────────────────────────────────────
  async getCompanies(): Promise<any[]> {
    return this.searchRead("res.company", [],
      ["id","name","currency_id","city","street","vat","phone","email"], 200);
  }

  // ── دليل الحسابات (يدعم كل الإصدارات) ─────────────────────────────────────
  async getChartOfAccounts(companyId: number): Promise<any[]> {
    // حقول مشتركة في كل الإصدارات
    const baseFields = ["id","code","name","deprecated"];
    // حقول حسب الإصدار
    const fields16 = [...baseFields, "user_type_id", "internal_type", "internal_group", "currency_id", "reconcile"];
    const fields17 = [...baseFields, "account_type", "currency_id", "reconcile"];

    const domain = this.companyDomain(companyId, "account.account");

    // نجرب 17+ أولاً
    try {
      const rows = await this.searchRead("account.account", domain, fields17, 5000);
      if (rows.length > 0 && rows[0].account_type !== undefined) return rows;
    } catch {}

    // نجرب 16 (user_type_id)
    try {
      const rows = await this.searchRead("account.account", domain, fields16, 5000);
      // نحوّل user_type_id إلى account_type
      return rows.map((r:any) => ({
        ...r,
        account_type: this.convertUserTypeToAccountType(r.user_type_id, r.internal_type, r.internal_group),
      }));
    } catch {}

    // الحل الأخير — بدون فلتر شركة
    try {
      const rows = await this.searchRead("account.account", [], fields17, 5000);
      return rows;
    } catch {
      return [];
    }
  }

  // تحويل user_type_id (Odoo 16) إلى account_type (Odoo 17+)
  private convertUserTypeToAccountType(userType: any, internalType?: string, internalGroup?: string): string {
    const name = (Array.isArray(userType) ? userType[1] : userType || "").toLowerCase();
    if (name.includes("receivable"))        return "asset_receivable";
    if (name.includes("bank") || name.includes("cash")) return "asset_cash";
    if (name.includes("current asset"))     return "asset_current";
    if (name.includes("fixed") || name.includes("non-current asset")) return "asset_non_current";
    if (name.includes("prepay"))            return "asset_prepayments";
    if (name.includes("payable"))           return "liability_payable";
    if (name.includes("credit card"))       return "liability_credit_card";
    if (name.includes("current liability")) return "liability_current";
    if (name.includes("non-current liability")) return "liability_non_current";
    if (name.includes("equity") && name.includes("unaffect")) return "equity_unaffected";
    if (name.includes("equity"))            return "equity";
    if (name.includes("income") && name.includes("other")) return "income_other";
    if (name.includes("income") || name.includes("revenue")) return "income";
    if (name.includes("cost") || name.includes("direct")) return "expense_direct_cost";
    if (name.includes("depreciation"))      return "expense_depreciation";
    if (name.includes("expense"))           return "expense";
    if (internalType === "receivable")      return "asset_receivable";
    if (internalType === "payable")         return "liability_payable";
    if (internalType === "liquidity")       return "asset_cash";
    return "expense";
  }

  // ── الدفاتر المحاسبية ─────────────────────────────────────────────────────
  async getJournals(companyId: number): Promise<any[]> {
    try {
      return await this.searchRead("account.journal",
        this.companyDomain(companyId),
        ["id","name","code","type","currency_id","default_account_id"], 200);
    } catch {
      try {
        return await this.searchRead("account.journal", [],
          ["id","name","code","type"], 200);
      } catch { return []; }
    }
  }

  // ── الشركاء (عملاء + موردون) ──────────────────────────────────────────────
  async getPartners(): Promise<any[]> {
    const fullFields = ["id","name","ref","email","phone","mobile","vat","street","city","country_id","customer_rank","supplier_rank","is_company"];
    const minFields  = ["id","name","email","phone","customer_rank","supplier_rank"];
    const domain = ["|",["customer_rank",">",0],["supplier_rank",">",0]];
    try {
      return await this.searchRead("res.partner", domain, fullFields, 5000);
    } catch {
      try {
        return await this.searchRead("res.partner", domain, minFields, 5000);
      } catch { return []; }
    }
  }

  // ── العملات ───────────────────────────────────────────────────────────────
  async getCurrencies(): Promise<any[]> {
    try {
      return await this.searchRead("res.currency", [["active","=",true]], ["id","name","symbol","rate","active"], 100);
    } catch {
      try {
        return await this.searchRead("res.currency", [["active","=",true]], ["id","name","symbol"], 100);
      } catch { return []; }
    }
  }

  // ── إحصاء القيود ──────────────────────────────────────────────────────────
  async countEntries(companyId: number, dateFrom: string | null, dateTo: string | null): Promise<number> {
    const domain: any[] = [...this.companyDomain(companyId), ["state","=","posted"]];
    if (dateFrom) domain.push(["date",">=",dateFrom]);
    if (dateTo)   domain.push(["date","<=",dateTo]);
    return this.searchCount("account.move", domain);
  }

  // ── القيود المحاسبية ──────────────────────────────────────────────────────
  async getJournalEntries(companyId: number, dateFrom: string | null, dateTo: string | null, limit = 200, offset = 0): Promise<any[]> {
    const domain: any[] = [...this.companyDomain(companyId), ["state","=","posted"]];
    if (dateFrom) domain.push(["date",">=",dateFrom]);
    if (dateTo)   domain.push(["date","<=",dateTo]);
    const fields = ["id","name","ref","date","state","journal_id","amount_total","partner_id","move_type","currency_id","narration"];
    return this.searchRead("account.move", domain, fields, limit, offset);
  }

  // ── سطور القيود ───────────────────────────────────────────────────────────
  async getJournalLines(moveIds: number[]): Promise<any[]> {
    if (!moveIds.length) return [];
    const domain = [["move_id","in",moveIds],["display_type","not in",["line_section","line_note"]]];
    const fields  = ["id","move_id","account_id","name","debit","credit","date","partner_id","ref"];

    try {
      return await this.searchRead("account.move.line", domain, fields, 10000);
    } catch {
      // بعض الإصدارات: display_type قد يكون مختلفاً
      const domain2 = [["move_id","in",moveIds],["exclude_from_invoice_tab","=",false]];
      try {
        return await this.searchRead("account.move.line", domain2, fields, 10000);
      } catch {
        return await this.searchRead("account.move.line", [["move_id","in",moveIds]], fields, 10000);
      }
    }
  }

  // ── الرصيد الافتتاحي (قبل الفترة) ────────────────────────────────────────
  async getOpeningBalanceLines(companyId: number, beforeDate: string): Promise<any[]> {
    const fields = ["account_id","debit","credit","date"];

    // ترتيب المحاولات حسب الإصدار
    const domains = [
      // Odoo 17+ (company_id على move)
      [["move_id.company_id","=",companyId],["move_id.state","=","posted"],["date","<",beforeDate],["display_type","not in",["line_section","line_note"]]],
      // Odoo 16 (company_id مباشرة)
      [["company_id","=",companyId],["move_id.state","=","posted"],["date","<",beforeDate],["display_type","not in",["line_section","line_note"]]],
      // fallback بدون display_type
      [["company_id","=",companyId],["move_id.state","=","posted"],["date","<",beforeDate]],
      // آخر محاولة — فلتر بالشركة فقط
      [["move_id.company_id","=",companyId],["move_id.state","=","posted"],["date","<",beforeDate]],
    ];

    for (const domain of domains) {
      try {
        const result = await this.searchRead("account.move.line", domain, fields, 100000);
        if (result.length >= 0) return result; // حتى لو صفر نتائج، الدومين نجح
      } catch { continue; }
    }
    return [];
  }

  // ── إصدار Odoo ────────────────────────────────────────────────────────────
  getVersionString(): string {
    return this.version.full || "unknown";
  }
}
