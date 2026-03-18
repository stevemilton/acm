import crypto from "node:crypto";

// ── Fiserv IPG EMEA Provider for ACM ────────────────────
// Ported from ClawPayTAP, adapted for Next.js API routes + Supabase

const DEBUG = process.env.LOG_LEVEL === "debug";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;

// ── Types ───────────────────────────────────────────────

interface FiservAuthenticationResponse {
  type?: string;
  version?: string;
  secure3dMethod?: {
    methodForm?: string;
    secure3dTransId?: string;
  };
  params?: {
    acsURL?: string;
    cReq?: string;
    aresStatus?: string;
    transStatus?: string;
    sessionData?: string;
    threeDSServerTransID?: string;
  };
}

interface FiservPaymentResponse {
  orderId?: string;
  ipgTransactionId?: string;
  requestStatus?: string;
  approvalCode?: string;
  transactionResult?: string;
  transactionStatus?: string;
  processor?: { responseCode?: string; responseMessage?: string };
  authenticationResponse?: FiservAuthenticationResponse;
  error?: { code?: string; message?: string };
}

export interface TokenizeResult {
  setupUrl: string;
  sessionId: string;
}

export interface TokenCompleteResult {
  tokenId: string;
  cardLast4: string;
  cardBrand: string;
}

export type AuthStatus =
  | "approved"
  | "requires_action"
  | "declined"
  | "error";

export interface AuthResult {
  transactionId: string;
  status: AuthStatus;
  declineReason?: string;
  threeDsData?: {
    type: "method" | "challenge";
    methodForm?: string;
    challengeUrl?: string;
    challengePayload?: string;
    ipgTransactionId: string;
  };
}

export interface CaptureResult {
  transactionId: string;
  status: "captured" | "error";
}

// ── Error Classes ───────────────────────────────────────

export class FiservError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number
  ) {
    super(message);
    this.name = "FiservError";
  }
}

// ── Provider ────────────────────────────────────────────

export class FiservProvider {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private storeId: string;

