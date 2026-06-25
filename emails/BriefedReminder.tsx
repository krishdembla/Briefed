import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface BriefedReminderProps {
  streak: number;   // current streak (0 = no active streak)
  appUrl: string;
}

export default function BriefedReminder({ streak, appUrl }: BriefedReminderProps) {
  const hasStreak = streak > 0;
  const preview = hasStreak
    ? `Your ${streak}-day streak is at risk — check in before midnight.`
    : "Your daily briefing is ready. Stay informed today.";

  const heading = hasStreak ? `${streak} days 🔥` : "Stay informed today";
  const body = hasStreak
    ? `You're on a ${streak}-day reading streak. Don't break it — it only takes 3 pins to keep it alive.`
    : "You haven't checked in yet today. Read 3 pins to start your streak and stay on top of what's happening in the world.";

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>Briefed</Heading>
            <Text style={tagline}>Your daily world briefing</Text>
          </Section>

          <Hr style={divider} />

          <Section style={section}>
            <Heading style={headingStyle}>{heading}</Heading>
            <Text style={bodyText}>{body}</Text>
          </Section>

          <Section style={ctaSection}>
            <Button style={ctaButton} href={appUrl}>
              Read today{"'"}s briefing →
            </Button>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              You{"'"}re receiving this because you signed up for Briefed.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#09090b",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const container: React.CSSProperties = {
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "520px",
};

const header: React.CSSProperties = {
  textAlign: "center",
  paddingBottom: "8px",
};

const logo: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "28px",
  fontWeight: "700",
  letterSpacing: "-0.5px",
  margin: "0",
};

const tagline: React.CSSProperties = {
  color: "#71717a",
  fontSize: "13px",
  margin: "4px 0 0",
};

const divider: React.CSSProperties = {
  borderColor: "#27272a",
  margin: "24px 0",
};

const section: React.CSSProperties = {
  padding: "0 0 8px",
};

const headingStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "32px",
  fontWeight: "700",
  margin: "0 0 12px",
};

const bodyText: React.CSSProperties = {
  color: "#d4d4d8",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  padding: "24px 0",
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#ffffff",
  color: "#09090b",
  fontSize: "14px",
  fontWeight: "600",
  padding: "12px 28px",
  borderRadius: "12px",
  textDecoration: "none",
};

const footer: React.CSSProperties = {
  textAlign: "center",
};

const footerText: React.CSSProperties = {
  color: "#52525b",
  fontSize: "11px",
};
