import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import { FullPageLayout } from "../../cfg"
import { FilePath, FullSlug, joinSegments } from "../../util/path"
import {
  defaultListPageLayout,
  sharedPageComponents,
} from "../../../quartz.layout"
import { write } from "./helpers"
import ResearchPocketGraph from "../../components/ResearchPocketGraph"
import { pageResources, renderPage } from "../../components/renderPage"
import { defaultProcessedContent } from "../vfile"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import DepGraph from "../../depgraph"

interface ResearchPocketPageOptions extends FullPageLayout { }

export const ResearchPocketPage: QuartzEmitterPlugin<ResearchPocketPageOptions> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    pageBody: ResearchPocketGraph(),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "ResearchPocketPage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ]
    },

    async getDependencyGraph(ctx, content, _resources) {
      const graph = new DepGraph<FilePath>()

      // Add edge from research pocket graph JSON to the main page
      graph.addEdge(
        joinSegments(ctx.argv.output, "static", "research-pocket-graph.json") as FilePath,
        joinSegments(ctx.argv.output, "garden.html") as FilePath,
      )

      return graph
    },

    async emit(ctx, content, resources): Promise<FilePath[]> {
      const cfg = ctx.cfg.configuration
      const slug = "garden" as FullSlug

      const url = new URL(`https://${ cfg.baseUrl ?? "example.com" }`)
      const path = url.pathname as FullSlug
      const [tree, vfile] = defaultProcessedContent({
        slug,
        frontmatter: { title: "garden", tags: [] },
        text: "This is the research pocket graph page.",
        description: "A visual representation of the research pocket graph.",
        keywords: ["research", "pocket", "graph"],
      })
      const externalResources = pageResources(path, vfile.data, resources)
      const componentData: QuartzComponentProps = {
        ctx,
        fileData: vfile.data,
        externalResources,
        cfg,
        children: [],
        tree,
        allFiles: [],
      }

      const items = content[0]?.[1]?.data?.researchPocketItems!

      const graphData = {
        nodes: items.map((item) => ({
          id: item.id,
          text: item.title,
          tags: item.tags,
          note: item.note,
          folder: item.folder,
          url: item.url,
          created: item.created,
        })),
        links: items.flatMap((item1) =>
          items
            .filter((item2) => item1.id !== item2.id)
            .map((item2) => {
              const commonTags = item1.tags.filter((tag) => item2.tags.includes(tag))
              return commonTags.length > 0
                ? {
                  source: item1.id,
                  target: item2.id,
                  value: commonTags.length,
                  tags: commonTags,
                }
                : null
            })
            .filter(Boolean),
        ),
        tags: [...new Set(items.flatMap((item) => item.tags))],
      }

      // Write graph data file
      await write({
        ctx,
        content: JSON.stringify(graphData),
        slug: joinSegments("static", "research-pocket-graph") as FullSlug,
        ext: ".json",
      })

      return [
        await write({
          ctx,
          content: renderPage(cfg, slug, componentData, opts, externalResources),
          slug,
          ext: ".html",
        }),
      ]
    },
  }
}
