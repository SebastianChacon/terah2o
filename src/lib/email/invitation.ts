export type InviteRole = "operator" | "admin";

export interface SendInvitationResult {
  sent: boolean;
  reason?: string;
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.SITE_URL ??
    "https://terah2o.vercel.app"
  );
}

export async function sendInvitationEmail(params: {
  to: string;
  name: string;
  orgName: string;
  role: InviteRole;
}): Promise<SendInvitationResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY no configurada" };
  }

  const from =
    process.env.RESEND_FROM_EMAIL ?? "TeraH2O <onboarding@resend.dev>";
  const loginUrl = `${appBaseUrl().replace(/\/$/, "")}/login`;
  const roleLabel = params.role === "admin" ? "administrador" : "operador";

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 520px; color: #0f172a;">
      <h2 style="color: #2563eb;">TeraH2O — Invitación</h2>
      <p>Hola <strong>${params.name}</strong>,</p>
      <p>
        Fuiste invitado como <strong>${roleLabel}</strong> en
        <strong>${params.orgName}</strong>.
      </p>
      <p>Para acceder, crea tu cuenta o inicia sesión con este correo:</p>
      <p style="font-family: monospace; background: #f1f5f9; padding: 8px 12px; border-radius: 6px;">
        ${params.to}
      </p>
      <p>
        <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Ir a iniciar sesión
        </a>
      </p>
      <p style="color: #64748b; font-size: 13px;">
        Si no esperabas este correo, puedes ignorarlo.
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: `Invitación a TeraH2O — ${params.orgName}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { sent: false, reason: `Resend error ${res.status}: ${body}` };
  }

  return { sent: true };
}
