import { ProviderSchema } from './types.js';

export const github: ProviderSchema = {
  name: "github",
  displayName: "GitHub",
  baseUrl: "https://api.github.com",
  authPattern: { type: "bearer", secretName: "SEKSBOT_GITHUB_PERSONAL_ACCESS_TOKEN" },
  actions: {
    "list-repos": {
      description: "List repositories for authenticated user",
      method: "GET",
      path: "/user/repos",
      capability: "repos.list",
    },
    "get-repo": {
      description: "Get repository details",
      method: "GET",
      path: "/repos/{owner}/{repo}",
      capability: "repos.read",
      params: [
        { name: "owner", position: 0, required: true, location: "path" },
        { name: "repo", position: 1, required: true, location: "path" },
      ],
    },
    "list-issues": {
      description: "List issues for a repository",
      method: "GET",
      path: "/repos/{owner}/{repo}/issues",
      capability: "issues.list",
      params: [
        { name: "owner", position: 0, required: true, location: "path" },
        { name: "repo", position: 1, required: true, location: "path" },
      ],
    },
    "create-issue": {
      description: "Create an issue",
      method: "POST",
      path: "/repos/{owner}/{repo}/issues",
      capability: "issues.write",
      body: "json",
      params: [
        { name: "owner", position: 0, required: true, location: "path" },
        { name: "repo", position: 1, required: true, location: "path" },
        { name: "title", flag: "--title", required: true, location: "body" },
        { name: "body", flag: "--body", required: false, location: "body" },
      ],
    },
    "clone": {
      description: "Clone a repository (delegates to seks-git)",
      method: "GIT",
      path: "/{owner}/{repo}",
      capability: "repos.read",
      params: [
        { name: "owner", position: 0, required: true, location: "path" },
        { name: "repo", position: 1, required: true, location: "path" },
        { name: "dest", position: 2, required: false, location: "body" },
      ],
    },
  },
};
