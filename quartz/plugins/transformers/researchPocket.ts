import { QuartzTransformerPlugin } from "../types"
import { exec } from "child_process"
import { promisify } from "util"
import { parse } from "csv-parse/sync"
import { Root } from "mdast"
import { VFile } from "vfile"

const execAsync = promisify(exec)

interface ResearchPocketItem {
  id: string
  folder: string
  url: string
  title: string
  note: string
  tags: string[]
  created: number
}

export const ResearchPocket: QuartzTransformerPlugin = () => {
  let cachedItems: ResearchPocketItem[] | undefined

  return {
    name: "ResearchPocket",
    markdownPlugins() {
      return [
        () => async (_tree: Root, file: VFile) => {
          if (!cachedItems) {
            try {
              const { stdout } = await execAsync(
                "/home/origami/Dev/projects/rust/pocket-research/target/debug/research --db  /home/origami/Dev/projects/rust/my-list/research.sqlite export --raindrop -"
              )

              cachedItems = parse(stdout, {
                columns: true,
                cast: (value, context) => {
                  if (context.column === "tags") {
                    return value ? value.split(",").map((tag: string) => tag.trim()) : []
                  }
                  if (context.column === "created") {
                    return parseInt(value)
                  }
                  return value
                },
                skip_empty_lines: true,
              }) as ResearchPocketItem[]
            } catch (error) {
              console.error("Error fetching research pocket data:", error)
              cachedItems = []
            }
          }

          file.data.researchPocketItems = cachedItems
        },
      ]
    },
  }
}

// Add type declaration for the new data field
declare module "vfile" {
  interface DataMap {
    researchPocketItems: ResearchPocketItem[]
  }
}
