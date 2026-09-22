'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className="wrap page-content empty-state"><h1>Let’s try that again.</h1><p>This page couldn’t load. Please give it another try.</p><button className="button" onClick={reset}>Try again</button></section>; }
