import type { QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/researchPocketGraph.inline"
import style from "./styles/graph.scss"
import { Root } from "hast"
import { htmlToJsx } from "../util/jsx"

export default (() => {
  function ResearchPocketGraph(props: QuartzComponentProps) {
    const { displayClass, fileData, tree } = props
    const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
    const classes = cssClasses.join(" ")
    const content =
      (tree as Root).children.length === 0
        ? fileData.description
        : htmlToJsx(fileData.filePath!, tree)


    return (
      <>
        <h2><a href={'/garden/notes'}>Browse Notes</a></h2>
        <form id="save-item">
          <input type="url" name="url" placeholder="URL" required />
          <input type="text" name="tags" placeholder="Tags (comma-separated)" />
          <input type="hidden" name="provider" defaultValue="local" />
          <input type="hidden" name="dbPath" defaultValue="/home/origami/Dev/projects/rust/my-list/research.sqlite" />
          <button type="submit">Save to Research</button>
        </form>
        <article class={classes}>
          <p>{content}</p>
        </article>
        <div class={`graph ${ displayClass ?? "" }`}>
          <div class="graph-outer">
            <div id="research-pocket-graph-container">
              <div class="loading">Loading graph data...</div>
            </div>
          </div>
        </div>
      </>
    )
  }

  ResearchPocketGraph.css = style
  ResearchPocketGraph.afterDOMLoaded = script

  return ResearchPocketGraph
}) satisfies QuartzComponentConstructor
