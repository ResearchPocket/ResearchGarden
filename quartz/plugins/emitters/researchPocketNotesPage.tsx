import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import { FullPageLayout } from "../../cfg"
import { FilePath, FullSlug, joinSegments } from "../../util/path"
import {
  defaultListPageLayout,
  sharedPageComponents,
} from "../../../quartz.layout"
import { write } from "./helpers"
import { pageResources, renderPage } from "../../components/renderPage"
import { defaultProcessedContent } from "../vfile"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import DepGraph from "../../depgraph"
import ResearchPocketNotesList from "../../components/pages/ResearchPocketNotesList"

interface ResearchPocketNotesPageOptions extends FullPageLayout { }

export const ResearchPocketNotesPage: QuartzEmitterPlugin<ResearchPocketNotesPageOptions> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    pageBody: ResearchPocketNotesList(),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "ResearchPocketNotesPage",
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
      const items = content[0]?.[1]?.data?.researchPocketItems
      if (!items || items.length === 0) {
        console.warn("No research pocket items found")
        return graph
      }
      const src = joinSegments(ctx.argv.output, "garden" + ".html") as FilePath
      for (const item of items) {
        if (item.note && item.note.trim() !== '') {
          const dst = joinSegments(ctx.argv.output, "garden", "notes", `${ item.id }.html`) as FilePath
          graph.addEdge(src, dst)
        }
      }
      return graph
    },

    async emit(ctx, content, resources): Promise<FilePath[]> {
      const cfg = ctx.cfg.configuration
      const outputFiles: FilePath[] = []

      // Get the data from the transform phase
      const items = content[0]?.[1]?.data?.researchPocketItems
      if (!items || items.length === 0) {
        console.warn("No research pocket items found")
        return []
      }

      // Filter items with non-empty notes
      const itemsWithNotes = items.filter(item => item.note && item.note.trim() !== '')

      // Create individual pages for each item with notes
      for (const item of itemsWithNotes) {
        const slug = `garden/notes/${ item.id }` as FullSlug
        const url = new URL(`https://${ cfg.baseUrl ?? "localhost:8080" }`)
        const path = url.pathname as FullSlug

        const content = `# ${ item.title }

## URL
${ item.url }

## Note
${ item.note }

## Tags
${ item.tags.join(', ') }

## Created
${ new Date(item.created * 1000).toLocaleString() }`

        const [tree, vfile] = defaultProcessedContent({
          slug,
          frontmatter: {
            title: item.title,
            tags: item.tags,
          },
          text: content,
          description: `Notes for research pocket item: ${ item.title }`,
          keywords: ["research", "pocket", "notes", ...item.tags],
        })
        vfile.data.researchPocketItems = items;

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

        const outPath = joinSegments(ctx.argv.output, slug + ".html") as FilePath
        await write({
          ctx,
          content: await renderPage(
            cfg,
            slug,
            componentData,
            opts,
            externalResources
          ),
          slug,
          ext: ".html",
        })

        outputFiles.push(outPath)
      }
      // Create an index page for all notes
      const indexSlug = "garden/notes" as FullSlug
      const indexContent = `# Research Pocket Notes

${ itemsWithNotes.map(item => `- [${ item.title }](${ item.id }.html)`).join('\n') }`

      const [indexTree, indexVfile] = defaultProcessedContent({
        slug: indexSlug,
        frontmatter: {
          title: "notes",
          tags: ["research-pocket", "notes"],
        },
        text: indexContent,
        description: "Index of all research pocket items with notes",
        keywords: ["research", "pocket", "notes", "index"],
      })

      const indexUrl = new URL(`https://${ cfg.baseUrl ?? "example.com" }`)
      const indexExternalResources = pageResources(indexUrl.pathname as FullSlug, indexVfile.data, resources)
      indexVfile.data.researchPocketItems = items;
      const indexComponentData: QuartzComponentProps = {
        ctx,
        fileData: indexVfile.data,
        externalResources: indexExternalResources,
        cfg,
        children: [],
        tree: indexTree,
        allFiles: [],
      }

      const indexPageContent = await renderPage(
        cfg,
        indexSlug,
        indexComponentData,
        opts,
        indexExternalResources
      )
      const indexOutPath = joinSegments(ctx.argv.output, indexSlug + ".html") as FilePath
      await write({
        ctx,
        content: indexPageContent,
        slug: indexSlug,
        ext: ".html",
      })
      outputFiles.push(indexOutPath)

      return outputFiles
    },
  }
}
