import type { MetadataRoute } from "next";
import { posts } from "./blog/_data/posts";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://usefold.io";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base,                  lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/signup`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/login`,       lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/blog`,        lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/terms`,       lastModified: new Date(), changeFrequency: "yearly",  priority: 0.2 },
    { url: `${base}/privacy`,     lastModified: new Date(), changeFrequency: "yearly",  priority: 0.2 },
  ];

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: post.category === "comparison" ? 0.85 : 0.75,
  }));

  return [...staticRoutes, ...blogRoutes];
}
