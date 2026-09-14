export function portalEmailConfig() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.PORTAL_EMAIL_FROM;
  const origin = new URL(process.env.INSTAGRAM_PORTAL_ORIGIN || 'https://www.smartbrew.tech');
  if (!key || !from || /[\r\n]/.test(from) || origin.protocol !== 'https:') throw new Error('Email not configured');
  return { key, from, loginUrl: `${origin.origin}/portal/login` };
}

export async function sendPortalInvitation(email: string, code: string, inviteHash: string) {
  const config = portalEmailConfig();
  // A fragment keeps the token out of HTTP URLs, access logs and referrer headers.
  const activationUrl = `${new URL(config.loginUrl).origin}/portal/activate#token=${encodeURIComponent(code)}`;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `portal-invite/${inviteHash}` },
      body: JSON.stringify({ from: config.from, to: [email], subject: 'Tu invitación a SmartBrew',
        text: `Te invitaron al portal privado de SmartBrew.\n\nAceptar invitación:\n${activationUrl}\n\nEl enlace identifica tu invitación: solo tenés que elegir una contraseña nueva de SmartBrew (mínimo 12 caracteres). Vence en 7 días y se usa una sola vez al confirmar la activación. No compartas este enlace ni ingreses tu contraseña de Instagram en SmartBrew. Después podrás conectar Instagram mediante su pantalla oficial.\n\nSi no esperabas esta invitación, ignorá este mensaje.` }),
    });
    const data = await response.json();
    if (!response.ok || typeof data.id !== 'string' || !data.id) throw new Error();
    return data.id as string;
  } catch { throw new Error('No se pudo confirmar el envío del email.'); }
}
