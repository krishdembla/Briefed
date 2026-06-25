import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Sends a plain-text alert email to ADMIN_EMAIL.
// Best-effort — never throws so it can't make a bad situation worse.
export async function sendAlertEmail(subject: string, body: string): Promise<void> {
  const to = process.env.ADMIN_EMAIL;
  if (!to) {
    console.warn("[alerts] ADMIN_EMAIL not set — skipping alert");
    return;
  }

  try {
    await resend.emails.send({
      from: "Briefed Alerts <onboarding@resend.dev>",
      to,
      subject: `[Briefed Alert] ${subject}`,
      text: body,
    });
    console.log(`[alerts] Alert sent: ${subject}`);
  } catch (err) {
    console.error("[alerts] Failed to send alert email:", err);
  }
}
