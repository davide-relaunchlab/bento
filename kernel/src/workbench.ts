// Optional UI composition boundary. Engines own behavior; the host owns layout.
// Controls are live nodes, never clones or selectors into a private application.
export interface WorkbenchParts {
  header: HTMLElement;
  title: HTMLInputElement;
  navigation: HTMLElement[];
  tools: HTMLElement[];
  history: HTMLElement[];
  actions: HTMLElement[];
  primary: HTMLElement[];
  prepareActions?():void;
  status?: HTMLElement[];
}
export type MountWorkbench = (parts: WorkbenchParts) => void;
