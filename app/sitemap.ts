import type { MetadataRoute } from "next";
import { posts } from "./blog/_data/posts";

const LEARN_PLATFORMS = [
  "stripe",
  "ga4",
  "meta",
  "gumroad",
  "paddle",
  "plausible",
  "mailchimp",
  "klaviyo",
  "beehiiv",
  "shopify",
  "woocommerce",
  "hubspot",
  "posthog",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://usefold.io";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base,                  lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/signup`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/login`,       lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/blog`,        lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/learn`,       lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/terms`,       lastModified: new Date(), changeFrequency: "yearly",  priority: 0.2 },
    { url: `${base}/privacy`,     lastModified: new Date(), changeFrequency: "yearly",  priority: 0.2 },
  ];

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: post.category === "comparison" ? 0.85 : 0.75,
  }));

  const learnRoutes: MetadataRoute.Sitemap = LEARN_PLATFORMS.map((platform) => ({
    url: `${base}/learn/${platform}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  return [...staticRoutes, ...blogRoutes, ...learnRoutes];
}

