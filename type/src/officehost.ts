// Optional boundary: standalone files never acquire an authenticated host.
import type { NativeEditorHost } from '../../office/shared/editor-host.ts';
let host: NativeEditorHost | undefined;
export function setOfficeHost(value: NativeEditorHost): void { host = value; }
export function officeHost(): NativeEditorHost | undefined { return host; }
