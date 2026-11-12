import { useEffect, useState } from 'react'
import './App.css'
import { readApk } from './apk'
import type { ApkMetadata } from './apk'

type Snapshot = ApkMetadata & { id: string; label: string; filename: string }
type Policy = { id: string; packageName: string; date: string; text: string }

function loadList<T>(key: string): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

type Application = {
  name: string
  packageName: string
}

const applications: Application[] = [
  { name: 'LendWatch Demo', packageName: 'com.example.lendwatchdemo' },
  {
    name: 'Moneyview',
    packageName: 'com.whizdm.moneyview.loans',
  },
  {
    name: 'KreditBee',
    packageName: 'com.kreditbee.android',
  },
  {
    name: 'Fibe',
    packageName: 'com.earlysalary.android',
  },
]

function App() {
  const [activePage, setActivePage] = useState('Overview')

  // Load applications saved in this browser.
  const [appList, setAppList] = useState<Application[]>(() => {
    try {
      const saved = localStorage.getItem('lendwatch-applications')

      if (!saved) return applications

      const parsed: unknown = JSON.parse(saved)

      if (
        Array.isArray(parsed) &&
        parsed.every(
          (app) =>
            app !== null &&
            typeof app === 'object' &&
            typeof app.name === 'string' &&
            typeof app.packageName === 'string'
        )
      ) {
        return parsed
      }

      return applications
    } catch {
      return applications
    }
  })

  const [selectedApp, setSelectedApp] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newPackage, setNewPackage] = useState('')
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [apkFile, setApkFile] = useState<File | null>(null)
  const [versionLabel, setVersionLabel] = useState('')
  const [apkError, setApkError] = useState('')

  // Save the application list whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(
        'lendwatch-applications',
        JSON.stringify(appList)
      )
      setStorageError('')
    } catch {
      setStorageError(
        'Could not save applications in this browser. New changes may be lost after refreshing.'
      )
    }
  }, [appList])

  const selectedAppData = appList.find(
    (app) => app.packageName === selectedApp
  )

  const [snapshots, setSnapshots] = useState(() => loadList<Snapshot>('lendwatch-versions'))
  const [policies, setPolicies] = useState(() => loadList<Policy>('lendwatch-policies'))
  const [policyText, setPolicyText] = useState('')
  const [older, setOlder] = useState('')
  const [newer, setNewer] = useState('')
  const [busy, setBusy] = useState(false)
  const versions = snapshots.filter((item) => item.packageName === selectedApp)
  const appPolicies = policies.filter((item) => item.packageName === selectedApp)
  const latest = versions[versions.length - 1]
  const oldVersion = versions.find((item) => item.id === older)
  const newVersion = versions.find((item) => item.id === newer)
  const changes = oldVersion && newVersion && older !== newer
    ? [...new Set([...oldVersion.permissions, ...newVersion.permissions])].sort().map((permission) => {
      const before = oldVersion.permissions.includes(permission)
      const after = newVersion.permissions.includes(permission)
      return { permission, before, after, status: before && after ? 'Unchanged' : after ? 'Added' : 'Removed' }
    })
    : null

  const analyse = async () => {
    if (!apkFile || !selectedAppData || busy) return
    setBusy(true)
    setApkError('')
    try {
      const result = await readApk(apkFile)
      if (result.packageName !== selectedAppData.packageName) {
        throw new Error(`APK package is ${result.packageName}. Selected application is ${selectedAppData.packageName}.`)
      }
      const label = versionLabel.trim() || result.version
      if (!label) throw new Error('Enter a version label for this APK.')
      if (versions.some((item) => item.label === label)) {
        throw new Error('This version label is already saved for this application.')
      }
      const updated = [...snapshots, { ...result, id: crypto.randomUUID(), label, filename: apkFile.name }]
      localStorage.setItem('lendwatch-versions', JSON.stringify(updated))
      setSnapshots(updated)
      setVersionLabel('')
    } catch (cause) {
      setApkError(cause instanceof Error ? cause.message : 'Could not analyse this APK.')
    } finally {
      setBusy(false)
    }
  }

  const savePolicy = () => {
    if (!selectedApp || !policyText.trim()) return
    setError('')
    try {
      const updated = [...policies, { id: crypto.randomUUID(), packageName: selectedApp, date: new Date().toISOString(), text: policyText.trim() }]
      localStorage.setItem('lendwatch-policies', JSON.stringify(updated))
      setPolicies(updated)
      setPolicyText('')
    } catch {
      setError('Could not save the policy in this browser.')
    }
  }

  const downloadReport = () => {
    if (!selectedAppData) return
    const report = {
      application: selectedAppData,
      generatedAt: new Date().toISOString(),
      versions,
      permissionComparison: changes ? { older: oldVersion?.label, newer: newVersion?.label, changes } : null,
      policySnapshots: appPolicies,
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedAppData.packageName}-report.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const addApplication = () => {
    const name = newName.trim()
    const packageName = newPackage.trim()

    if (!name || !packageName) {
      setError('Enter both application name and package name.')
      return
    }

    const alreadyExists = appList.some(
      (app) => app.packageName === packageName
    )

    if (alreadyExists) {
      setError('An application with this package name already exists.')
      return
    }

    setAppList((previousApps) => [
      ...previousApps,
      { name, packageName },
    ])

    setNewName('')
    setNewPackage('')
    setError('')
  }

  const selectApplication = (packageName: string) => {
    if (selectedApp !== packageName) {
      setApkFile(null)
      setVersionLabel('')
      setApkError('')
      setPolicyText('')
      setOlder('')
      setNewer('')
    }

    setSelectedApp(packageName)
  }

  const removeApplication = (packageName: string) => {
    setAppList((previousApps) =>
      previousApps.filter((app) => app.packageName !== packageName)
    )

    if (selectedApp === packageName) {
      setSelectedApp(null)
      setApkFile(null)
      setVersionLabel('')
      setApkError('')
      setPolicyText('')
      setOlder('')
      setNewer('')
    }
  }

  const menuItems = [
    'Overview',
    'Applications',
    'APK Analysis',
    'Version Comparison',
    'Policy Archive',
    'Reports',
  ]

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>🛡 LendWatch</h2>
        <p className="tagline">PRIVACY MONITORING</p>

        <nav>
          {menuItems.map((item) => (
            <button
              key={item}
              disabled={busy}
              className={activePage === item ? 'active' : ''}
              onClick={() => setActivePage(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header>
          <div>
            <h1>{activePage}</h1>
            <p>Monitor Android app privacy changes.</p>
          </div>
          <span className="status">Prototype</span>
        </header>

        {activePage === 'Overview' && (
          <>
            <section className="stats">
              <div className="stat-card">
                <h2>{String(appList.length).padStart(2, '0')}</h2>
                <p>Registered Applications</p>
              </div>

              <div className="stat-card">
                <h2>{snapshots.length}</h2>
                <p>APK Versions Analysed</p>
              </div>

              <div className="stat-card">
                <h2>{policies.length}</h2>
                <p>Policy snapshots</p>
              </div>
            </section>

            <section className="applications">
              <h2>Registered Applications</h2>

              {appList.map((app) => (
                <div className="app-card" key={app.packageName}>
                  <h3>{app.name}</h3>
                  <p>{app.packageName}</p>
                  <span>{snapshots.some((item) => item.packageName === app.packageName) ? 'APK analysed' : 'Research pending'}</span>
                </div>
              ))}
            </section>

            <section className="progress-section">
              <h2>Research Progress</h2>

              <div className="progress-item">
                <span>Application registration</span>
                <span>{appList.length > 0 ? 'Completed' : 'Pending'}</span>
              </div>
              <div className="progress-item">
                <span>APK version collection</span>
                <span>Pending</span>
              </div>
              <div className="progress-item">
                <span>Permission analysis</span>
                <span>{snapshots.length ? 'Completed' : 'Pending'}</span>
              </div>
              <div className="progress-item">
                <span>Privacy policy collection</span>
                <span>Pending</span>
              </div>
              <div className="progress-item">
                <span>Version comparison</span>
                <span>Pending</span>
              </div>
            </section>
          </>
        )}

        {activePage === 'Applications' && (
          <>
            <section className="applications">
              <h2>Registered Applications</h2>

              {appList.map((app) => (
                <div className="app-card app-row" key={app.packageName}>
                  <div>
                    <h3>{app.name}</h3>
                    <p>Package: {app.packageName}</p>
                    <span>{snapshots.some((item) => item.packageName === app.packageName) ? 'APK analysed' : 'Research pending'}</span>
                  </div>

                  <button
                    className={
                      selectedApp === app.packageName
                        ? 'select-btn selected'
                        : 'select-btn'
                    }
                    onClick={() => selectApplication(app.packageName)}
                  >
                    {selectedApp === app.packageName
                      ? 'Selected'
                      : 'Select for analysis'}
                  </button>

                  <button
                    className="select-btn"
                    onClick={() => removeApplication(app.packageName)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </section>

            <section className="add-app">
              <h2>Add Application</h2>

              <p className="note">
                Applications are saved in this browser only.
                They are not saved to a database yet.
              </p>

              {storageError && (
                <p className="error-message" role="alert">
                  {storageError}
                </p>
              )}

              <label htmlFor="application-name">Application name</label>
              <input
                id="application-name"
                placeholder="Application name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />

              <label htmlFor="package-name">Package name</label>
              <input
                id="package-name"
                placeholder="Package name (e.g. com.example.app)"
                value={newPackage}
                onChange={(e) => setNewPackage(e.target.value)}
              />

              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}

              <button onClick={addApplication}>Add Application</button>
            </section>
          </>
        )}

        {activePage === 'APK Analysis' && (
          <>
            <section className="selected-banner">
              {selectedAppData ? (
                <div>
                  <p className="label">Selected application</p>
                  <h3>{selectedAppData.name}</h3>
                  <p className="pkg">{selectedAppData.packageName}</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="label">No application selected</p>
                    <p className="pkg">
                      Choose one on the Applications page before analysing an APK.
                    </p>
                  </div>

                  <button
                    className="select-btn"
                    onClick={() => setActivePage('Applications')}
                  >
                    Go to Applications
                  </button>
                </>
              )}
            </section>

            <section className="analysis-card">
              <h2>Analyse an APK</h2>

              <p className="note">
                Select an APK to view its filename and size.
                Analysis runs in your browser.
              </p>

              <div className="upload-box">
                <label htmlFor="apk-file">Choose an APK file</label>

                <input
                  key={selectedApp ?? 'no-app'}
                  id="apk-file"
                  type="file"
                  accept=".apk"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null

                    setVersionLabel('')
                    setApkError('')

                    if (
                      file &&
                      !file.name.toLowerCase().endsWith('.apk')
                    ) {
                      setApkFile(null)
                      setApkError('Please choose a file ending in .apk.')
                      event.target.value = ''
                      return
                    }

                    setApkFile(file)
                  }}
                />

                {!selectedAppData && (
                  <p>
                    To associate this APK with an application, select one on the Applications page.
                  </p>
                )}

                {apkError && (
                  <p className="error-message" role="alert">
                    {apkError}
                  </p>
                )}

                {apkFile && (
                  <p>
                    Selected: {apkFile.name}
                    {' — '}
                    {(apkFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
              </div>

              <div className="form-row">
                <input
                  aria-label="Version label"
                  placeholder="Version label (e.g. 5.2.1)"
                  value={versionLabel}
                  onChange={(event) => setVersionLabel(event.target.value)}
                  disabled={!apkFile || busy}
                />
                <button className="primary-btn" disabled={!apkFile || !selectedAppData || busy} onClick={analyse}>
                  {busy ? 'Analysing…' : 'Analyse APK'}
                </button>
              </div>
            </section>

            <section className="analysis-card">
              <h2>Permission Analysis</h2>
              {latest ? (
                <>
                  <p>{latest.packageName} · Saved as {latest.label} · Manifest version {latest.version || 'unavailable'}</p>
                  <table className="result-table">
                    <thead><tr><th>Requested permission</th></tr></thead>
                    <tbody>
                      {latest.permissions.map((permission) => <tr key={permission}><td>{permission}</td></tr>)}
                      {!latest.permissions.length && <tr><td>No permissions declared.</td></tr>}
                    </tbody>
                  </table>
                </>
              ) : <p>No saved analysis for this application.</p>}
            </section>
          </>
        )}

        {activePage === 'Version Comparison' && (
          <>
            <section className="selected-banner">
              {selectedAppData ? (
                <div>
                  <p className="label">Selected application</p>
                  <h3>{selectedAppData.name}</h3>
                  <p className="pkg">{selectedAppData.packageName}</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="label">No application selected</p>
                    <p className="pkg">
                      Choose one on the Applications page before comparing versions.
                    </p>
                  </div>

                  <button
                    className="select-btn"
                    onClick={() => setActivePage('Applications')}
                  >
                    Go to Applications
                  </button>
                </>
              )}
            </section>

            <section className="analysis-card">
              <h2>Compare APK Versions</h2>
              {versions.length < 2 && <p>Analyse two APK versions for the selected application.</p>}
              <div className="form-row">
                <select aria-label="Older version" value={older} onChange={(event) => setOlder(event.target.value)}>
                  <option value="">Older version</option>
                  {versions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <select aria-label="Newer version" value={newer} onChange={(event) => setNewer(event.target.value)}>
                  <option value="">Newer version</option>
                  {versions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </div>
              {older && older === newer && <p>Choose two different versions.</p>}
              {changes && (
                <table className="result-table">
                  <thead><tr><th>Permission</th><th>Older</th><th>Newer</th><th>Change</th></tr></thead>
                  <tbody>
                    {changes.map((item) => (
                      <tr key={item.permission}><td>{item.permission}</td><td>{item.before ? 'Yes' : 'No'}</td><td>{item.after ? 'Yes' : 'No'}</td><td>{item.status}</td></tr>
                    ))}
                    {!changes.length && <tr><td colSpan={4}>Neither version declares permissions.</td></tr>}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}

        {activePage === 'Policy Archive' && (
          <section className="analysis-card">
            <h2>Privacy Policy Archive</h2>
            {selectedAppData ? (
              <>
                <p>{selectedAppData.name}</p>
                <label htmlFor="policy-text">Privacy policy text</label>
                <textarea id="policy-text" rows={6} style={{ display: 'block', width: '100%' }} value={policyText} onChange={(event) => setPolicyText(event.target.value)} />
                <button className="primary-btn" disabled={!policyText.trim()} onClick={savePolicy}>Save policy snapshot</button>
                {error && <p role="alert">{error}</p>}
                <div className="compare-columns">
                  {appPolicies.slice(-2).map((policy) => (
                    <div className="compare-panel" key={policy.id}>
                      <h3>{new Date(policy.date).toLocaleString()}</h3>
                      <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{policy.text}</div>
                    </div>
                  ))}
                </div>
                {appPolicies.length > 2 && (
                  <details><summary>Earlier snapshots</summary>
                    {appPolicies.slice(0, -2).reverse().map((policy) => (
                      <details key={policy.id}><summary>{new Date(policy.date).toLocaleString()}</summary><p style={{ whiteSpace: 'pre-wrap' }}>{policy.text}</p></details>
                    ))}
                  </details>
                )}
              </>
            ) : <button className="select-btn" onClick={() => setActivePage('Applications')}>Select an application</button>}
          </section>
        )}

        {activePage === 'Reports' && (
          <section className="analysis-card">
            <h2>Evidence Report</h2>
            <p>{selectedAppData?.name ?? 'Select an application on the Applications page.'}</p>
            <button className="primary-btn" disabled={!selectedAppData || (!versions.length && !appPolicies.length)} onClick={downloadReport}>Download JSON report</button>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
