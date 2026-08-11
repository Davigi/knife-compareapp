/**
 * feedback.js — Netlify Function
 *
 * Receives staff feedback about a knife product and writes it to Airtable.
 * The Airtable token never leaves the server — it is read from env vars only.
 *
 * POST /.netlify/functions/feedback
 * Body: { product, handle, issueType, comment, reporter }
 */

const AIRTABLE_FEEDBACK_TABLE = "tblC8XmubENQLfFhO";

const ALLOWED_ISSUE_TYPES = [
  "Steel mismatch",
  "Wrong specs",
  "Missing info",
  "Wrong price",
  "Other",
];

export const handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const token = process.env.AIRTABLE_TOKEN;
  const base  = process.env.AIRTABLE_BASE;

  if (!token || !base) {
    console.error("feedback: missing AIRTABLE_TOKEN or AIRTABLE_BASE env var");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error" }),
    };
  }

  // Parse and validate body
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const { product, handle, issueType, comment, reporter } = body;

  if (!comment?.trim()) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Comment is required" }),
    };
  }

  // Sanitise and constrain all inputs — nothing raw goes to Airtable
  const safeIssueType = ALLOWED_ISSUE_TYPES.includes(issueType)
    ? issueType
    : "Other";

  // Strip anything that isn't a valid Shopify handle character
  const safeHandle = handle
    ? String(handle).replace(/[^a-z0-9-]/g, "").slice(0, 120)
    : "";

  const fields = {
    Product:   String(product  || "").slice(0, 200),
    Handle:    safeHandle
      ? `https://www.musashihamono.com/products/${safeHandle}`
      : "",
    IssueType: safeIssueType,
    Comment:   String(comment  || "").trim().slice(0, 2000),
    Reporter:  String(reporter || "Anonymous").trim().slice(0, 100),
  };

  const res = await fetch(
    `https://api.airtable.com/v0/${base}/${AIRTABLE_FEEDBACK_TABLE}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `Airtable error ${res.status}`;
    console.error("feedback: Airtable write failed —", msg);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: msg }),
    };
  }

  const data = await res.json();
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, id: data.id }),
  };
};
