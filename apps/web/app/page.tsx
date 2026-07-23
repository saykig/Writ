export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <p className="label-mono">Auditable compliance · G7 commitments</p>
      <h1 className="font-serif text-5xl leading-[1.05] tracking-tight">
        <span className="text-gold">&ldquo;</span>up to four strong actions.
        <span className="text-gold">&rdquo;</span>
      </h1>
      <p className="max-w-prose text-lg text-muted-foreground">
        Five words decide a country&rsquo;s score. Read one way, a state with zero strong actions
        and five weak ones matches no rule. Read another, it matches two. Covenant makes the
        interpretation explicit, and names exactly where the score stops being a fact.
      </p>
      <div className="label-mono text-ink-faint">Scaffold online — full site in progress.</div>
    </main>
  );
}
