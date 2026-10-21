import type { Metadata } from "next";
import Link from "next/link";
import { authors, getArticlesByAuthor } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Press corps",
  description: "Correspondents of Konoha Daily, Year 64 to the present.",
};

export default function AuthorsPage() {
  return (
    <main className="edition">
      <header className="page-intro">
        <p className="kicker">The desk</p>
        <h1>Press corps</h1>
        <p>
          Every mission report in the ledger carries a byline. Search the archive
          by author, or start with the correspondent.
        </p>
      </header>
      <ul className="author-grid">
        {authors.map((author) => {
          const count = getArticlesByAuthor(author.slug).length;
          return (
            <li key={author.slug}>
              <Link href={`/authors/${author.slug}`}>
                <p className="kicker">{author.title}</p>
                <h2>{author.name}</h2>
                <p>{author.bio}</p>
                <p className="byline">
                  {author.beat} · {count} reports
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
