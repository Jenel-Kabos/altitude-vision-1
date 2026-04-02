// Composant pour injecter les JSON-LD côté serveur
// Remplace les <script> de react-helmet
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
