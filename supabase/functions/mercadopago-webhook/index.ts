import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMercadoPagoSignature } from "../_shared/mercadopago-signature.ts";

function json(body: unknown, status: number) {
  return Response.json(body, { status });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paymentToken = Deno.env.get("MP_ACCESS_TOKEN");
  const webhookSecret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !paymentToken || !webhookSecret) {
    console.error(
      "Secrets necessários para validar o webhook não estão configurados.",
    );
    return json({ error: "Webhook não configurado." }, 503);
  }

  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const requestId = request.headers.get("x-request-id");
  const signatureHeader = request.headers.get("x-signature");
  if (
    !dataId || !/^\d{1,30}$/.test(dataId) || !requestId ||
    requestId.length > 200 || !signatureHeader
  ) {
    return json({ error: "Notificação inválida." }, 400);
  }
  try {
    if (
      !await verifyMercadoPagoSignature(
        webhookSecret,
        signatureHeader,
        requestId,
        dataId,
      )
    ) {
      return json({ error: "Assinatura da notificação inválida." }, 401);
    }

    let notification: unknown;
    try {
      notification = await request.json();
    } catch {
      return json({ error: "Corpo da notificação inválido." }, 400);
    }
    if (
      typeof notification !== "object" || notification === null ||
      !("type" in notification) || notification.type !== "payment" ||
      !("data" in notification) || typeof notification.data !== "object" ||
      notification.data === null || !("id" in notification.data) ||
      String(notification.data.id) !== dataId
    ) {
      return json({ received: true }, 200);
    }

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,
      {
        headers: { Authorization: `Bearer ${paymentToken}` },
      },
    );
    if (!paymentResponse.ok) {
      console.error(
        "Não foi possível consultar o pagamento no Mercado Pago.",
        paymentResponse.status,
      );
      return json({ error: "Não foi possível validar o pagamento." }, 502);
    }
    const payment: unknown = await paymentResponse.json();
    if (
      typeof payment !== "object" || payment === null ||
      !("external_reference" in payment) ||
      typeof payment.external_reference !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        payment.external_reference,
      ) ||
      !("status" in payment) || typeof payment.status !== "string" ||
      !("transaction_amount" in payment) ||
      typeof payment.transaction_amount !== "number" ||
      !("currency_id" in payment) || typeof payment.currency_id !== "string" ||
      !("id" in payment) || String(payment.id) !== dataId ||
      !("preference_id" in payment) || typeof payment.preference_id !== "string"
    ) {
      return json({ error: "Resposta do provedor inválida." }, 502);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await serviceClient.from(
      "orders",
    )
      .select("provider_checkout_id")
      .eq("id", payment.external_reference)
      .maybeSingle();
    if (orderError) {
      console.error(
        "Não foi possível consultar o checkout associado à notificação.",
        orderError,
      );
      return json({ error: "Não foi possível validar o pedido." }, 500);
    }
    if (!order || order.provider_checkout_id !== payment.preference_id) {
      return json({
        error: "O pagamento não corresponde ao checkout deste pedido.",
      }, 409);
    }
    const { error } = await serviceClient.rpc("apply_mercadopago_payment", {
      p_order_id: payment.external_reference,
      p_payment_id: dataId,
      p_status: payment.status,
      p_transaction_amount: payment.transaction_amount,
      p_currency: payment.currency_id,
    });
    if (error) {
      console.error(
        "Não foi possível atualizar o pedido com o pagamento confirmado.",
        error,
      );
      return json({ error: "Não foi possível atualizar o pedido." }, 500);
    }
    return json({ received: true }, 200);
  } catch (error) {
    console.error("Falha ao validar a notificação de pagamento.", error);
    return json({ error: "Falha na validação da notificação." }, 500);
  }
});
