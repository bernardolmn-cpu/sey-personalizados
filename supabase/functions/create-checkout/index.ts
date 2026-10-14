import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createPreferenceItems,
  type PendingOrder,
} from "../_shared/preference-items.ts";

const allowedHeaders = "authorization, x-client-info, apikey, content-type";

type CheckoutItem = { product_id: string; quantity: number };
type ShippingAddress = {
  full_name: string;
  phone: string;
  postal_code: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
};
function json(
  body: unknown,
  status: number,
  origin: string | null,
  allowedOrigin: string,
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (origin === allowedOrigin) {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("access-control-allow-headers", allowedHeaders);
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set("vary", "Origin");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function readOrder(value: unknown): PendingOrder {
  if (
    typeof value !== "object" || value === null || !("order_id" in value) ||
    typeof value.order_id !== "string" || !("order_number" in value) ||
    typeof value.order_number !== "string" || !("items" in value) ||
    !Array.isArray(value.items) || !("total" in value)
  ) {
    throw new Error("O servidor não retornou os dados esperados do pedido.");
  }
  return value as PendingOrder;
}

Deno.serve(async (request: Request) => {
  const siteUrl = Deno.env.get("SITE_URL");
  const origin = request.headers.get("origin");
  if (!siteUrl) {
    return json(
      { error: "O serviço de pagamento não está configurado." },
      503,
      origin,
      "",
    );
  }
  let allowedOrigin: string;
  try {
    allowedOrigin = new URL(siteUrl).origin;
  } catch {
    console.error("SITE_URL não contém uma URL válida.");
    return json(
      { error: "O serviço de pagamento não está configurado corretamente." },
      503,
      origin,
      "",
    );
  }
  if (request.method === "OPTIONS") {
    if (origin !== allowedOrigin) {
      return new Response("Origem não autorizada.", { status: 403 });
    }
    return json({}, 200, origin, allowedOrigin);
  }
  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405, origin, allowedOrigin);
  }
  if (origin !== allowedOrigin) {
    return json(
      { error: "Origem não autorizada." },
      403,
      origin,
      allowedOrigin,
    );
  }

  const accessToken = request.headers.get("authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paymentToken = Deno.env.get("MP_ACCESS_TOKEN");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !paymentToken) {
    console.error(
      "Credenciais necessárias do Supabase ou Mercado Pago não configuradas.",
    );
    return json(
      { error: "O checkout seguro ainda não está configurado." },
      503,
      origin,
      allowedOrigin,
    );
  }
  if (!accessToken?.startsWith("Bearer ")) {
    return json(
      { error: "Entre na sua conta para finalizar o pedido." },
      401,
      origin,
      allowedOrigin,
    );
  }

  let orderId: string | null = null;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: accessToken } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(
      accessToken.slice("Bearer ".length),
    );
    if (userError || !userData.user) {
      return json(
        { error: "Sua sessão expirou. Entre novamente." },
        401,
        origin,
        allowedOrigin,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(
        { error: "Não foi possível interpretar os dados do pedido." },
        400,
        origin,
        allowedOrigin,
      );
    }
    if (
      typeof body !== "object" || body === null || !("items" in body) ||
      !Array.isArray(body.items) || !("shipping_address" in body)
    ) {
      return json(
        { error: "Informe os itens e o endereço de entrega." },
        400,
        origin,
        allowedOrigin,
      );
    }
    const items = body.items as CheckoutItem[];
    if (
      items.length < 1 || items.length > 30 ||
      items.some((item) =>
        typeof item !== "object" || item === null ||
        typeof item.product_id !== "string" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 || item.quantity > 99
      )
    ) {
      return json(
        { error: "A lista de produtos do pedido é inválida." },
        400,
        origin,
        allowedOrigin,
      );
    }
    const couponCode =
      "coupon_code" in body && typeof body.coupon_code === "string"
        ? body.coupon_code
        : null;
    const { data: orderData, error: orderError } = await userClient.rpc(
      "create_pending_order",
      {
        p_items: items,
        p_shipping_address: body.shipping_address,
        p_coupon_code: couponCode,
      },
    );
    if (orderError) {
      return json({ error: orderError.message }, 422, origin, allowedOrigin);
    }

    const order = readOrder(orderData);
    orderId = order.order_id;
    const expirationDate = new Date(order.expires_at);
    if (
      !Number.isFinite(expirationDate.getTime()) || expirationDate <= new Date()
    ) {
      throw new Error("A reserva de estoque expirou. Inicie um novo pedido.");
    }
    const preferencePayload = {
      items: createPreferenceItems(order),
      external_reference: order.order_id,
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      back_urls: {
        success: `${allowedOrigin}/pedidos?pagamento=sucesso`,
        pending: `${allowedOrigin}/pedidos?pagamento=pendente`,
        failure: `${allowedOrigin}/pedidos?pagamento=recusado`,
      },
      auto_return: "approved",
      statement_descriptor: "VITRINE",
      expiration_date_from: new Date(Date.now() - 60_000).toISOString(),
      expiration_date_to: expirationDate.toISOString(),
    };
    const preferenceResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paymentToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": order.order_id,
        },
        body: JSON.stringify(preferencePayload),
      },
    );
    if (!preferenceResponse.ok) {
      const errorBody = await preferenceResponse.text();
      console.error(
        "Mercado Pago recusou a criação da preferência.",
        preferenceResponse.status,
        errorBody,
      );
      const { error: releaseError } = await serviceClient.rpc(
        "release_pending_order",
        { p_order_id: order.order_id, p_payment_status: "rejected" },
      );
      if (releaseError) {
        console.error(
          "Não foi possível liberar a reserva do pedido após falha do provedor.",
          releaseError,
        );
      }
      return json(
        {
          error:
            "Não foi possível preparar o pagamento. A reserva de estoque foi liberada; tente novamente.",
        },
        502,
        origin,
        allowedOrigin,
      );
    }
    const preference: unknown = await preferenceResponse.json();
    if (
      typeof preference !== "object" || preference === null ||
      !("id" in preference) ||
      typeof preference.id !== "string" || !("init_point" in preference) ||
      typeof preference.init_point !== "string" ||
      !["www.mercadopago.com.br", "sandbox.mercadopago.com.br"].includes(
        new URL(preference.init_point).hostname,
      ) ||
      new URL(preference.init_point).protocol !== "https:"
    ) {
      throw new Error("O provedor não retornou uma URL de checkout válida.");
    }

    const { error: saveError } = await serviceClient.from("orders").update({
      payment_provider: "mercadopago",
      provider_checkout_id: preference.id,
      checkout_url: preference.init_point,
    }).eq("id", order.order_id).eq("status", "awaiting_payment");
    if (saveError) throw saveError;

    return json(
      { checkout_url: preference.init_point, order_number: order.order_number },
      200,
      origin,
      allowedOrigin,
    );
  } catch (error) {
    console.error("Falha na criação do checkout.", error);
    if (orderId) {
      const { error: releaseError } = await serviceClient.rpc(
        "release_pending_order",
        {
          p_order_id: orderId,
          p_payment_status: "rejected",
        },
      );
      if (releaseError) {
        console.error(
          "Não foi possível liberar a reserva do pedido após erro no checkout.",
          releaseError,
        );
      }
    }
    return json(
      {
        error: error instanceof Error
          ? error.message
          : "Não foi possível criar o checkout.",
      },
      502,
      origin,
      allowedOrigin,
    );
  }
});