  constructor(config: {
    apiKey: string;
    apiSecret: string;
    baseUrl?: string;
    storeId?: string;
  }) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl =
      config.baseUrl || "https://cat.emea.api.fiservapps.com";
    this.storeId = config.storeId || "";
  }

  // ── Auth Headers ────────────────────────────────────────

  private buildAuthHeaders(body: string): Record<string, string> {
    const clientRequestId = crypto.randomUUID();
    const timestamp = Date.now().toString();

    const rawSignature =
      this.apiKey + clientRequestId + timestamp + body;
    const hmac = crypto.createHmac("sha256", this.apiSecret);
    hmac.update(rawSignature);
    const messageSignature = hmac.digest("base64");

    return {
      "Content-Type": "application/json",
      "Api-Key": this.apiKey,
      "Client-Request-Id": clientRequestId,
      Timestamp: timestamp,
      "Message-Signature": messageSignature,
    };
  }

  // ── HTTP Helper ─────────────────────────────────────────

  private async request<T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    body?: unknown,
    skipErrorMapping = false
  ): Promise<{ data: T; httpStatus: number }> {
    const bodyStr = body ? JSON.stringify(body) : "";
    const url = `${this.baseUrl}${path}`;

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const headers = this.buildAuthHeaders(bodyStr);

      if (DEBUG) {
        const maskedKey =
          this.apiKey.substring(0, 8) + "..." + this.apiKey.slice(-4);
        console.debug(
          "[fiserv] →",
          method,
          url,
          attempt > 0 ? `(retry ${attempt})` : ""
        );
        console.debug("[fiserv]   headers:", {
          ...headers,
          "Api-Key": maskedKey,
        });
        if (bodyStr) console.debug("[fiserv]   body:", bodyStr);
      }

      const start = Date.now();
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers,
          ...(bodyStr ? { body: bodyStr } : {}),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err: unknown) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          if (DEBUG)
            console.debug(
              "[fiserv] network error, retrying:",
              (err as Error).message
            );
          continue;
        }
        throw new FiservError(
          "GATEWAY_UNREACHABLE",
          `Payment gateway unreachable: ${(err as Error).message}`,
          502
        );
      }

      const text = await response.text();
      const elapsed = Date.now() - start;
      let data: T;
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text as unknown as T;
      }

      if (DEBUG) {
        console.debug(
          "[fiserv] ←",
          response.status,
          `(${elapsed}ms)`,
          text.substring(0, 500)
        );
      }

      // Retry on 5xx
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        if (DEBUG) console.debug("[fiserv] server error, retrying");
        lastError = new Error(`Server error ${response.status}`);
        continue;
      }

      // For 3DS flows, 409 WAITING is NOT an error
      if (!response.ok && !skipErrorMapping) {
        this.mapFiservError(data, response.status);
      }

      return { data, httpStatus: response.status };
    }

    throw (
      lastError ??
      new FiservError("INTERNAL_ERROR", "Payment gateway error", 502)
    );
  }

  // ── Error Mapping ───────────────────────────────────────

  private mapFiservError(response: unknown, httpStatus: number): never {
    const res = response as Record<string, unknown>;
    const error = (res?.error ?? res) as Record<string, unknown>;
    const code = String(error?.code ?? "");
    const message = String(
      error?.message ?? error?.details ?? "Payment gateway error"
    );

    if (httpStatus === 401 || httpStatus === 403) {
      throw new FiservError(
        "AUTH_FAILED",
        "Payment gateway auth failed",
        502
      );
    }

    if (httpStatus >= 500) {
      throw new FiservError(
        "GATEWAY_ERROR",
        "Payment gateway temporarily unavailable",
        502
      );
    }

    // Processor decline codes
    if (code === "51") {
      throw new FiservError(
        "INSUFFICIENT_FUNDS",
        "Insufficient funds",
        402
      );
    }

    if (
      code === "MERCHANT_REJECTED" ||
      message.toLowerCase().includes("merchant")
    ) {
      throw new FiservError("MERCHANT_REJECTED", message, 422);
    }

    if (
      httpStatus === 402 ||
      code === "DECLINED" ||
      code === "05" ||
      code === "14" ||
      code === "54" ||
      code === "57" ||
      code === "62"
    ) {
      throw new FiservError("CARD_DECLINED", message, 402);
    }

    throw new FiservError(
      "PROCESSING_FAILED",
      "Payment processing failed",
      502
    );
  }

  // ── Response Parsing ──────────────────────────────────

  private parsePaymentResponse(data: FiservPaymentResponse): AuthResult {
    const transactionId = data.orderId ?? data.ipgTransactionId ?? "";
    const ipgTxId = data.ipgTransactionId ?? "";

    // 3DS: WAITING means authentication in progress
    if (
      data.requestStatus === "WAITING" ||
      data.transactionStatus === "WAITING"
    ) {
      const authResp = data.authenticationResponse;
      const methodForm = authResp?.secure3dMethod?.methodForm;
      const aresStatus = authResp?.params?.aresStatus;

      if (methodForm) {
        return {
          transactionId,
          status: "requires_action",
          threeDsData: {
            type: "method",
            methodForm,
            ipgTransactionId: ipgTxId,
          },
        };
      }

      if (aresStatus === "C" || authResp?.params?.acsURL) {
        return {
          transactionId,
          status: "requires_action",
          threeDsData: {
            type: "challenge",
            challengeUrl: authResp?.params?.acsURL,
            challengePayload: authResp?.params?.cReq,
            ipgTransactionId: ipgTxId,
          },
        };
      }

      if (aresStatus === "N") {
        return {
          transactionId,
          status: "declined",
          declineReason: "3D Secure authentication denied by issuer",
        };
      }

      return {
        transactionId,
        status: "error",
        declineReason: "Unexpected 3D Secure state",
      };
    }

    const effectiveStatus =
      data.requestStatus || data.transactionStatus || "";
    if (
      effectiveStatus === "SUCCESS" ||
      effectiveStatus === "APPROVED"
    ) {
      return { transactionId, status: "approved" };
    }

    if (
      effectiveStatus === "DECLINED" ||
      effectiveStatus === "VALIDATION_FAILED"
    ) {
      return {
        transactionId,
        status: "declined",
        declineReason:
          data.processor?.responseMessage ??
          data.transactionResult ??
          data.error?.message ??
          "Declined",
      };
    }

    return {
      transactionId,
      status: "error",
      declineReason:
        data.error?.message ?? data.transactionResult ?? "Payment failed",
    };
  }

  // ── Public Methods ────────────────────────────────────

  async tokenizeCard(): Promise<TokenizeResult> {
    const { data } = await this.request<{
      requestStatus: string;
      redirectURL?: string;
      paymentToken?: { value: string };
      clientToken?: string;
    }>("POST", "/ipp/payments-gateway/v2/payment-tokens", {
      requestType: "PaymentCardPaymentTokenizationRequest",
      createToken: {
        reusable: true,
        declineDuplicates: false,
      },
      accountVerification: false,
      storeId: this.storeId,
    });

    return {
      setupUrl: data.redirectURL ?? "",
      sessionId: data.clientToken ?? data.paymentToken?.value ?? "",
    };
  }

  async completeTokenization(
    sessionId: string
  ): Promise<TokenCompleteResult> {
    const { data } = await this.request<{
      paymentToken?: { value: string };
      card?: {
        last4: string;
        brand: string;
        expiryDate?: { month: string; year: string };
      };
    }>(
      "GET",
      `/ipp/payments-gateway/v2/payment-tokens/${encodeURIComponent(sessionId)}`
    );

    return {
      tokenId: data.paymentToken?.value ?? "",
      cardLast4: data.card?.last4 ?? "****",
      cardBrand: (data.card?.brand ?? "unknown").toLowerCase(),
    };
  }

  async authorize(params: {
    tokenId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
    termUrl: string;
    methodNotificationUrl: string;
  }): Promise<AuthResult> {
    const requestBody: Record<string, unknown> = {
      requestType: "PaymentTokenPreAuthTransaction",
      transactionAmount: {
        total: params.amount.toFixed(2),
        currency: params.currency,
      },
      paymentMethod: {
        paymentToken: {
          value: params.tokenId,
        },
      },
      order: {
        orderId: params.idempotencyKey,
      },
      storeId: this.storeId,
      authenticationRequest: {
        authenticationType: "Secure3DAuthenticationRequest",
        termURL: params.termUrl,
        methodNotificationURL: params.methodNotificationUrl,
        challengeIndicator: "01",
      },
    };

    // Skip error mapping — 409 WAITING is expected for 3DS
    const { data } = await this.request<FiservPaymentResponse>(
      "POST",
      "/ipp/payments-gateway/v2/payments",
      requestBody,
      true
    );

    return this.parsePaymentResponse(data);
  }

  async complete3ds(params: {
    type: "method_complete" | "challenge_complete";
    transactionId: string;
    cRes?: string;
  }): Promise<AuthResult> {
    const body: Record<string, unknown> = {
      authenticationType: "Secure3DAuthenticationUpdateRequest",
    };

    if (params.type === "method_complete") {
      body.methodNotificationStatus = "RECEIVED";
    } else {
      if (!params.cRes) {
        throw new FiservError(
          "MISSING_CRES",
          "Challenge response (cRes) is required",
          400
        );
      }
      body.cRes = params.cRes;
    }

    const { data } = await this.request<FiservPaymentResponse>(
      "PATCH",
      `/ipp/payments-gateway/v2/transactions/${encodeURIComponent(params.transactionId)}`,
      body,
      true
    );

    return this.parsePaymentResponse(data);
  }

  async capture(
    orderId: string,
    amount: number,
    currency = "USD"
  ): Promise<CaptureResult> {
    const { data } = await this.request<{
      orderId?: string;
      requestStatus?: string;
      transactionStatus?: string;
    }>(
      "POST",
      `/ipp/payments-gateway/v2/orders/${encodeURIComponent(orderId)}`,
      {
        requestType: "PostAuthTransaction",
        transactionAmount: {
          total: amount.toFixed(2),
          currency,
        },
      }
    );

    const captureStatus =
      data.requestStatus || data.transactionStatus || "";
    return {
      transactionId: data.orderId ?? orderId,
      status:
        captureStatus === "SUCCESS" || captureStatus === "APPROVED"
          ? "captured"
          : "error",
    };
  }
}

// ── Singleton ───────────────────────────────────────────

let _provider: FiservProvider | null = null;

export function getFiservProvider(): FiservProvider {
  if (!_provider) {
    const apiKey = process.env.FISERV_API_KEY;
    const apiSecret = process.env.FISERV_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error(
        "FISERV_API_KEY and FISERV_API_SECRET must be set"
      );
    }

    _provider = new FiservProvider({
      apiKey,
      apiSecret,
      baseUrl: process.env.FISERV_BASE_URL,
      storeId: process.env.FISERV_STORE_ID,
    });
  }
  return _provider;
}
