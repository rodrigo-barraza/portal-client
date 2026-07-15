declare module "*.css" {
  const classes: { [key: string]: string };
  export default classes;
}

// utilities-library still ships loosely-typed API clients; keep it ambient
// until its createApiClient returns typed responses. The components-library
// declaration was removed on purpose so its real dist/index.d.ts types apply.
declare module "@rodrigo-barraza/utilities-library";
