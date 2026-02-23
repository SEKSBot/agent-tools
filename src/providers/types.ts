/**
 * Provider schema types for do-seks.
 */

export interface ProviderSchema {
  name: string;
  displayName: string;
  baseUrl: string;
  authPattern: {
    type: "bearer" | "basic" | "header";
    secretName: string;
    headerName?: string;
  };
  actions: Record<string, Action>;
}

export interface Action {
  description: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "GIT";
  path: string;
  params?: ParamDef[];
  body?: "json" | "none";
  capability: string;
}

export interface ParamDef {
  name: string;
  position?: number;
  flag?: string;
  required: boolean;
  location: "path" | "query" | "body";
}
