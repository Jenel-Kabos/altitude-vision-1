export default function EditorialMedia({ media, className, eager = false, testId }) {
  return (
    <img
      alt={media.alt}
      className={className}
      data-testid={testId}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      height={media.height}
      loading={eager ? 'eager' : 'lazy'}
      src={media.src}
      width={media.width}
    />
  );
}
