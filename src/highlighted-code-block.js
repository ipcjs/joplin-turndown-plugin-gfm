const highlightRegExp = /highlight-(?:text|source)-([a-z0-9]+)/

export default function highlightedCodeBlock (turndownService) {
  turndownService.addRule('highlightedCodeBlock', {
    filter: function (node) {
      const firstChild = node.firstChild
      return (
        node.nodeName === 'DIV' &&
        highlightRegExp.test(node.className) &&
        firstChild &&
        firstChild.nodeName === 'PRE'
      )
    },
    replacement: function (content, node, options) {
      const className = node.className || ''
      const language = (className.match(highlightRegExp) || [null, ''])[1]

      return (
        '\n\n' + options.fence + language + '\n' +
        node.firstChild.textContent +
        '\n' + options.fence + '\n\n'
      )
    }
  })
}
