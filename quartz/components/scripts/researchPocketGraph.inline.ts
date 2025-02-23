import { Application, Container, Graphics, Text, FederatedPointerEvent } from "pixi.js"
import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  zoom,
  select,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3"

interface Node extends SimulationNodeDatum {
  id: string
  text: string
  tags: string[]
  note: string
  folder: string
  url: string
  created: number
}

interface LinkDatum extends SimulationLinkDatum<Node> {
  value: number
  tags: string[]
}

const renderResearchPocketGraph = async () => {
  const container = document.getElementById("research-pocket-graph-container")
  if (!container) return

  try {
    const response = await fetch("/static/research-pocket-graph.json")
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const graphData = await response.json()

    container.innerHTML = ""
    container.style.minHeight = "800px"

    const rect = container.getBoundingClientRect()
    const width = rect.width
    const height = Math.max(rect.height, 800)

    const computedStyle = getComputedStyle(document.documentElement)
    const colors = {
      secondary: computedStyle.getPropertyValue("--secondary"),
      tertiary: computedStyle.getPropertyValue("--tertiary"),
      gray: computedStyle.getPropertyValue("--gray"),
      light: computedStyle.getPropertyValue("--light"),
      dark: computedStyle.getPropertyValue("--dark"),
      bodyFont: computedStyle.getPropertyValue("--bodyFont"),
    }

    const app = new Application()
    await app.init({
      width,
      height,
      antialias: true,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio,
      preference: "webgpu",
      powerPreference: "high-performance",
      clearBeforeRender: true,
    })

    container.appendChild(app.canvas)

    const createText = (options: {text: string, fontSize: number, wordWrapWidth?: number}) => {
      return new Text({
        text: options.text,
        style: {
          fontSize: options.fontSize,
          fill: colors.dark,
          fontFamily: colors.bodyFont,
          wordWrap: Boolean(options.wordWrapWidth),
          wordWrapWidth: options.wordWrapWidth,
          padding: 4,
        },
        resolution: 2,
      })
    }

    const nodes: Node[] = graphData.nodes
    const nodeMap = new Map(nodes.map((node) => [node.id, node]))

    const links: LinkDatum[] = graphData.links.map((link: any) => ({
      source: nodeMap.get(link.source) as Node,
      target: nodeMap.get(link.target) as Node,
      value: link.value,
      tags: link.tags,
    }))

    const stage = new Container()
    const linksContainer = new Container()
    const nodesContainer = new Container()
    stage.addChild(linksContainer, nodesContainer)
    app.stage.addChild(stage)

    const linkGraphics = links.map(() => {
      const graphics = new Graphics()
      linksContainer.addChild(graphics)
      return graphics
    })

    let activeNode: Node | null = null

    nodes.forEach((node) => {
      const graphics = new Graphics()
      const text = createText({
        text: node.text,
        fontSize: 16,
        wordWrapWidth: 100,
      })

      graphics
        .circle(0, 0, 20)
        .fill({ color: colors.secondary, alpha: 0.9 })
        .stroke({ width: 2, color: colors.light, alpha: 0.8 })

      text.anchor.set(0.5, 2)

      const nodeContainer = new Container()
      nodeContainer.addChild(graphics, text)
      nodesContainer.addChild(nodeContainer)

      const tooltip = createText({
        text: node.note,
        fontSize: 14,
        wordWrapWidth: 200,
      })
      tooltip.visible = false
      nodeContainer.addChild(tooltip)
      tooltip.position.set(30, -20)

      nodeContainer.eventMode = "static"
      nodeContainer.cursor = "pointer"

      nodeContainer.on("pointerover", () => {
        if (!activeNode) {
          graphics.scale.set(1.2)
          text.style.fontSize = 18
          tooltip.visible = true
        }
      })

      nodeContainer.on("pointerout", () => {
        if (!activeNode || activeNode !== node) {
          graphics.scale.set(1)
          text.style.fontSize = 16
          tooltip.visible = false
        }
      })

      nodeContainer.on("click", () => {
        if (node.url) {
          window.open(node.url, "_blank")
        }
      })

      let isDragging = false
      let dragData: { x: number; y: number } | null = null

      nodeContainer.on("pointerdown", (event: FederatedPointerEvent) => {
        event.stopPropagation()
        isDragging = true
        activeNode = node
        simulation.alphaTarget(0.3).restart()
        dragData = { x: event.globalX, y: event.globalY }
        node.fx = node.x
        node.fy = node.y
      })

      nodeContainer.on("pointermove", (event: FederatedPointerEvent) => {
        if (!isDragging || !dragData || activeNode !== node) return

        const dx = event.globalX - dragData.x
        const dy = event.globalY - dragData.y

        node.fx = (node.fx ?? 0) + dx / stage.scale.x
        node.fy = (node.fy ?? 0) + dy / stage.scale.y

        dragData = { x: event.globalX, y: event.globalY }
      })

      const endDrag = () => {
        if (!isDragging || activeNode !== node) return
        isDragging = false
        activeNode = null
        dragData = null
        node.fx = null
        node.fy = null
        simulation.alphaTarget(0)
      }

      nodeContainer.on("pointerup", endDrag)
      nodeContainer.on("pointerupoutside", endDrag)
    })

    const simulation = forceSimulation(nodes)
      .force("charge", forceManyBody().strength(-1000))
      .force("center", forceCenter(width / 2, height / 2))
      .force("link", forceLink(links).distance(100))

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        const { k, x, y } = event.transform
        stage.scale.set(k)
        stage.position.set(x, y)
        needsRender = true
      })

    select(app.canvas)
      .call(zoomBehavior)
      .on("wheel", (event) => {
        event.preventDefault()
      })

    app.canvas.style.touchAction = "none"

    let needsRender = false
    simulation.on("tick", () => {
      needsRender = true
    })

    const animate = () => {
      if (needsRender) {
        links.forEach((link, i) => {
          const graphics = linkGraphics[i]
          const sourceNode = link.source as Node
          const targetNode = link.target as Node

          graphics.clear()
          graphics
            .moveTo(sourceNode.x!, sourceNode.y!)
            .lineTo(targetNode.x!, targetNode.y!)
            .stroke({ width: Math.min(link.value, 3), color: colors.gray, alpha: 0.6 })
        })

        nodes.forEach((node, i) => {
          nodesContainer.children[i].position.set(node.x!, node.y!)
        })

        app.renderer.render(stage)
        needsRender = false
      }
      requestAnimationFrame(animate)
    }
    animate()

    const resizeHandler = () => {
      const newRect = container.getBoundingClientRect()
      const newWidth = newRect.width
      const newHeight = Math.max(newRect.height, 800)

      app.renderer.resize(newWidth, newHeight)
      simulation.force("center", forceCenter(newWidth / 2, newHeight / 2))
      simulation.alpha(0.3).restart()
      needsRender = true
    }

    window.addEventListener("resize", resizeHandler)
    const cleanup = () => {
      window.removeEventListener("resize", resizeHandler)
      app.destroy(true, { children: true, texture: true, textureSource: true })
    }

    window.addCleanup?.(() => cleanup())
  } catch (error) {
    console.error("Error loading research pocket graph:", error)
    container.innerHTML = `<div class='error-state'>Error loading graph: ${error instanceof Error ? error.message : "Unknown error"}</div>`
  }
}

document.addEventListener("nav", () => {
  renderResearchPocketGraph()
})
