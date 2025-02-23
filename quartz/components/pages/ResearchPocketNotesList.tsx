import { Root } from "hast"
import { FullSlug, simplifySlug } from "../../util/path"
import { Date as DateComponent } from "../Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { htmlToJsx } from "../../util/jsx"

export default (() => {
  function ResearchPocketNotesList(props: QuartzComponentProps) {
    const { tree, fileData, allFiles, cfg } = props
    const slug = fileData.slug
    if (!(slug?.startsWith("garden/notes"))) {
      throw new Error(`Component "PocketNotesList" tried to render a non-note page: ${ slug }`)
    }
    const itemID = simplifySlug(slug.slice('garden/note/'.length) as FullSlug);
    const items = fileData.researchPocketItems
    console.log("Processing ", itemID)
    const content =
      (tree as Root).children.length === 0
        ? fileData.description
        : htmlToJsx(fileData.filePath!, tree)
    const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
    const classes = cssClasses.join(" ")
    if (itemID === '/') {
      return (
        <>
          <div className="research-pocket-notes-list">
            <div class="popover-hint">
              <article class={classes}>
                <p>{content}</p>
              </article>
            </div>
            <div className="note-entries">
              {items?.filter(i => i.note && i.note !== '').map(item => (
                <div key={item.id} className="note-entry">
                  <h3>
                    <a href={`/garden/notes/${ item.id }.html`}>{item.title}</a>
                  </h3>
                  <div className="note-metadata">
                    <span className="tags">
                      {item.tags.map(tag => (
                        <span key={tag} className="tag">#{tag}</span>
                      ))}
                    </span>
                  </div>
                  <p className="note-excerpt">{item.note.slice(0, 200)}...</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )
    } else {
      const note = items?.find((e) => e.id.includes(itemID))
      return (
        <>
          <div class={classes}>
            <article class="popover-hint">{content}</article>
            <p class="meta">
              {note?.created && <DateComponent date={new Date(note.created * 1000)} locale={cfg.locale} />}
            </p>
            <a href={note?.url}>{note?.url}</a>
            <p>{note?.note}</p>
            <ul class="tags">
              {note?.tags.map((tag) => (
                <li>
                  <a
                    class="internal tag-link"
                    href={'/garden'}
                  >
                    {tag}
                  </a>
                </li>
              ))}
            </ul>
          </div >
        </>
      )
    }
  }

  ResearchPocketNotesList.css = `
    .research-pocket-notes-list {
      margin: 2rem 0;
    }

    .note-entry {
      margin-bottom: 2rem;
      padding: 1rem;
      border: 1px solid var(--lightgray);
      border-radius: 5px;
    }

    .note-metadata {
      display: flex;
      gap: 1rem;
      margin: 0.5rem 0;
      font-size: 0.9em;
      color: var(--gray);
    }

    .tags {
      display: flex;
      gap: 0.5rem;
    }

    .tag {
      color: var(--secondary);
    }

    .note-excerpt {
      margin: 0.5rem 0;
      color: var(--darkgray);
    }
  `
  return ResearchPocketNotesList
}) satisfies QuartzComponentConstructor
