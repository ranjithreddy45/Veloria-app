/**
 * Cloud Telephony Provider Abstraction
 * Supports: Exotel, Knowlarity, MyOperator
 */

// ============================================================
// Types
// ============================================================

export interface TelephonyWebhookEvent {
  externalCallId: string;
  status: "ringing" | "in-progress" | "completed" | "failed" | "no-answer" | "busy";
  durationSeconds?: number;
  recordingUrl?: string;
  from?: string;
  to?: string;
}

export interface InitiateCallResult {
  externalCallId: string;
  success: boolean;
  message?: string;
}

interface TelephonyAdapter {
  initiateCall(from: string, to: string, callerId: string): Promise<InitiateCallResult>;
  parseWebhook(body: unknown, headers?: Record<string, string>): TelephonyWebhookEvent | null;
}

interface TelephonyConfig {
  provider: string;
  apiKey: string;
  apiSecret?: string | null;
  accountSid?: string | null;
  subdomain?: string | null;
  callerId: string;
}

// ============================================================
// Exotel Adapter
// ============================================================

class ExotelAdapter implements TelephonyAdapter {
  constructor(
    private apiKey: string,
    private apiToken: string,
    private accountSid: string,
    private subdomain: string
  ) {}

  async initiateCall(from: string, to: string, callerId: string): Promise<InitiateCallResult> {
    try {
      const url = `https://${this.subdomain}/v1/Accounts/${this.accountSid}/Calls/connect.json`;
      const auth = Buffer.from(`${this.apiKey}:${this.apiToken}`).toString("base64");

      const body = new URLSearchParams({
        From: from,
        To: to,
        CallerId: callerId,
        CallType: "trans",
        StatusCallback: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com"}/api/webhooks/telephony?provider=exotel`,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const data = await response.json();

      if (response.ok && data?.Call?.Sid) {
        return { externalCallId: data.Call.Sid, success: true };
      }

      return {
        externalCallId: "",
        success: false,
        message: data?.RestException?.Message || "Failed to initiate call via Exotel",
      };
    } catch (error) {
      console.error("[Exotel] initiateCall error:", error);
      return { externalCallId: "", success: false, message: "Exotel API error" };
    }
  }

  parseWebhook(body: unknown): TelephonyWebhookEvent | null {
    try {
      const data = body as Record<string, unknown>;
      const callSid = (data.CallSid || data.Sid) as string;
      if (!callSid) return null;

      const statusMap: Record<string, TelephonyWebhookEvent["status"]> = {
        ringing: "ringing",
        "in-progress": "in-progress",
        completed: "completed",
        failed: "failed",
        "no-answer": "no-answer",
        busy: "busy",
      };

      const rawStatus = String(data.Status || data.CallStatus || "").toLowerCase();

      return {
        externalCallId: callSid,
        status: statusMap[rawStatus] || "completed",
        durationSeconds: data.Duration ? Number(data.Duration) : undefined,
        recordingUrl: (data.RecordingUrl || data.RecordingFile) as string | undefined,
        from: data.From as string | undefined,
        to: data.To as string | undefined,
      };
    } catch {
      return null;
    }
  }
}

// ============================================================
// Knowlarity Adapter
// ============================================================

class KnowlarityAdapter implements TelephonyAdapter {
  constructor(
    private apiKey: string,
    private srNumber: string
  ) {}

  async initiateCall(from: string, to: string, _callerId: string): Promise<InitiateCallResult> {
    try {
      const url = "https://kpi.knowlarity.com/Basic/v1/account/call/makecall";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          k_number: this.srNumber,
          agent_number: from,
          customer_number: to,
        }),
      });

      const data = await response.json();

      if (response.ok && data?.success?.call_id) {
        return { externalCallId: data.success.call_id, success: true };
      }

