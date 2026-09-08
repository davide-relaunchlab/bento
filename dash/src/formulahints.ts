// SPDX-License-Identifier: MIT
// Syntax describes dash's engine, not an assumed Excel superset.
import { FUNCTIONS } from './formula.ts'

export const FUNCTION_ARGS: Record<string, string[]> = {}
function define(names: string, args: string): void {
  for (const name of names.split(' ')) FUNCTION_ARGS[name] = args ? args.split(',') : []
}
define('VAR VARP STDEVP COUNTUNIQUE MODE SUM AVERAGE AVG MIN MAX COUNT COUNTA COUNTBLANK MEDIAN STDEV PRODUCT TRANSPOSE', 'range')
define('ABS INT CEILING FLOOR SIGN SQRT EXP LN LOG10', 'number')
define('ROUND ROUNDUP ROUNDDOWN', 'number,[digits]')
define('LEN LOWER UPPER TRIM PROPER VALUE DATEVALUE', 'text')
define('ISBLANK ISNUMBER ISTEXT ISERROR NOT', 'value')
define('YEAR MONTH DAY WEEKDAY', 'date')
define('TRUE FALSE TODAY NOW', '')
define('SUMIF AVERAGEIF', 'range,criterion,[result_range]')
define('COUNTIF', 'range,criterion')
define('SUMIFS AVERAGEIFS MINIFS MAXIFS', 'result_range,range1,criterion1,…')
define('COUNTIFS', 'range1,criterion1,…')
define('XLOOKUP', 'value,lookup_range,result_range,[if_missing]')
define('VLOOKUP', 'value,table,column,[approximate]')
define('HLOOKUP', 'value,table,row,[approximate]')
define('INDEX', 'range,row,[column]')
define('MATCH', 'value,range,[approximate]')
define('LOOKUP', 'value,range,[result_range]')
define('NPV', 'rate,cash_flows,…')
define('IRR', 'cash_flows,…')
define('PERCENTILE', 'range,percentile')
define('QUARTILE', 'range,quartile')
define('CORREL', 'range1,range2')
define('RANK', 'number,range,[order]')
define('SUMPRODUCT', 'range1,…')
define('LARGE SMALL', 'range,position')
define('TEXTJOIN', 'delimiter,ignore_empty,text1,…')
define('IFS', 'condition1,result1,…')
define('SWITCH', 'value,match1,result1,…,[default]')
define('AND OR XOR', 'condition1,…')
define('IFERROR IFNA', 'value,fallback')
define('CHOOSE', 'position,value1,…')
define('TEXT', 'value,format')
define('SEARCH', 'find_text,text,[start]')
define('FIND', 'find_text,text')
define('REPLACE', 'text,start,count,new_text')
define('REPT', 'text,count')
define('DATE', 'year,month,day')
define('EOMONTH EDATE', 'date,months')
define('DAYS', 'end_date,start_date')
define('PMT', 'rate,periods,present_value,[future_value],[payment_timing]')
define('FV', 'rate,periods,payment,[present_value],[payment_timing]')
define('PV', 'rate,periods,payment,[future_value],[payment_timing]')
define('IF', 'condition,[if_true],[if_false]')
define('POWER', 'number,exponent')
define('MOD', 'number,divisor')
define('CONCAT CONCATENATE', 'text1,…')
define('LEFT RIGHT', 'text,[count]')
define('MID', 'text,start,count')
define('SUBSTITUTE', 'text,old_text,new_text')
define('SUBTOTAL', 'function_code,range1,…')

const common = ['SUM', 'AVERAGE', 'IF', 'COUNT', 'MIN', 'MAX', 'ROUND', 'XLOOKUP']
export function functionSuggestions(prefix: string): string[] {
  const matches = FUNCTIONS.filter(name => name.startsWith(prefix.toUpperCase()))
  return prefix ? matches : [...common.filter(name => matches.includes(name)), ...matches.filter(name => !common.includes(name))]
}

export interface FormulaContext {
  completion: { start: number; end: number; prefix: string } | null
  call: { name: string; argument: number } | null
}
/** Scan to the caret, skipping quoted text, sheet names and column references. */
export function formulaContext(text: string, caret: number, expression = false): FormulaContext {
  const empty = { completion: null, call: null }
  if (!expression && !/^\s*=/.test(text)) return empty
  const start = /^\s*=/.exec(text)?.[0].length ?? 0
  if (caret < start) return empty
  const stack: Array<{ name: string; argument: number }> = []
  let token = '', tokenStart = start, quoted = ''
  for (let i = start; i < caret; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === quoted) {
        if (quoted !== ']' && text[i + 1] === quoted && i + 1 < caret) i++
        else quoted = ''
      }
      continue
    }
    if (ch === '"' || ch === "'" || ch === '[') { quoted = ch === '[' ? ']' : ch; token = ''; continue }
    if (/[A-Za-z0-9_.]/.test(ch)) {
      if (!token) tokenStart = i
      token += ch
    } else if (ch === '(') {
      stack.push({ name: token.toUpperCase(), argument: 0 }); token = ''
    } else if (ch === ')') { stack.pop(); token = '' }
    else if (ch === ',') { if (stack.length) stack[stack.length - 1].argument++; token = '' }
    else if (!/\s/.test(ch) || (token && !/^\s*\(/.test(text.slice(i)))) token = ''
  }
  // Even inside strings, retain the enclosing function's argument help.
  const call = [...stack].reverse().find(frame => FUNCTIONS.includes(frame.name)) ?? null
  if (quoted) return { completion: null, call }
  const left = text.slice(start, caret)
  const atToken = token && /[A-Za-z0-9_.]$/.test(left)
  const emptyOperand = !left.trim() || /[=(,+\-*/^&<>]\s*$/.test(left)
  // Don't offer MAX while the author is typing a sheet qualifier or $SUM1.
  const before = text.slice(start, tokenStart).trimEnd().slice(-1)
  const end = atToken ? caret + (/^[A-Za-z0-9_.]*/.exec(text.slice(caret))?.[0].length ?? 0) : caret
  const after = text.slice(end).trimStart()[0]
  const wholeToken = text.slice(tokenStart, end)
  const completion = atToken && /^[A-Za-z_][A-Za-z0-9_.]*$/.test(token) &&
    (!/\d/.test(wholeToken) || functionSuggestions(wholeToken).length > 0) &&
    (!before || /[=(,+\-*/^&<>]/.test(before)) && after !== '!'
    ? { start: tokenStart, end, prefix: token }
    // Arguments get quiet syntax help; a list opens once a function prefix is typed.
    : emptyOperand && !stack.length ? { start: caret, end: caret, prefix: '' } : null
  return { completion, call }
}

export function completeFunction(text: string, caret: number, name: string, expression = false): { text: string; caret: number } | null {
  const ctx = formulaContext(text, caret, expression).completion
  if (!ctx || !FUNCTIONS.includes(name)) return null
  const tail = text.slice(ctx.end)
  const existing = /^\s*\(/.exec(tail)
  const insert = name + (existing ? '' : FUNCTION_ARGS[name]?.length === 0 ? '()' : '(')
  const next = text.slice(0, ctx.start) + insert + tail
  return { text: next, caret: ctx.start + insert.length + (existing?.[0].length ?? 0) }
}
