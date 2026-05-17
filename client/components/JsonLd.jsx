// Injecte les JSON-LD Schema.org dans le <head> côté serveur
// Usage: <JsonLd schemas={[buildOrganization(), buildBreadcrumb([...])]} />
export default function JsonLd({ schemas = [] }) {
  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
