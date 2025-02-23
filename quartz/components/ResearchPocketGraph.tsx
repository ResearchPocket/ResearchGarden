import type { QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/researchPocketGraph.inline"
import style from "./styles/graph.scss"

export default (() => {
  function ResearchPocketGraph(props: QuartzComponentProps) {
    const { displayClass } = props
    return (
      <div class={`graph ${displayClass ?? ""}`}>
        <div class="graph-outer">
          <div id="research-pocket-graph-container">
            <div class="loading">Loading graph data...</div>
          </div>
        </div>
      </div>
    )
  }

  ResearchPocketGraph.css = style
  ResearchPocketGraph.afterDOMLoaded = script

  return ResearchPocketGraph
}) satisfies QuartzComponentConstructor
