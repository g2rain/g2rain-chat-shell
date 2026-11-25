import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

export function createMarkdown(): MarkdownIt {
  const md = new MarkdownIt({ html: false, breaks: true, linkify: true }).disable('code')
  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    tokens[idx].attrSet('target', '_blank')
    tokens[idx].attrSet('rel', 'noopener noreferrer')
    return self.renderToken(tokens, idx, options)
  }
  return md
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] })
}

export function renderSafe(md: MarkdownIt, content: string): string {
  return sanitizeHtml(md.render(content))
}
