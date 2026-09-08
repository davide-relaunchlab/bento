// SPDX-License-Identifier: MIT
import { t } from './i18n.ts'
import { completeFunction, formulaContext, functionSuggestions, FUNCTION_ARGS } from './formulahints.ts'
import { argumentLabel } from './formulaargs.ts'

type Editor = HTMLInputElement | HTMLElement
let serial = 0
export interface FormulaAssist { update(): void; handleKey(e: KeyboardEvent): boolean; destroy(): void }

/** Only edits the draft. Existing cell/bar/dialog handlers retain ownership of save. */
export function attachFormulaAssist(editor: Editor, expression = false): FormulaAssist {
  const id = `dx-functions-${++serial}`
  const popup = document.createElement('div')
  popup.className = 'dx-formula-assist'
  popup.id = `${id}-help`
  const attrs = ['role', 'aria-autocomplete', 'aria-expanded', 'aria-controls', 'aria-activedescendant', 'aria-describedby']
  const original = new Map(attrs.map(key => [key, editor.getAttribute(key)]))
  let names: string[] = [], selected = 0, prefix = '', dismissed = false, composing = false, dead = false
  let tracking = false
  const isInput = editor instanceof HTMLInputElement
  const read = () => isInput ? editor.value : editor.textContent ?? ''
  function caret(): number {
    if (isInput) return editor.selectionStart ?? read().length
    const selection = getSelection()
    if (!selection?.rangeCount || !editor.contains(selection.focusNode)) return read().length
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.setEnd(selection.focusNode!, selection.focusOffset)
    return range.toString().length
  }
  function write(text: string, pos: number): void {
    if (isInput) { editor.value = text; editor.setSelectionRange(pos, pos) }
    else {
      editor.textContent = text
      const range = document.createRange()
      range.setStart(editor.firstChild ?? editor, pos); range.collapse(true)
      getSelection()?.removeAllRanges(); getSelection()?.addRange(range)
    }
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  }
  function restore(): void {
    for (const [key, value] of original) value === null ? editor.removeAttribute(key) : editor.setAttribute(key, value)
  }
  const observer = new MutationObserver(() => { if (!editor.isConnected) destroy() })
  function hide(): void {
    popup.remove(); names = []; restore()
    if (tracking) {
      tracking = false
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
      observer.disconnect()
    }
  }
  function position(): void {
    if (!popup.isConnected) return
    if (!editor.isConnected) { destroy(); return }
    const rect = editor.getBoundingClientRect()
    const viewport = window.visualViewport
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0
    const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight
    popup.style.maxWidth = `${Math.max(160, width - 16)}px`
    popup.style.maxHeight = `${Math.max(90, height - 20)}px`
    const box = popup.getBoundingClientRect()
    popup.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - box.width - 8))}px`
    const y = rect.bottom + 4 + box.height <= top + height - 8 ? rect.bottom + 4 : rect.top - box.height - 4
    popup.style.top = `${Math.max(top + 8, Math.min(y, top + height - box.height - 8))}px`
  }
  function syntax(name: string, active = -1): HTMLElement {
    const line = document.createElement('div')
    line.className = 'dx-function-syntax'
    line.append(`${name}(`)
    const args = FUNCTION_ARGS[name] ?? []
    args.forEach((arg, index) => {
      if (index) line.append(', ')
      const span = document.createElement('span')
      span.textContent = argumentLabel(arg)
      if (index === active || (arg === '…' && active >= index)) span.className = 'dx-function-argument'
      line.append(span)
    })
    line.append(')')
    return line
  }
  function accept(index: number): void {
    const result = completeFunction(read(), caret(), names[index], expression)
    if (!result) return
    dismissed = false
    write(result.text, result.caret)
    update()
  }
  function update(): void {
    if (dead) return
    if (document.activeElement !== editor || dismissed || composing || (isInput && (editor.readOnly || editor.disabled))) { hide(); return }
    // A selected expression must keep native Tab/navigation semantics.
    if (isInput ? editor.selectionStart !== editor.selectionEnd : !getSelection()?.isCollapsed) { hide(); return }
    const ctx = formulaContext(read(), caret(), expression)
    const nextPrefix = ctx.completion?.prefix ?? '\0'
    if (nextPrefix !== prefix) selected = 0
    prefix = nextPrefix
    names = ctx.completion ? functionSuggestions(ctx.completion.prefix) : []
    if (!names.length && !ctx.call) { hide(); return }
    selected = Math.min(selected, names.length - 1)
    popup.replaceChildren()
    if (names.length) {
      const heading = document.createElement('div')
      heading.className = 'dx-function-heading'
      heading.textContent = t('Functions')
      const keys = document.createElement('span')
      keys.textContent = '↑ ↓ · Tab / Enter'
      heading.append(keys); popup.append(heading)
      const list = document.createElement('div')
      list.className = 'dx-function-list'; list.id = id
      list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', t('Functions'))
      names.forEach((name, i) => {
        const option = document.createElement('div')
        option.className = 'dx-function-option'; option.id = `${id}-${i}`
        option.setAttribute('role', 'option'); option.setAttribute('aria-selected', String(i === selected))
        option.setAttribute('aria-label', name)
        option.append(syntax(name))
        option.addEventListener('pointerdown', event => event.preventDefault())
        option.addEventListener('click', () => accept(i))
        list.append(option)
      })
      popup.append(list)
      editor.setAttribute('role', 'combobox'); editor.setAttribute('aria-autocomplete', 'list')
      editor.setAttribute('aria-expanded', 'true'); editor.setAttribute('aria-controls', id)
      editor.setAttribute('aria-activedescendant', `${id}-${selected}`)
    } else restore()
    if (ctx.call) {
      const help = document.createElement('div'); help.className = 'dx-function-help'
      help.setAttribute('role', 'status'); help.setAttribute('aria-live', 'polite')
      help.append(syntax(ctx.call.name, ctx.call.argument)); popup.append(help)
    }
    const note = document.createElement('div'); note.className = 'dx-function-note'
    note.textContent = t('Separate arguments with commas. [ ] marks optional arguments.')
    popup.append(note)
    editor.setAttribute('aria-describedby', [original.get('aria-describedby'), popup.id].filter(Boolean).join(' '))
    if (!popup.isConnected) {
      // Keep suggestions inside a modal's accessibility scope when relevant.
      (editor.closest('[role="dialog"]') ?? document.body).append(popup)
    }
    if (!tracking) {
      tracking = true
      document.addEventListener('selectionchange', update)
      window.addEventListener('resize', position); window.addEventListener('scroll', position, true)
      window.visualViewport?.addEventListener('resize', position); window.visualViewport?.addEventListener('scroll', position)
      observer.observe(document.body, { childList: true, subtree: true })
    }
    position()
    popup.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }
  function handleKey(e: KeyboardEvent): boolean {
    if (e.isComposing || composing || e.keyCode === 229) return false
    if (!popup.isConnected) return false
    if (e.key === 'Escape') { dismissed = true; hide() }
    else if (names.length && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        selected = (selected + (e.key === 'ArrowDown' ? 1 : names.length - 1)) % names.length
        update()
      } else accept(selected)
    } else return false
    e.preventDefault(); e.stopImmediatePropagation(); return true
  }
  const changed = () => { dismissed = false; update() }
  const startComposition = () => { composing = true; hide() }
  const endComposition = () => { composing = false; changed() }
  const keyup = (e: KeyboardEvent) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) changed() }
  const onKey = (e: Event) => handleKey(e as KeyboardEvent)
  editor.addEventListener('input', changed); editor.addEventListener('focus', changed)
  editor.addEventListener('click', changed); editor.addEventListener('blur', hide)
  editor.addEventListener('keydown', onKey, true); editor.addEventListener('keyup', keyup as EventListener)
  editor.addEventListener('compositionstart', startComposition); editor.addEventListener('compositionend', endComposition)
  function destroy(): void {
    if (dead) return
    dead = true; hide()
    editor.removeEventListener('input', changed); editor.removeEventListener('focus', changed)
    editor.removeEventListener('click', changed); editor.removeEventListener('blur', hide)
    editor.removeEventListener('keydown', onKey, true); editor.removeEventListener('keyup', keyup as EventListener)
    editor.removeEventListener('compositionstart', startComposition); editor.removeEventListener('compositionend', endComposition)
  }
  update() // An inline editor may already contain the programmatically seeded '='.
  return { update, handleKey, destroy }
}
