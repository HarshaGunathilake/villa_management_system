/** Structured data for search and answer engines. `<` is escaped so the JSON can never close the script tag. */
export function JsonLd({ items }: { items: object[] }) {
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": items }).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
