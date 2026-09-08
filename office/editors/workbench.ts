import type {MountWorkbench} from '../../kernel/src/workbench.ts';
import {ot} from '../client/i18n.ts';
import './workbench.css';

/** Suite-owned composition; no imports from an editor's implementation. */
export function workbench(format:'Document'|'Presentation'|'Spreadsheet'):MountWorkbench {
  return parts => {
    const doc=parts.header.ownerDocument;
    const row=(className:string,nodes:HTMLElement[])=>{
      const el=doc.createElement('div');el.className=className;el.append(...nodes);return el;
    };
    const kind=doc.createElement('span');kind.className='dw-workbench-kind';kind.textContent=ot(format);
    parts.title.setAttribute('aria-label',ot('Name'));
    // Keep title, history and save reachable at every width. Tools wrap on
    // narrow viewports without nesting or clipping their engine-owned menus.
    const heading=row('dw-workbench-heading',[kind,parts.title]);
    const history=row('dw-workbench-history',parts.history);
    const navigation=row('dw-workbench-navigation',parts.navigation);
    const tools=row('dw-workbench-tools',parts.tools);
    const actions=row('dw-workbench-actions',parts.actions);
    const status=row('dw-workbench-status',parts.status??[]);
    const toolbar=row('dw-workbench-toolbar',[navigation,history,tools,actions]);
    toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label',ot(format));
    parts.header.replaceChildren(heading,status,toolbar);
    parts.header.classList.add('dw-workbench');
  };
}
