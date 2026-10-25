# Figma Plugin API typings

`plugin-api.d.ts` is the standalone declaration file from the official npm
package `@figma/plugin-typings@1.142.0`, obtained with `npm pack`.
The upstream LICENSE is retained here.

The declarations are development input only; they are not a runtime dependency.
The importer uses official Plugin API methods. Desktop Bridge is test tooling
and is not a runtime dependency of the local development plugin.

The build reuses esbuild already present in this application's dependency tree.
No package or lockfile changes were made. A future production package should
declare its build dependencies explicitly.
