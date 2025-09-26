import React, { useEffect, useRef } from 'react'
import CircularText from './CircularText'

const SimpleLandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">

      {/* Top-left circular text badge */}
      <div className="absolute left-20 top-10 z-[10000]">
        <CircularText
          text="KOCHI*METRO*RAIL*LIMITED*"
          onHover="speedUp"
          spinDuration={24}
          className="select-none uppercase tracking-wide small"
          style={{ width: 120, height: 120, color: '#0ea5e9', fontFamily: 'Segoe UI, Inter, system-ui, -apple-system, Roboto, sans-serif' }}
        />
      </div>

      {/* Multi-layer Parallax Section */}
      <section className="relative parallax-viewport">
        <div
          className="parallax-stage parallax-container"
          id="parallaxContainer"
          ref={useRef<HTMLDivElement>(null)}
        >
          {/* Multi-layer depth-based parallax composition */}
          <img src="https://kochimetro.org/wp-content/uploads/2018/01/roads.png" className="layer roads" style={{ ['--depth' as any]: 1 }} alt="Roads" />
          <img src="https://kochimetro.org/wp-content/uploads/2018/01/building-back-right.png" className="layer buildingBack" style={{ ['--depth' as any]: 2 }} alt="Building Back" />
          <img src="https://kochimetro.org/wp-content/uploads/2018/01/building-front.png" className="layer buildingFront" style={{ ['--depth' as any]: 3 }} alt="Building Front" />
          <img src="https://kochimetro.org/wp-content/uploads/2018/01/sun-rise.png" className="layer sunrise" style={{ ['--depth' as any]: 4 }} alt="Sunrise" />
          <img src="https://kochimetro.org/wp-content/uploads/2018/01/train.png" className="layer train" style={{ ['--depth' as any]: 7 }} alt="Train" />
          <img src="/shedule.png" className="layer boat" style={{ ['--depth' as any]: 5, width: '180px' }} alt="Boat" />
          <img src="https://kochimetro.org/wp-content/uploads/2018/01/clock-icon.png" className="layer clock" style={{ ['--depth' as any]: 5 }} alt="Clock" />
          <img src="/RL.png" className="layer rl" style={{ ['--depth' as any]: 6 }} alt="RL graphic" />
          <img src="/dashboard.png" className="layer label" style={{ ['--depth' as any]: 6, width: '240px' }} alt="Label" />
        </div>
      </section>

      {/* Parallax handler */}
      {(() => {
        const containerRef = useRef<HTMLDivElement | null>(null)
        useEffect(() => {
          const container = document.getElementById('parallaxContainer') as HTMLDivElement | null
          if (!container) return

          const handleMove = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect()
            const w = rect.width
            const h = rect.height
            const x = ((e.clientX - rect.left) / w - 0.5) * 2
            const y = 0 // lock vertical motion
            const images = container.querySelectorAll<HTMLElement>('.layer')
            images.forEach((img) => {
              const depthValue = Number((img as HTMLElement).style.getPropertyValue('--depth')) || 1
              const sensitivity = 10 // lower value = less movement
              img.style.transform = `translate(${x * depthValue * sensitivity}px, ${y}px)`
            })
          }

          container.addEventListener('mousemove', handleMove)
          return () => {
            container.removeEventListener('mousemove', handleMove)
          }
        }, [])
        
        useEffect(() => {
          const viewport = document.querySelector('.parallax-viewport') as HTMLElement | null
          const stage = document.querySelector('.parallax-stage') as HTMLElement | null
          if (!viewport || !stage) return

          const designWidth = 1248
          const designHeight = 612
          const updateScale = () => {
            // Increase width usage while keeping height within viewport
            const scaleX = (viewport.clientWidth / designWidth) * 1.75
            const scaleY = viewport.clientHeight / designHeight
            const scale = Math.min(scaleX, scaleY)
            stage.style.setProperty('--ml-scale', String(scale))
            const stageWidth = designWidth * scale
            const stageHeight = designHeight * scale
            // Centered base position
            const baseTop = (viewport.clientHeight - stageHeight) / 2
            const baseLeft = (viewport.clientWidth - stageWidth) / 2
            // Pin near the top below navbar with a small safe gap
            const navbarHeight = 64
            const safeGap = -12
            const desiredTop = navbarHeight + safeGap
            const offsetY = desiredTop - baseTop - 72
            // Shift further to the right to balance margins (increase right bias)
            const biasRight = Math.max(viewport.clientWidth * 0.18, 120)
            const offsetX = baseLeft + biasRight
            stage.style.setProperty('--ml-offset-x', `${offsetX}px`)
            stage.style.setProperty('--ml-offset-y', `${offsetY}px`)
          }
          updateScale()
          window.addEventListener('resize', updateScale)
          return () => window.removeEventListener('resize', updateScale)
        }, [])
        return null
      })()}

      {/* Spacer */}
      <div className="h-8" />
    </div>
  )
}

export default SimpleLandingPage


