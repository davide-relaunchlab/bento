import type {NativeEditorHost} from '../shared/editor-host.ts';
export function getNativeHost(format:NativeEditorHost['format']):NativeEditorHost {
  if(window.parent===window)throw new Error('Apri questo editor dalla raccolta dowitme.');
  const host=(window.parent as Window & {__BENTO_NATIVE_HOST__?:NativeEditorHost}).__BENTO_NATIVE_HOST__;
  if(!host||host.format!==format)throw new Error('Documento non disponibile per questo editor.');
  return host;
}