      return {
        externalCallId: "",
        success: false,
        message: data?.error?.message || "Failed to initiate call via Knowlarity",
      };
    } catch (error) {
      console.error("[Knowlarity] initiateCall error:", error);
      return { externalCallId: "", success: false, message: "Knowlarity API error" };
    }
  }

  parseWebhook(body: unknown): TelephonyWebhookEvent | null {
    try {
      const data = body as Record<string, unknown>;
      const callId = (data.call_id || data.uuid) as string;
      if (!callId) return null;

      const statusMap: Record<string, TelephonyWebhookEvent["status"]> = {
        answered: "completed",
        noanswer: "no-answer",
        busy: "busy",
        failed: "failed",
        ringing: "ringing",
      };

      const rawStatus = String(data.status || data.call_status || "").toLowerCase();

      return {
        externalCallId: callId,
        status: statusMap[rawStatus] || "completed",
        durationSeconds: data.duration ? Number(data.duration) : undefined,
        recordingUrl: data.recording_url as string | undefined,
        from: data.agent_number as string | undefined,
        to: data.customer_number as string | undefined,
      };
    } catch {
      return null;
    }
  }
}

// ============================================================
// MyOperator Adapter
// ============================================================

class MyOperatorAdapter implements TelephonyAdapter {
  constructor(
    private apiKey: string,
    private companyId: string
  ) {}

  async initiateCall(from: string, to: string, _callerId: string): Promise<InitiateCallResult> {
    try {
      const url = "https://api.myoperator.com/v1/call";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-Company-Id": this.companyId,
        },
        body: JSON.stringify({
          from,
          to,
          type: "outbound",
        }),
      });

      const data = await response.json();

      if (response.ok && data?.call_id) {
        return { externalCallId: data.call_id, success: true };
      }

      return {
        externalCallId: "",
        success: false,
        message: data?.message || "Failed to initiate call via MyOperator",
      };
    } catch (error) {
      console.error("[MyOperator] initiateCall error:", error);
      return { externalCallId: "", success: false, message: "MyOperator API error" };
    }
  }

  parseWebhook(body: unknown): TelephonyWebhookEvent | null {
    try {
      const data = body as Record<string, unknown>;
      const callId = (data.call_id || data.id) as string;
      if (!callId) return null;

      const statusMap: Record<string, TelephonyWebhookEvent["status"]> = {
        answered: "completed",
        completed: "completed",
        unanswered: "no-answer",
        busy: "busy",
        failed: "failed",
      };

      const rawStatus = String(data.status || "").toLowerCase();

      return {
        externalCallId: callId,
        status: statusMap[rawStatus] || "completed",
        durationSeconds: data.duration ? Number(data.duration) : undefined,
        recordingUrl: data.recording_url as string | undefined,
        from: data.from as string | undefined,
        to: data.to as string | undefined,
      };
    } catch {
      return null;
    }
  }
}

// ============================================================
// Factory
// ============================================================

export function getTelephonyAdapter(config: TelephonyConfig): TelephonyAdapter {
  switch (config.provider) {
    case "EXOTEL":
      return new ExotelAdapter(
        config.apiKey,
        config.apiSecret || "",
        config.accountSid || "",
        config.subdomain || "api.exotel.com"
      );
    case "KNOWLARITY":
      return new KnowlarityAdapter(config.apiKey, config.callerId);
    case "MYOPERATOR":
      return new MyOperatorAdapter(config.apiKey, config.accountSid || "");
    default:
      throw new Error(`Unsupported telephony provider: ${config.provider}`);
  }
}

/**
 * Map telephony call status to CallDisposition
 */
export function mapStatusToDisposition(status: TelephonyWebhookEvent["status"]): string {
  const map: Record<string, string> = {
    completed: "COMPLETED",
    failed: "NO_ANSWER",
    "no-answer": "NO_ANSWER",
    busy: "BUSY",
    ringing: "COMPLETED",
    "in-progress": "COMPLETED",
  };
  return map[status] || "COMPLETED";
}
