import { notFound } from "next/navigation";
import { DirectoryAvatar } from "@/components/directory-avatar";
import { DIRECTORY_PAGE_SIZE, directoryForToken, directoryPageList, searchDirectory } from "@/lib/directory";

export const dynamic = "force-dynamic";

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `?${search}` : "?";
}

export default async function DirectoryPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { token } = await params;
  const result = await directoryForToken(token);
  if (!result) notFound();
  const search = await searchParams;
  const query = (typeof search.q === "string" ? search.q : "").trim().slice(0, 100);
  const members = searchDirectory(result.members, query);
  const requested = Number(search.page || 1);
  const pages = Math.max(1, Math.ceil(members.length / DIRECTORY_PAGE_SIZE));
  const page = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), pages) : 1;
  const visible = members.slice((page - 1) * DIRECTORY_PAGE_SIZE, page * DIRECTORY_PAGE_SIZE);
  return <div className="wrap page-content">
    <div className="page-heading"><p>Private event directory</p><h1>{result.event.name}</h1><p>Shared only with people who have this private link. Everyone going to this event is listed unless they chose to hide.</p></div>
    {result.members.length ? <form className="directory-search" role="search" method="get">
      <label className="sr-only" htmlFor="directory-q">Search by name</label>
      <input id="directory-q" name="q" type="search" placeholder="Search by name" defaultValue={query} autoComplete="off" maxLength={100} />
      <button className="button" type="submit">Search</button>
      {query ? <a className="button secondary" href="?">Clear</a> : null}
    </form> : null}
    {query && members.length ? <p className="directory-search-note">{members.length} {members.length === 1 ? "person matches" : "people match"} “{query}”</p> : null}
    {visible.length ? <div className="grid gap-4 md:grid-cols-2">{visible.map((member, index) => <article className="flex items-start gap-4 rounded-2xl border border-border bg-secondary p-5" key={`${member.name}-${index}`}>
      <DirectoryAvatar name={member.name} src={member.photoUrl} />
      <div className="min-w-0"><h2 className="text-2xl break-words">{member.name}</h2>{member.isHost ? <span className="ml-2 inline-block rounded-full border border-border px-2 py-1 align-middle font-sans text-xs tracking-normal">Host</span> : null}{member.background ? <p className="mt-2 text-sm leading-6">{member.background}</p> : null}{member.linkedinUrl ? <a className="button secondary mt-4" href={member.linkedinUrl} target="_blank" rel="noreferrer">View LinkedIn</a> : null}</div>
    </article>)}</div> : query ? <div className="empty-state"><h2>No one by that name.</h2><p>Nobody in this directory matches “{query}”. Check the spelling or try part of the name.</p><a className="button" href="?">Show everyone</a></div> : <div className="empty-state"><h2>The directory is quiet for now.</h2><p>People will appear here when they choose to join.</p></div>}
    {pages > 1 ? <nav className="directory-pagination" aria-label="Directory pages">
      <p>Showing {(page - 1) * DIRECTORY_PAGE_SIZE + 1}–{Math.min(page * DIRECTORY_PAGE_SIZE, members.length)} of {members.length}</p>
      <div className="directory-pager">
        {page > 1 ? <a className="button pager-step" href={pageHref(page - 1, query)} rel="prev">← Previous</a> : <span className="button pager-step" aria-disabled="true">← Previous</span>}
        <ol className="pager-numbers">{directoryPageList(page, pages).map((item, index) => <li key={item === "gap" ? `gap-${index}` : item}>
          {item === "gap" ? <span className="pager-gap" aria-hidden="true">…</span> : item === page ? <span className="pager-number" aria-current="page" aria-label={`Page ${item}, current`}>{item}</span> : <a className="pager-number" href={pageHref(item, query)} aria-label={item === pages ? `Last page, ${item}` : `Page ${item}`}>{item}</a>}
        </li>)}</ol>
        {page < pages ? <a className="button pager-step" href={pageHref(page + 1, query)} rel="next">Next →</a> : <span className="button pager-step" aria-disabled="true">Next →</span>}
      </div>
    </nav> : null}
  </div>;
}
