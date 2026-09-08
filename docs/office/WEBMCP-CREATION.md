# WebMCP file creation

`create_workbook` adds persistent blank-file creation to the shared hosted tool
catalog. The browser inspector discovers it automatically when the updated
site is loaded. No model-provider or OpenRouter configuration change is needed.

Example tool arguments:

```json
{
  "title": "Prova MCP",
  "format": "bento/slides",
  "operationId": "unique-request-identifier"
}
```

Formats: `bento/type` (text), `bento/dash` (spreadsheet), `bento/slides`
(presentation). The result contains `id`, `docId`, `title`, `format`, `revision`
and a relative `url`. Use the returned `id` as `workbookId` for
`describe_workbook` and the existing read/edit tools. Creation makes a blank
file; it does not generate presentation content or open the editor automatically.

Retries of the same request must reuse `operationId`. A new intentional file
needs a new ID. Concurrent identical requests create one file. Different
parameters with a previously used ID return HTTP 409. Creation requires a
signed-in browser session; document-scoped agent tokens are rejected. New files
are private, owned by the signed-in person, and attributed to `browser_agent`
in history. No database migration is required.

## Verification on 2026-09-08

- Typecheck and production build passed.
- Full suite: 69 passing tests, including HTTP/Miniflare D1/R2 creation for all
  three formats, concurrent retries, conflicting retries, schema validation,
  anonymous access and read/propose/write document-scoped token rejection.
- Local browser native WebMCP discovery returned 13 tools. Native calls created
  all three file types; repeating presentation creation returned the same ID
  and docId. The dashboard listed exactly three files and the presentation
  opened in the actual slides editor with its requested title.

These checks cover the local branch, not a production deployment. After an
authorized deployment, reload the site and reopen the inspector panel to
refresh discovery; verify that `create_workbook` appears before testing the
same natural-language request through OpenRouter.

## Context and native text insertion

The browser additionally exposes `get_page_context`: dashboard versus editor,
app format, current file ID/title/revision and role. Document-targeting browser
tools may omit `workbookId` to use the current editor. Dashboard calls must
choose an explicit file; remote MCP and HTTP retain explicit IDs. Context is
read at execution time, after flushing pending edits. This identifies the open
file, not the current text selection or selected slide.

`propose_slide_text` accepts plain text, a slide ID, the revision read earlier,
an operation ID and summary, plus optional geometry/font size. It builds a
complete native text element and uses the existing reviewable proposal path.
This fixes the screenshot case where manually generated `setElement` omitted
`fontFamily` and `lineHeight`; changing the element ID prefix cannot fix that.

Browser execution returns structured error codes, messages and details instead
of throwing away API errors behind a generic native invocation failure. This
also lets the inspector show a missing-target or permission error directly.
OpenRouter remains unchanged. Pending proposals still need human acceptance.

Verified locally: dashboard refuses an implicit target; presentation reads work
without an ID; text proposal created through native WebMCP, accepted through the
UI and read back at revision 1 with a complete persisted text element. Context
switching and explicit target preservation are regression-tested. Full suite:
72 tests. These changes are not yet deployed to the public site.
