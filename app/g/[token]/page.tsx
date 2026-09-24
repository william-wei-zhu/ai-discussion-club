import { notFound } from "next/navigation";
import { DirectoryAvatar } from "@/components/directory-avatar";
import { DIRECTORY_PAGE_SIZE, directoryForToken } from "@/lib/directory";

export const dynamic = "force-dynamic";

export default async function DirectoryPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { token } = await params;
  const result = await directoryForToken(token);
  if (!result) notFound();
  const requested = Number((await searchParams).page || 1);
  const pages = Math.max(1, Math.ceil(result.members.length / DIRECTORY_PAGE_SIZE));
  const page = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), pages) : 1;
  const visible = result.members.slice((page - 1) * DIRECTORY_PAGE_SIZE, page * DIRECTORY_PAGE_SIZE);
  return <div className="wrap page-content">
    <div className="page-heading"><p>Private event directory</p><h1>{result.event.name}</h1><p>Shared only with people who have this private link. Everyone going to this event is listed unless they chose to hide.</p></div>
    {visible.length ? <div className="grid gap-4 md:grid-cols-2">{visible.map((member, index) => <article className="flex items-start gap-4 rounded-2xl border border-border bg-secondary p-5" key={`${member.name}-${index}`}>
      <DirectoryAvatar name={member.name} src={member.photoUrl} />
      <div className="min-w-0"><h2 className="text-2xl break-words">{member.name}</h2>{member.isHost ? <span className="ml-2 inline-block rounded-full border border-border px-2 py-1 align-middle font-sans text-xs tracking-normal">Host</span> : null}{member.background ? <p className="mt-2 text-sm leading-6">{member.background}</p> : null}{member.linkedinUrl ? <a className="button secondary mt-4" href={member.linkedinUrl} target="_blank" rel="noreferrer">View LinkedIn</a> : null}</div>
    </article>)}</div> : <div className="empty-state"><h2>The directory is quiet for now.</h2><p>People will appear here when they choose to join.</p></div>}
    {result.members.length > DIRECTORY_PAGE_SIZE ? <nav className="pagination" aria-label="Directory pages"><p>{(page - 1) * DIRECTORY_PAGE_SIZE + 1}–{Math.min(page * DIRECTORY_PAGE_SIZE, result.members.length)} of {result.members.length}</p><div className="flex flex-wrap items-center gap-3">{page > 1 ? <a className="button secondary" href={`?page=${page - 1}`}>Previous</a> : null}<span>Page {page} of {pages}</span>{page < pages ? <a className="button secondary" href={`?page=${page + 1}`}>Next</a> : null}</div></nav> : null}
  </div>;
}
