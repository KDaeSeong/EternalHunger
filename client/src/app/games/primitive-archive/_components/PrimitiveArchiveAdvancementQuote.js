export default function PrimitiveArchiveAdvancementQuote({ quote }) {
  if (!quote?.text) return null;

  return (
    <blockquote className="primitive-advancement-quote">
      <p>“{quote.text}”</p>
      <cite>
        {quote.author} ·{' '}
        <a href={quote.sourceUrl} target="_blank" rel="noreferrer">{quote.work}</a>
      </cite>
    </blockquote>
  );
}
