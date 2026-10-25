# II studio marketing page

Public URL: https://iistudio.vercel.app/

Standalone static landing page matching Paper file 01M4D8E5MTG55WF4YGVPRP3EQC / page p-3-0 / artboard 3HQ-0. This folder is the canonical website source. Only public/ is hosted; the AI application remains local-only.

GitHub actions link to https://github.com/vvmahesh0/ii-studio. Copy prompt loads public/setup-prompt.txt (kept identical to ../docs/SETUP-PROMPT.txt) and writes it on direct click. If the browser denies access, a dialog provides manual selection/download. Watch demo remains an inactive placeholder. Author links open LinkedIn. Fonts use local Avenir Next with fallbacks; no proprietary font binaries are included.

Preview: `python3 -m http.server 4174 --bind 127.0.0.1 --directory public` from this folder.

Deploy from this folder with the Vercel CLI, linked to the existing iistudio project under mahesh-team1: `vercel --prod --scope mahesh-team1`. iistudio.vercel.app is a registered production domain and updates on production deployments. The older ii-studio-landing.vercel.app address also remains available. No environment variables or AI credentials are required. Deployment machine configuration in .vercel/ stays ignored.

Rollback: promote a known-good deployment in Vercel, verify iistudio.vercel.app serves that deployment. No studio data is stored by this site.
