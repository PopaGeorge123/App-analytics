import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#13131f",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 96px",
          fontFamily: "'Courier New', monospace",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow blobs */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "900px",
            height: "500px",
            borderRadius: "50%",
            background: "rgba(0,212,170,0.06)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            right: "120px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "rgba(99,102,241,0.07)",
            filter: "blur(80px)",
          }}
        />

        {/* Logo / wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "48px",
          }}
        >
          <span
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#00d4aa",
              letterSpacing: "-0.5px",
            }}
          >
            FOLD
          </span>
          <span
            style={{
              fontSize: "11px",
              color: "#4a4a6a",
              marginLeft: "12px",
              letterSpacing: "3px",
              paddingTop: "4px",
            }}
          >
            AI BUSINESS INTELLIGENCE
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "62px",
            fontWeight: 800,
            color: "#f8f8fc",
            lineHeight: 1.1,
            marginBottom: "28px",
            maxWidth: "820px",
          }}
        >
          Your entire business,{" "}
          <span style={{ color: "#00d4aa" }}>understood</span>{" "}
          in seconds.
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "22px",
            color: "#8585aa",
            maxWidth: "680px",
            lineHeight: 1.5,
            marginBottom: "56px",
          }}
        >
          AI-powered dashboard that connects Stripe, GA4, Meta Ads, Shopify &
          more — and tells you exactly what to do next.
        </div>

        {/* KPI pill row */}
        <div style={{ display: "flex", gap: "16px" }}>
          {[
            { label: "Revenue (7d)", value: "+8.2%", color: "#00d4aa" },
            { label: "CAC", value: "-18%", color: "#00d4aa" },
            { label: "Sessions", value: "+14.1%", color: "#00d4aa" },
            { label: "ROAS", value: "4.2×", color: "#a78bfa" },
          ].map((pill) => (
            <div
              key={pill.label}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#1c1c2a",
                border: "1px solid #363650",
                borderRadius: "12px",
                padding: "14px 22px",
              }}
            >
              <span style={{ fontSize: "11px", color: "#8585aa", letterSpacing: "1.5px", marginBottom: "6px" }}>
                {pill.label.toUpperCase()}
              </span>
              <span style={{ fontSize: "24px", fontWeight: 700, color: pill.color }}>
                {pill.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
