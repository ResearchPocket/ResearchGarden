import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import { FullPageLayout } from "../../cfg"
import { FilePath, FullSlug, joinSegments } from "../../util/path"
import {
  defaultListPageLayout,
  sharedPageComponents,
} from "../../../quartz.layout"
import { write } from "./helpers"
import { exec } from "node:child_process"
import { parse } from "csv-parse/sync"
import ResearchPocketGraph from "../../components/ResearchPocketGraph"
import { pageResources, renderPage } from "../../components/renderPage"
import { defaultProcessedContent } from "../vfile"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import DepGraph from "../../depgraph"


interface ResearchPocketItem {
  id: string
  folder: string
  url: string
  title: string
  note: string
  tags: string[]
  created: number
}
interface ResearchPocketPageOptions extends FullPageLayout {}

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
        joinSegments(ctx.argv.output, "research-pocket.html") as FilePath,
      )

      return graph
    },

    async emit(ctx, _content, resources): Promise<FilePath[]> {
          const cfg = ctx.cfg.configuration
          const slug = "research-pocket" as FullSlug

          const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
          const path = url.pathname as FullSlug
          const [tree, vfile] = defaultProcessedContent({
            slug,
            frontmatter: { title: "Research Pocket Graph", tags: [] },
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

          try {
            // Get research data
            const { stdout } = await new Promise<{stdout: string}>((resolve, reject) => {
              exec(
                "/home/origami/Dev/projects/rust/pocket-research/target/debug/research --db  /home/origami/Dev/projects/rust/my-list/research.sqlite export --raindrop -",
                (error, stdout) => {
                  if (error) reject(error)
                  else resolve({stdout})
                }
              )
            })

            if (!stdout) {
              throw new Error("No stdout")
            }
            // Parse CSV data
            const items = parse(stdout, {
              columns: true,
              cast: (value, context) => {
                if (context.column === "tags") {
                  // Handle tags format like "cool" or "article, raycasting, test"
                  return value ? value.split(",").map((tag: string) => tag.trim()) : []
                }
                if (context.column === "created") {
                  return parseInt(value)
                }
                return value
              },
              skip_empty_lines: true,
            }) as ResearchPocketItem[]

            // Create graph data structure
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

            // Log graph data excerpt
            console.log("Graph Data Excerpt:", {
              nodes: graphData.nodes.slice(0, 5),
              links: graphData.links.slice(0, 5),
              tags: graphData.tags.slice(0, 5),
            })
          } catch (error) {
            console.error("Error generating research pocket page:", error)
          }

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
