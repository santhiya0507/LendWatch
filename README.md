# LENDWATCH — Android Lending App Permission Explorer

**LENDWATCH** is a browser-based tool for reviewing the permissions requested by Android lending apps. It helps reviewers inspect an APK, compare permission changes across releases, and keep dated copies of privacy policies alongside their findings.

Lending apps may request access to features such as the camera or location. When a new version comes out, LENDWATCH helps answer a specific question: **Which permissions did the app add, remove, or keep?** Reviewers can then read the saved policy text to see how the app describes those permissions.

**Live demo:** [lendwatch.vercel.app](https://lendwatch.vercel.app)

## What a Lending App Review Covers

| View | Role in the review |
| --- | --- |
| **Overview** | See how many applications, analysed APK versions, and policy snapshots are saved. |
| **Applications** | Register a lending app by name and Android package ID, then select it for review. |
| **APK Analysis** | Read the package ID, version name, and declared permissions from the selected APK. |
| **Version Comparison** | Compare two releases of the same app and see which permissions changed. |
| **Policy Archive** | Save dated copies of privacy policy text for the selected app. |
| **Reports** | Download the selected app’s APK analyses, saved policy snapshots, and current permission comparison as JSON. |

## Open the Project on Your Computer

You’ll need **Git**, **Node.js**, and **npm**. Clone the repository and start the development server:

```bash
git clone https://github.com/santhiya0507/LendWatch.git
cd LendWatch
npm ci
npm run dev
```

Open the **Local** URL printed in the terminal. If you already downloaded or cloned the project, open the folder that contains `package.json` in VS Code and start from `npm ci`.

## Walk Through a Sample Review

The repository includes two **synthetic APK samples** for the same demo package. They let you demonstrate the workflow without needing APK files from a real lender.

1. Open **Applications** and select **LendWatch Demo**. Its package ID is `com.example.lendwatchdemo`.
2. Open **APK Analysis** and choose `samples/demo-1.0.apk`.
3. Leave the version label blank to use the version read from the manifest, then click **Analyse APK**.
4. Repeat with `samples/demo-2.0.apk`.
5. Open **Version Comparison**. Choose **1.0** as the older release and **2.0** as the newer release.

The sample comparison should look like this:

| Permission | Version 1.0 | Version 2.0 | Result |
| --- | --- | --- | --- |
| `android.permission.CAMERA` | Declared | Absent | Removed |
| `android.permission.ACCESS_FINE_LOCATION` | Absent | Declared | Added |
| `android.permission.INTERNET` | Declared | Declared | Unchanged |

To review a different APK, register its application using the correct Android package ID and select that entry before analysing the file. LENDWATCH checks the APK’s package ID against the selected application before saving the result.

## Inside the Review Workspace

The interface has a **sidebar** for switching views and a **main content area** for the selected view. Both are defined in [`src/App.tsx`](src/App.tsx). The sidebar updates React state, and the main area renders the corresponding view.

This simplified example shows how switching to APK Analysis works:

```tsx
const [activePage, setActivePage] = useState('Overview')

return (
  <>
    <button onClick={() => setActivePage('APK Analysis')}>
      APK Analysis
    </button>

    <main>
      {activePage === 'Overview' && <h2>Overview</h2>}
      {activePage === 'APK Analysis' && <h2>APK Analysis</h2>}
    </main>
  </>
)
```

[`src/App.css`](src/App.css) controls the sidebar, cards, file picker, form controls, results tables, and layout on smaller screens.

## How LENDWATCH Reads an APK

The APK reader is implemented in [`src/apk.ts`](src/apk.ts). The **Analyse APK** action passes the selected file to `readApk()`. The function opens the archive, reads `AndroidManifest.xml`, and extracts the package ID, version name, and declared permissions.

The reader runs in the browser, so this workflow can analyse a local file without uploading it to a server.

```ts
import { readApk } from './apk'

async function inspectApk(file: File) {
  const result = await readApk(file)

  console.log(result.packageName)
  console.log(result.version)
  console.log(result.permissions)

  return result
}
```

| Function | Input | Output |
| --- | --- | --- |
| `readApk(file)` | An APK selected as a browser `File` | A promise containing `packageName`, `version`, and `permissions` |
| `readManifest(bytes)` | Binary Android manifest data as an `ArrayBuffer` | The package name, version, and declared permissions |

These TypeScript functions are called directly by the frontend. The current project has no HTTP API routes or server functions.

## Keep a History of Privacy Policies

Open **Policy Archive**, paste the selected lending app’s privacy policy text, and click **Save policy snapshot**. A snapshot is a dated copy of the text you entered. Saving another copy later lets you review the two versions side by side.

For a practice run, save the following **fictional** examples as two separate snapshots:

```text
Demo policy 1.0
The app requests camera access to scan documents.
```

```text
Demo policy 2.0
The app requests location access to show nearby services.
```

Policy collection is manual in this version. The archive lets reviewers read and compare saved copies while checking the APK permission results separately.

## Export the Findings

After analysing both versions, select them in **Version Comparison**, then open **Reports** and click **Download JSON report**.

The report can include:

- The selected application’s name and package ID
- Saved APK versions and their declared permissions
- The permission changes for the two versions currently selected for comparison
- Dated privacy policy snapshots saved for the application

Open the downloaded JSON file in VS Code to inspect or share the findings. LENDWATCH stores application records, APK results, and policy snapshots in browser local storage. Records saved on `localhost` and `lendwatch.vercel.app` are stored separately.

## Find Your Way Around the Code

| Path | What you’ll find |
| --- | --- |
| `src/main.tsx` | The entry point that renders the React application |
| `src/App.tsx` | Navigation, review views, application state, and report export |
| `src/apk.ts` | APK archive and Android manifest parsing |
| `src/App.css` | Styling and responsive layout |
| `samples/` | Two synthetic APK files for the comparison walkthrough |
| `package.json` | Project dependencies and npm commands |
| `tsconfig.json` | TypeScript configuration |

## Build and Preview the Hosted Version

Run the production build and preview it locally:

```bash
npm run build
npm run preview
```

The build output goes into `dist/`. The live demo is hosted on **Vercel**. To deploy a separate copy, use the **Vite** framework preset, `npm run build` as the build command, and `dist` as the output directory.

## What the Results Can Tell You

An APK manifest shows which permissions a lending app **declares**. A comparison can show that a permission appeared or disappeared between the two APKs you reviewed. To determine whether the app actually uses a permission, when it accesses data, or how it handles that data, you would need further testing and review.

LENDWATCH helps organise this evidence for a privacy review. A permission change alone cannot establish misuse or regulatory compliance.

**Built with:** React 19, TypeScript, Vite, and CSS. **Hosted on:** Vercel.