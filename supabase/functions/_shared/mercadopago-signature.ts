function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyMercadoPagoSignature(
  secret: string,
  signatureHeader: string,
  requestId: string,
  dataId: string,
) {
  const parts = new Map(
    signatureHeader.split(",").map((part) => {
      const separator = part.indexOf("=");
      return separator < 0
        ? ["", ""]
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }),
  );
  const timestamp = parts.get("ts");
  const receivedSignature = parts.get("v1");
  if (
    !timestamp || !/^\d+$/.test(timestamp) || !receivedSignature ||
    !/^[a-f0-9]{64}$/i.test(receivedSignature) || requestId.length > 200
  ) return false;

  const manifest =
    `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = toHex(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)),
    ),
  );
  return constantTimeEqual(expected, receivedSignature.toLowerCase());
}
