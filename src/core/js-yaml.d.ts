declare module 'js-yaml' {
  export interface DumpOptions {
    indent?: number;
    lineWidth?: number;
    noRefs?: boolean;
    sortKeys?: boolean;
  }

  export interface LoadOptions {
    json?: boolean;
  }

  export class YAMLException extends Error {
    mark?: {
      line?: number;
      column?: number;
    };
  }

  export function load(content: string, options?: LoadOptions): any;
  export function dump(value: any, options?: DumpOptions): string;

  const yaml: {
    load: typeof load;
    dump: typeof dump;
    YAMLException: typeof YAMLException;
  };

  export default yaml;
}
