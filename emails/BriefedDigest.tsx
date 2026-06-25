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

export interface DigestPin {
  headline: string;
  topic: string;
  regionLabel: string | null;
}

export interface BriefedDigestProps {
  intro: string;          // Claude-generated one-sentence teaser
  pins: DigestPin[];      // 2–4 pins, scored by topic preference
  appUrl: string;         // CTA link, e.g. https://briefed.app
  unsubscribeUrl: string; // signed one-click unsubscribe URL
}

const TOPIC_COLORS: Record<string, string> = {
  politics: "#3b82f6",
  economy:  "#22c55e",
  conflict: "#ef4444",
  health:   "#ec4899",
  climate:  "#14b8a6",
  tech:     "#a855f7",
  other:    "#94a3b8",
};

const TOPIC_LABELS: Record<string, string> = {
  politics: "Politics",
  economy:  "Economy",
  conflict: "Conflict",
  health:   "Health",
  climate:  "Climate",
  tech:     "Tech",
  other:    "Other",
};

export default function BriefedDigest({ intro, pins, appUrl, unsubscribeUrl }: BriefedDigestProps) {
  return (
    <Html>
      <Head />
      <Preview>{intro}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={logo}>Briefed</Heading>
            <Text style={tagline}>Your daily world briefing</Text>
          </Section>

          <Hr style={divider} />

          {/* Intro */}
          <Section style={section}>
            <Text style={introText}>{intro}</Text>
          </Section>

          {/* Pin teasers */}
          {pins.map((pin, i) => {
            const color = TOPIC_COLORS[pin.topic] ?? TOPIC_COLORS.other;
            const label = TOPIC_LABELS[pin.topic] ?? "Other";
            return (
              <Section key={i} style={{ ...pinCard, borderLeftColor: color }}>
                <Text style={{ ...badge, color, backgroundColor: color + "22" }}>
                  {label}{pin.regionLabel ? ` · ${pin.regionLabel}` : ""}
                </Text>
                <Text style={pinHeadline}>{pin.headline}</Text>
              </Section>
            );
          })}

          <Hr style={divider} />

          {/* CTA */}
          <Section style={ctaSection}>
            <Button style={ctaButton} href={appUrl}>
              Open today{"'"}s briefing →
            </Button>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You{"'"}re receiving this because you signed up for Briefed.
            </Text>
            <Text style={footerText}>
              <a href={unsubscribeUrl} style={unsubscribeLink}>Unsubscribe</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
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

const introText: React.CSSProperties = {
  color: "#d4d4d8",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0",
};

const pinCard: React.CSSProperties = {
  backgroundColor: "#18181b",
  borderLeft: "3px solid",
  borderRadius: "8px",
  padding: "14px 16px",
  marginBottom: "12px",
};

const badge: React.CSSProperties = {
  display: "inline-block",
  fontSize: "11px",
  fontWeight: "600",
  padding: "2px 8px",
  borderRadius: "999px",
  margin: "0 0 8px",
};

const pinHeadline: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600",
  lineHeight: "1.45",
  margin: "0",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  padding: "8px 0 24px",
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

const unsubscribeLink: React.CSSProperties = {
  color: "#52525b",
  textDecoration: "underline",
};
