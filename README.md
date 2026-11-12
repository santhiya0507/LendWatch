# LENDWATCH

A React and TypeScript prototype for reviewing requested Android permissions.

1. Open this folder in VS Code.
2. Run `npm install`, then `npm run dev`.
3. Open the local address shown in the terminal.
4. In Applications, select **LendWatch Demo** (`com.example.lendwatchdemo`).
5. Open APK Analysis, choose `samples/demo-1.0.apk`, and click **Analyse APK**. Leave the label empty to use the manifest version.
6. Repeat with `samples/demo-2.0.apk`. In Version Comparison, select 1.0 and 2.0. Camera is removed, Fine Location is added, and Internet is unchanged.
7. In Policy Archive, paste policy text to save dated snapshots. Reports exports the selected application's saved data and current permission comparison as JSON.

The included APK files are synthetic manifest samples for analysis. Data is stored in the browser. APK analysis reads declared permissions and does not determine how the app uses them. This prototype uses Vite directly. PostgreSQL, TanStack Start, and deployment are outside this package.
