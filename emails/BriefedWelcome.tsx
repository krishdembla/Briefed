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

export interface BriefedWelcomeProps {
  appUrl: string;
}

export default function BriefedWelcome({ appUrl }: BriefedWelcomeProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Briefed — your daily world briefing</Preview>
      <Body style={bodyStyle}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>Briefed</Heading>
            <Text style={tagline}>Your daily world briefing</Text>
          </Section>

          <Hr style={divider} />

          <Section style={section}>
            <Heading style={headingStyle}>Welcome aboard.</Heading>
            <Text style={bodyText}>
              Every morning, Briefed will send you a short digest of the stories
              worth your attention — mapped, summarized, and easy to skim. Read
              three pins to complete your daily check-in and build a streak.
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Button style={ctaButton} href={`${appUrl}/map`}>
              Open the map →
            </Button>
          </Section>

          <Section style={section}>
            <Text style={bodyText}>
              Tip: pick your topics on first sign-in so your morning email stays
              tuned to what you care about. You can change them anytime from
              your profile.
            </Text>
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
  fontSize: "28px",
  fontWeight: "700",
  margin: "0 0 12px",
};

const bodyText: React.CSSProperties = {
  color: "#d4d4d8",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 8px",
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
