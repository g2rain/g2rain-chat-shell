<template>
  <div class="chart-frame">
    <div v-if="!spec" class="chart-error">
      <pre><code>{{ raw }}</code></pre>
    </div>
    <div v-else ref="host" class="chart" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts/core'
import type { EChartsOption, SeriesOption } from 'echarts'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TitleComponent, TooltipComponent, CanvasRenderer])

type ChartSpec = {
  kind: 'BAR' | 'LINE' | 'PIE'
  title: string
  categories: string[]
  series: { name: string; values: number[] }[]
  unit?: string
}

function parseChart(raw: string): ChartSpec | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const candidate = value as Record<string, unknown>
    if (!['BAR', 'LINE', 'PIE'].includes(String(candidate.kind))) return null
    if (typeof candidate.title !== 'string' || !Array.isArray(candidate.categories) || !candidate.categories.every((item) => typeof item === 'string')) return null
    const categories = candidate.categories as string[]
    if (!Array.isArray(candidate.series) || candidate.series.length === 0) return null
    const series = candidate.series.map((item): ChartSpec['series'][number] | null => {
      if (typeof item !== 'object' || item === null) return null
      const entry = item as Record<string, unknown>
      if (typeof entry.name !== 'string' || !Array.isArray(entry.values) || !entry.values.every((number) => typeof number === 'number' && Number.isFinite(number))) return null
      return { name: entry.name, values: entry.values }
    })
    if (series.some((item) => item === null) || series.some((item) => item?.values.length !== categories.length)) return null
    if (candidate.unit !== undefined && typeof candidate.unit !== 'string') return null
    return {
      kind: candidate.kind as ChartSpec['kind'],
      title: candidate.title,
      categories,
      series: series as ChartSpec['series'],
      unit: candidate.unit as string | undefined,
    }
  } catch {
    return null
  }
}

const props = defineProps<{ raw: string }>()
const spec = parseChart(props.raw)
const host = ref<HTMLElement>()
let chart: echarts.ECharts | undefined
let resizeObserver: ResizeObserver | undefined
let themeObserver: MutationObserver | undefined

function chartColors(element: HTMLElement) {
  const style = getComputedStyle(element)
  return {
    colors: ['--g2-color-primary', '--g2-color-success', '--g2-color-warning', '--g2-color-danger']
      .map((name) => style.getPropertyValue(name).trim())
      .filter(Boolean),
    text: style.getPropertyValue('--g2-text-primary').trim(),
    border: style.getPropertyValue('--g2-border-color').trim(),
  }
}

function pieOption(data: ChartSpec, colors: ReturnType<typeof chartColors>): EChartsOption {
  const first = data.series[0]
  const series: SeriesOption[] = [{
    type: 'pie',
    radius: '62%',
    name: first.name,
    data: data.categories.map((name, index) => ({ name, value: first.values[index] })),
  }]
  return {
    color: colors.colors,
    title: { text: data.title, left: 'center', textStyle: { color: colors.text } },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: colors.text } },
    series,
  }
}

function axisOption(data: ChartSpec, colors: ReturnType<typeof chartColors>): EChartsOption {
  const series: SeriesOption[] = data.series.map((item) => ({
    name: item.name,
    type: data.kind === 'BAR' ? 'bar' : 'line',
    data: item.values,
  }))
  return {
    color: colors.colors,
    title: { text: data.title, left: 'center', textStyle: { color: colors.text } },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { color: colors.text } },
    grid: { left: 48, right: 20, top: 55, bottom: 48 },
    xAxis: { type: 'category', data: data.categories, axisLabel: { color: colors.text }, axisLine: { lineStyle: { color: colors.border } } },
    yAxis: { type: 'value', name: data.unit, axisLabel: { color: colors.text }, splitLine: { lineStyle: { color: colors.border } } },
    series,
  }
}

function renderChart(): void {
  if (!host.value || !spec) return
  const colors = chartColors(host.value)
  chart ??= echarts.init(host.value)
  chart.setOption(spec.kind === 'PIE' ? pieOption(spec, colors) : axisOption(spec, colors))
  chart.resize()
}

onMounted(() => {
  if (!spec || !host.value) return
  renderChart()
  resizeObserver = new ResizeObserver(renderChart)
  resizeObserver.observe(host.value)
  themeObserver = new MutationObserver(renderChart)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-g2-theme', 'class'] })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  chart?.dispose()
  chart = undefined
})
</script>

<style scoped>
.chart-frame {
  width: 100%;
  min-height: 300px;
  border: 1px solid var(--g2-border-color);
  border-radius: 8px;
  color: var(--g2-text-primary);
  background: var(--g2-bg-container);
}

.chart {
  height: 320px;
}

.chart-error {
  overflow: auto;
}

.chart-error pre {
  margin: 0;
  padding: 12px;
  color: var(--g2-text-primary);
  background: var(--g2-bg-elevated);
}
</style>
