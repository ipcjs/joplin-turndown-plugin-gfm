var indexOf = Array.prototype.indexOf
var every = Array.prototype.every
var rules = {}
const alignMap = { left: ':--', right: '--:', center: ':-:', default: '---' }

// We need to cache the result of tableShouldBeSkipped() as it is expensive.
// Caching it means we went from about 9000 ms for rendering down to 90 ms.
// Fixes https://github.com/laurent22/joplin/issues/6736
const tableShouldBeSkippedCache_ = new WeakMap()

rules.tableCell = {
  filter: ['th', 'td'],
  replacement: function (content, node) {
    if (tableShouldBeSkipped(nodeParentTable(node))) return content
    return cell(content, node)
  }
}

rules.tableRow = {
  filter: 'tr',
  replacement: function (content, /** @type {HTMLElement} */node) {
    const parentTable = nodeParentTable(node)
    if (tableShouldBeSkipped(parentTable)) return content

    var borderCells = ''

    if (isHeadingRow(node)) {
      const colCount = tableColCount(parentTable)
      for (var i = 0; i < colCount; i++) {
        const childNode = i < node.childNodes.length ? node.childNodes[i] : null
        var border = alignMap.default
        var align = childNode ? (childNode.getAttribute('align') || '').toLowerCase() : ''

        if (align) border = alignMap[align] || border

        if (childNode) {
          borderCells += cell(border, node.childNodes[i])
        } else {
          borderCells += cell(border, null, i)
        }
      }
    }
    return '\n' + content + (borderCells ? '\n' + borderCells : '')
  }
}

rules.table = {
  // Only convert tables with a heading row.
  // Tables with no heading row are kept using `keep` (see below).
  filter: function (node) {
    return node.nodeName === 'TABLE'
  },

  replacement: function (/** @type {string} */content, node) {
    if (tableShouldBeSkipped(node)) return content

    // Ensure there are no blank lines
    content = content.replace(/\n+/g, '\n')

    // If table has no heading, add an empty one so as to get a valid Markdown table
    var secondLine = content.trim().split('\n')
    if (secondLine.length >= 2) secondLine = secondLine[1]
    var secondLineIsDivider = Object.values(alignMap).some((align) => secondLine.startsWith(`| ${align}`))

    var columnCount = tableColCount(node)
    var emptyHeader = ''
    if (columnCount && !secondLineIsDivider) {
      emptyHeader = '|' + '     |'.repeat(columnCount) + '\n' + '|' + ' --- |'.repeat(columnCount)
    }

    return '\n\n' + emptyHeader + content + '\n\n'
  }
}

rules.tableCaption = {
  filter: ['caption'],
  replacement: () => ''
}

rules.tableColgroup = {
  filter: ['colgroup', 'col'],
  replacement: (content, node) => {
    return ''
  }
}

rules.tableSection = {
  filter: ['thead', 'tbody', 'tfoot'],
  replacement: function (content) {
    return content
  }
}

// A tr is a heading row if:
// - the parent is a THEAD
// - or if its the first child of the TABLE or the first TBODY (possibly
//   following a blank THEAD)
// - and every cell is a TH
function isHeadingRow (tr) {
  var parentNode = tr.parentNode
  return (
    parentNode.nodeName === 'THEAD' ||
    (
      parentNode.firstChild === tr &&
      (parentNode.nodeName === 'TABLE' || isFirstTbody(parentNode)) &&
      every.call(tr.childNodes, (/** @type {HTMLElement} */n) => {
        if (n.nodeName === 'TH') {
          return true
        }

        if (n.nodeName === 'TD' &&
          n.childNodes.length === 1 && n.childNodes[0].nodeName === 'DIV' &&
          n.childNodes[0].childNodes.length === 1 && n.childNodes[0].childNodes[0].nodeName === 'SPAN') {
            /** @type {HTMLSpanElement} */
          const span = n.childNodes[0].childNodes[0]

          return span.style.fontWeight === 'bold'
        }
        return false
      })
    )
  )
}

function isFirstTbody (/** @type {HTMLElement} */element) {
  var previousSibling = element.previousElementSibling
  return (
    element.nodeName === 'TBODY' && (
      !previousSibling ||
      (
        (previousSibling.nodeName === 'THEAD' || previousSibling.nodeName === 'COLGROUP') &&
        /^\s*$/i.test(previousSibling.textContent)
      )
    )
  )
}

function cell (content, node = null, index = null) {
  if (index === null) index = indexOf.call(node.parentNode.childNodes, node)
  var prefix = ' '
  if (index === 0) prefix = '| '
  let filteredContent = content.trim().replace(/\n\r/g, '<br>').replace(/\n/g, '<br>')
  filteredContent = filteredContent.replace(/\|/g, '\\|')
  while (filteredContent.length < 3) filteredContent += ' '
  if (node) filteredContent = handleColSpan(filteredContent, node, ' ')
  return prefix + filteredContent + ' |'
}

function nodeContainsTable (node) {
  if (!node.childNodes) return false

  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i]
    if (child.nodeName === 'TABLE') return true
    if (nodeContainsTable(child)) return true
  }
  return false
}

// Various conditions under which a table should be skipped - i.e. each cell
// will be rendered one after the other as if they were paragraphs.
function tableShouldBeSkipped (tableNode) {
  const cached = tableShouldBeSkippedCache_.get(tableNode)
  if (cached !== undefined) return cached

  const result = tableShouldBeSkipped_(tableNode)

  tableShouldBeSkippedCache_.set(tableNode, result)
  return result
}

function tableShouldBeSkipped_ (tableNode) {
  if (!tableNode) return true
  if (!tableNode.rows) return true
  if (tableNode.rows.length === 1 && tableNode.rows[0].childNodes.length <= 1) return true // Table with only one cell
  if (nodeContainsTable(tableNode)) return true
  return false
}

function nodeParentTable (node) {
  let parent = node.parentNode
  while (parent.nodeName !== 'TABLE') {
    parent = parent.parentNode
    if (!parent) return null
  }
  return parent
}

function handleColSpan (content, node, emptyChar) {
  const colspan = node.getAttribute('colspan') || 1
  for (let i = 1; i < colspan; i++) {
    content += ' | ' + emptyChar.repeat(3)
  }
  return content
}

function tableColCount (node) {
  let maxColCount = 0
  for (let i = 0; i < node.rows.length; i++) {
    const row = node.rows[i]
    const colCount = row.childNodes.length
    if (colCount > maxColCount) maxColCount = colCount
  }
  return maxColCount
}

export default function tables (turndownService) {
  turndownService.keep(function (node) {
    return node.nodeName === 'TABLE'
  })
  for (var key in rules) turndownService.addRule(key, rules[key])
}
