import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { loadHostMarkdownText, type HostMarkdownLabels } from './host-markdown'

const IMAGE = /^!\[([^\]\n]*)\](?:\([^)\n]*\)|\[[^\]\n]*\])/

/** 旁问不加载远程图片。代码块和行内代码里的写法保持原样。 */
export function neutralizeMarkdownImages(source: string, emptyAlt = ''): string {
  let out = ''
  let index = 0
  while (index < source.length) {
    const fence = source.startsWith('```', index) ? '```' : source.startsWith('~~~', index) ? '~~~' : ''
    if (fence) {
      const end = source.indexOf(fence, index + fence.length)
      if (end === -1) return out + source.slice(index)
      out += source.slice(index, end + fence.length)
      index = end + fence.length
      continue
    }
    if (source[index] === '`') {
      let width = 0
      while (source[index + width] === '`') width += 1
      const fence = '`'.repeat(width)
      const end = source.indexOf(fence, index + width)
      if (end === -1) return out + source.slice(index)
      out += source.slice(index, end + width)
      index = end + width
      continue
    }
    const image = IMAGE.exec(source.slice(index))
    if (image) {
      out += image[1] || emptyAlt
      index += image[0].length
      continue
    }
    out += source[index]
    index += 1
  }
  return out
}

function FallbackMarkdown({ text }: { text: string }): React.JSX.Element {
  return <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: props => <a href={props.href} target="_blank" rel="noreferrer noopener">{props.children}</a>,
    img: () => null,
  }}>{text}</Markdown>
}

class AnswerBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true } }
  render(): React.ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function AnswerMarkdown({ text, labels, imageLabel }: { text: string; labels: HostMarkdownLabels; imageLabel: string }): React.JSX.Element {
  const safe = neutralizeMarkdownImages(text, imageLabel)
  const fallback = <FallbackMarkdown text={safe} />
  const Host = loadHostMarkdownText()
  if (!Host) return fallback
  return <AnswerBoundary key={safe} fallback={fallback}><Host text={safe} streaming={false} labels={labels} variant="compact" /></AnswerBoundary>
}
