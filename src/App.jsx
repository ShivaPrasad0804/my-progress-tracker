import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateDaysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return localDateString(date)
}

const EXERCISES = {
  'Workout A': [
    { name: 'Band squat', band: '3–10 lb to start', sets: '1–2', reps: '8–12' },
    { name: 'Standing band chest press', band: '3–10 lb to start; door anchor at chest height', sets: '1–2', reps: '8–12' },
    { name: 'Seated band row', band: '3–10 lb to start; anchor around waist height', sets: '1–2', reps: '8–12' },
    { name: 'Band Romanian deadlift', band: '3–10 lb to start', sets: '1–2', reps: '8–12' },
    { name: 'Biceps curl', band: '3–10 lb to start', sets: '1–2', reps: '8–12' },
  ],
  'Workout B': [
    { name: 'Supported split squat', band: 'Bodyweight to start; hold a support for balance', sets: '1–2', reps: '6–10 per leg' },
    { name: 'Standing band chest press', band: '3–10 lb to start; door anchor at chest height', sets: '1–2', reps: '8–12' },
    { name: 'Seated band row', band: '3–10 lb to start; anchor around waist height', sets: '1–2', reps: '8–12' },
    { name: 'Glute bridge', band: 'Bodyweight to start', sets: '1–2', reps: '10–15' },
    { name: 'Band shoulder press', band: '3–10 lb to start; do not arch your back', sets: '1–2', reps: '8–12' },
  ],
}

const WORKOUT_SCHEDULE = [
  ['Monday', 'Rest / Recovery'],
  ['Tuesday', 'Workout A or B'],
  ['Wednesday', 'Rest / Recovery'],
  ['Thursday', 'Workout A or B'],
  ['Friday', 'Rest / Recovery'],
  ['Saturday', 'Workout A or B'],
  ['Sunday', 'Rest / Recovery'],
]

function formatDate(dateString) {
  if (!dateString) return '—'
  const date = new Date(`${dateString}T12:00:00`)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function showValue(value, suffix = '') {
  return value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [activeTab, setActiveTab] = useState('Daily log')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const [logDate, setLogDate] = useState(localDateString())
  const [weight, setWeight] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [sleep, setSleep] = useState('')
  const [water, setWater] = useState('')
  const [trainingType, setTrainingType] = useState('Rest / Recovery')
  const [logNotes, setLogNotes] = useState('')
  const [dailyLogs, setDailyLogs] = useState([])
  const [summaryLogs, setSummaryLogs] = useState([])
  const [weeklyWorkoutDays, setWeeklyWorkoutDays] = useState(0)

  const [workoutDate, setWorkoutDate] = useState(localDateString())
  const [workoutType, setWorkoutType] = useState('Workout A')
  const [exerciseName, setExerciseName] = useState(EXERCISES['Workout A'][0].name)
  const [bandSetup, setBandSetup] = useState(EXERCISES['Workout A'][0].band)
  const [sets, setSets] = useState('1')
  const [reps, setReps] = useState('8–12')
  const [workoutNotes, setWorkoutNotes] = useState('')
  const [workoutEntries, setWorkoutEntries] = useState([])
  const [editingWorkoutId, setEditingWorkoutId] = useState(null)

  const [measurementDate, setMeasurementDate] = useState(localDateString())
  const [waist, setWaist] = useState('')
  const [chest, setChest] = useState('')
  const [upperArm, setUpperArm] = useState('')
  const [thigh, setThigh] = useState('')
  const [measurementNotes, setMeasurementNotes] = useState('')
  const [measurements, setMeasurements] = useState([])

  const [historyFrom, setHistoryFrom] = useState(dateDaysAgo(30))
  const [historyTo, setHistoryTo] = useState(localDateString())
  const [historyLogs, setHistoryLogs] = useState([])
  const [historyWorkouts, setHistoryWorkouts] = useState([])
  const [historyMeasurements, setHistoryMeasurements] = useState([])

  useEffect(() => {
    let alive = true

    async function getInitialSession() {
      const { data, error } = await supabase.auth.getSession()
      if (!alive) return
      if (error) setMessage(error.message)
      setSession(data?.session ?? null)
      setAuthLoading(false)
    }

    getInitialSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user) return
    loadDailyLog()
    loadDailyLogs()
    loadSummary()
    loadWorkoutEntries()
    loadMeasurements()
    loadAllHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, logDate, workoutDate, measurementDate])

  async function signIn(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    setBusy(false)
  }

  async function signOut() {
    setMessage('')
    const { error } = await supabase.auth.signOut()
    if (error) setMessage(error.message)
  }

  async function loadDailyLog() {
    if (!session?.user) return
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('log_date', logDate)
      .maybeSingle()

    if (error) {
      setMessage(`Could not load daily log: ${error.message}`)
      return
    }

    setWeight(data?.weight_lb ?? '')
    setCalories(data?.calories ?? '')
    setProtein(data?.protein_g ?? '')
    setSleep(data?.sleep_hours ?? '')
    setWater(data?.water_l ?? '')
    setTrainingType(data?.training_type ?? 'Rest / Recovery')
    setLogNotes(data?.notes ?? '')
  }

  async function loadDailyLogs() {
    if (!session?.user) return
    const { data, error } = await supabase
      .from('daily_logs')
      .select('log_date, weight_lb, calories, protein_g')
      .eq('user_id', session.user.id)
      .order('log_date', { ascending: true })

    if (error) {
      setMessage(`Could not load daily history: ${error.message}`)
      return
    }
    setDailyLogs(data ?? [])
  }

  async function loadSummary() {
    if (!session?.user) return
    const startDate = dateDaysAgo(13)
    const endDate = localDateString()

    const { data: logs, error: logsError } = await supabase
      .from('daily_logs')
      .select('log_date, weight_lb, calories, protein_g')
      .eq('user_id', session.user.id)
      .gte('log_date', startDate)
      .lte('log_date', endDate)

    if (logsError) {
      setMessage(`Could not load progress summary: ${logsError.message}`)
      return
    }
    setSummaryLogs(logs ?? [])

    const { data: workouts, error: workoutsError } = await supabase
      .from('workout_entries')
      .select('workout_date')
      .eq('user_id', session.user.id)
      .gte('workout_date', dateDaysAgo(6))
      .lte('workout_date', endDate)

    if (workoutsError) {
      setMessage(`Could not load workout summary: ${workoutsError.message}`)
      return
    }
    setWeeklyWorkoutDays(new Set((workouts ?? []).map((entry) => entry.workout_date)).size)
  }

  async function saveDailyLog(event) {
    event.preventDefault()
    if (!session?.user) return
    setBusy(true)
    setMessage('')

    const record = {
      user_id: session.user.id,
      log_date: logDate,
      weight_lb: weight === '' ? null : Number(weight),
      calories: calories === '' ? null : Number(calories),
      protein_g: protein === '' ? null : Number(protein),
      sleep_hours: sleep === '' ? null : Number(sleep),
      water_l: water === '' ? null : Number(water),
      training_type: trainingType,
      notes: logNotes.trim() || null,
    }

    const { error } = await supabase
      .from('daily_logs')
      .upsert(record, { onConflict: 'user_id,log_date' })

    if (error) {
      setMessage(`Could not save daily log: ${error.message}`)
    } else {
      setMessage(`Daily log saved for ${formatDate(logDate)}.`)
      await Promise.all([loadDailyLog(), loadDailyLogs(), loadSummary(), loadAllHistory()])
    }
    setBusy(false)
  }

  async function loadWorkoutEntries() {
    if (!session?.user) return
    const { data, error } = await supabase
      .from('workout_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('workout_date', workoutDate)
      .order('created_at', { ascending: true })

    if (error) {
      setMessage(`Could not load workout entries: ${error.message}`)
      return
    }
    setWorkoutEntries(data ?? [])
  }

  function resetWorkoutForm() {
    setEditingWorkoutId(null)
    setExerciseName(EXERCISES[workoutType][0].name)
    setBandSetup(EXERCISES[workoutType][0].band)
    setSets('1')
    setReps(EXERCISES[workoutType][0].reps)
    setWorkoutNotes('')
  }

  function chooseWorkoutType(nextType) {
    setWorkoutType(nextType)
    setEditingWorkoutId(null)
    const firstExercise = EXERCISES[nextType][0]
    setExerciseName(firstExercise.name)
    setBandSetup(firstExercise.band)
    setSets('1')
    setReps(firstExercise.reps)
    setWorkoutNotes('')
  }

  function chooseExercise(nextName) {
    setExerciseName(nextName)
    if (editingWorkoutId) return
    const preset = EXERCISES[workoutType].find((item) => item.name === nextName)
    if (preset) {
      setBandSetup(preset.band)
      setSets('1')
      setReps(preset.reps)
    }
  }

  async function saveWorkout(event) {
    event.preventDefault()
    if (!session?.user) return
    setBusy(true)
    setMessage('')

    const record = {
      user_id: session.user.id,
      workout_date: workoutDate,
      workout_type: workoutType,
      exercise_name: exerciseName,
      band_setup: bandSetup.trim() || null,
      sets: sets === '' ? null : Number(sets),
      reps: reps.trim() || null,
      notes: workoutNotes.trim() || null,
    }

    let result
    if (editingWorkoutId) {
      result = await supabase
        .from('workout_entries')
        .update(record)
        .eq('id', editingWorkoutId)
        .eq('user_id', session.user.id)
    } else {
      result = await supabase.from('workout_entries').insert(record)
    }

    if (result.error) {
      setMessage(`Could not save workout: ${result.error.message}`)
    } else {
      setMessage(editingWorkoutId ? 'Workout entry updated.' : 'Workout entry saved.')
      resetWorkoutForm()
      await Promise.all([loadWorkoutEntries(), loadSummary(), loadAllHistory()])
    }
    setBusy(false)
  }

  function editWorkout(entry) {
    setEditingWorkoutId(entry.id)
    setWorkoutDate(entry.workout_date)
    setWorkoutType(entry.workout_type)
    setExerciseName(entry.exercise_name)
    setBandSetup(entry.band_setup ?? '')
    setSets(entry.sets ?? '')
    setReps(entry.reps ?? '')
    setWorkoutNotes(entry.notes ?? '')
    setActiveTab('Workouts')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteWorkout(entry) {
    if (!window.confirm(`Delete "${entry.exercise_name}" from ${formatDate(entry.workout_date)}?`)) return
    const { error } = await supabase
      .from('workout_entries')
      .delete()
      .eq('id', entry.id)
      .eq('user_id', session.user.id)

    if (error) {
      setMessage(`Could not delete workout entry: ${error.message}`)
    } else {
      setMessage('Workout entry deleted.')
      if (editingWorkoutId === entry.id) resetWorkoutForm()
      await Promise.all([loadWorkoutEntries(), loadSummary(), loadAllHistory()])
    }
  }

  async function loadMeasurements() {
    if (!session?.user) return
    const { data: selected, error: selectedError } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('measurement_date', measurementDate)
      .maybeSingle()

    if (selectedError) {
      setMessage(`Could not load measurements: ${selectedError.message}`)
      return
    }

    setWaist(selected?.waist_in ?? '')
    setChest(selected?.chest_in ?? '')
    setUpperArm(selected?.upper_arm_in ?? '')
    setThigh(selected?.thigh_in ?? '')
    setMeasurementNotes(selected?.notes ?? '')

    const { data, error } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', session.user.id)
      .order('measurement_date', { ascending: false })

    if (error) {
      setMessage(`Could not load measurement history: ${error.message}`)
      return
    }
    setMeasurements(data ?? [])
  }

  async function saveMeasurements(event) {
    event.preventDefault()
    if (!session?.user) return
    setBusy(true)
    setMessage('')

    const record = {
      user_id: session.user.id,
      measurement_date: measurementDate,
      waist_in: waist === '' ? null : Number(waist),
      chest_in: chest === '' ? null : Number(chest),
      upper_arm_in: upperArm === '' ? null : Number(upperArm),
      thigh_in: thigh === '' ? null : Number(thigh),
      notes: measurementNotes.trim() || null,
    }

    const { error } = await supabase
      .from('body_measurements')
      .upsert(record, { onConflict: 'user_id,measurement_date' })

    if (error) {
      setMessage(`Could not save measurements: ${error.message}`)
    } else {
      setMessage(`Measurements saved for ${formatDate(measurementDate)}.`)
      await Promise.all([loadMeasurements(), loadAllHistory()])
    }
    setBusy(false)
  }

  async function loadAllHistory() {
    if (!session?.user) return
    const userId = session.user.id

    const [logsResult, workoutsResult, measurementsResult] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }),
      supabase.from('workout_entries').select('*').eq('user_id', userId).order('workout_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('body_measurements').select('*').eq('user_id', userId).order('measurement_date', { ascending: false }),
    ])

    const firstError = logsResult.error || workoutsResult.error || measurementsResult.error
    if (firstError) {
      setMessage(`Could not load combined history: ${firstError.message}`)
      return
    }

    setHistoryLogs(logsResult.data ?? [])
    setHistoryWorkouts(workoutsResult.data ?? [])
    setHistoryMeasurements(measurementsResult.data ?? [])
  }

  async function exportTable(tableName) {
    if (!session?.user) return
    const allowedTables = ['daily_logs', 'workout_entries', 'body_measurements']
    if (!allowedTables.includes(tableName)) return

    setMessage('')
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', session.user.id)

    if (error) {
      setMessage(`Export failed: ${error.message}`)
      return
    }
    if (!data?.length) {
      setMessage(`There are no records to export from ${tableName}.`)
      return
    }

    const columns = [...new Set(data.flatMap((row) => Object.keys(row)))]
    const csv = [
      columns.map(csvCell).join(','),
      ...data.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
    ].join('\r\n')

    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${tableName}-${localDateString()}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setMessage(`Exported ${data.length} records from ${tableName}.`)
  }

  const lastSevenLogs = summaryLogs.filter((item) => item.log_date >= dateDaysAgo(6))
  const previousSevenLogs = summaryLogs.filter((item) => item.log_date < dateDaysAgo(6))

  function averageOf(items, field) {
    const values = items
      .map((item) => item[field])
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map(Number)
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  }

  const currentWeightAverage = averageOf(lastSevenLogs, 'weight_lb')
  const previousWeightAverage = averageOf(previousSevenLogs, 'weight_lb')
  const currentCalorieAverage = averageOf(lastSevenLogs, 'calories')
  const weightChange = currentWeightAverage !== null && previousWeightAverage !== null
    ? currentWeightAverage - previousWeightAverage
    : null

  const filteredHistoryLogs = useMemo(
    () => historyLogs.filter((item) => item.log_date >= historyFrom && item.log_date <= historyTo),
    [historyLogs, historyFrom, historyTo],
  )
  const filteredHistoryWorkouts = useMemo(
    () => historyWorkouts.filter((item) => item.workout_date >= historyFrom && item.workout_date <= historyTo),
    [historyWorkouts, historyFrom, historyTo],
  )
  const filteredHistoryMeasurements = useMemo(
    () => historyMeasurements.filter((item) => item.measurement_date >= historyFrom && item.measurement_date <= historyTo),
    [historyMeasurements, historyFrom, historyTo],
  )

  if (authLoading) {
    return <main className="app-shell"><p>Loading your tracker…</p></main>
  }

  if (!session?.user) {
    return (
      <main className="app-shell auth-shell">
        <section className="panel auth-panel">
          <h1>My Progress Tracker</h1>
          <p>Sign in to access your personal fitness records.</p>
          <form onSubmit={signIn} className="form-grid">
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </label>
            <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>My Progress Tracker</h1>
          <p>Track your nutrition, workouts, measurements, and progress over time.</p>
        </div>
        <button type="button" className="secondary-button" onClick={signOut}>Sign out</button>
      </header>

      <nav className="app-tabs" aria-label="Tracker sections">
        {['Daily log', 'Workouts', 'Measurements', 'History'].map((tab) => (
          <button
            type="button"
            key={tab}
            className={activeTab === tab ? 'tab-button active' : 'tab-button'}
            onClick={() => { setActiveTab(tab); setMessage('') }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'Daily log' && (
        <section className="panel">
          <h2>Daily log</h2>
          <p>Select any date to add a new log or update a previously saved one.</p>
          <div className="date-field">
            <label>
              Log date
              <input type="date" value={logDate} max={localDateString()} onChange={(event) => setLogDate(event.target.value)} />
            </label>
          </div>

          <form onSubmit={saveDailyLog} className="form-grid">
            <label>Weight (lb)
              <input type="number" min="0" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} />
            </label>
            <label>Calories
              <input type="number" min="0" step="1" value={calories} onChange={(event) => setCalories(event.target.value)} />
            </label>
            <label>Protein (g)
              <input type="number" min="0" step="1" value={protein} onChange={(event) => setProtein(event.target.value)} />
            </label>
            <label>Sleep (hours)
              <input type="number" min="0" max="24" step="0.25" value={sleep} onChange={(event) => setSleep(event.target.value)} />
            </label>
            <label>Water (liters)
              <input type="number" min="0" step="0.1" value={water} onChange={(event) => setWater(event.target.value)} />
            </label>
            <label>Training
              <select value={trainingType} onChange={(event) => setTrainingType(event.target.value)}>
                <option>Workout A</option>
                <option>Workout B</option>
                <option>Abs</option>
                <option>Rest / Recovery</option>
              </select>
            </label>
            <label className="full-width">Notes
              <textarea rows="3" value={logNotes} onChange={(event) => setLogNotes(event.target.value)} placeholder="Energy, appetite, digestion, or anything worth tracking" />
            </label>
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : `Save log for ${formatDate(logDate)}`}</button>
          </form>

          <div className="metric-grid">
            <div className="metric-card"><span>7-day average weight</span><strong>{currentWeightAverage === null ? '—' : `${currentWeightAverage.toFixed(1)} lb`}</strong></div>
            <div className="metric-card"><span>Weight change vs previous 7 days</span><strong>{weightChange === null ? '—' : `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} lb`}</strong></div>
            <div className="metric-card"><span>7-day average calories</span><strong>{currentCalorieAverage === null ? '—' : Math.round(currentCalorieAverage).toLocaleString()}</strong></div>
            <div className="metric-card"><span>Workout days in last 7 days</span><strong>{weeklyWorkoutDays}</strong></div>
          </div>

          <div className="chart-panel">
            <h3>Weight history</h3>
            {dailyLogs.some((item) => item.weight_lb !== null) ? (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={dailyLogs.filter((item) => item.weight_lb !== null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="log_date" tickFormatter={(value) => value.slice(5)} />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip labelFormatter={(value) => formatDate(value)} />
                    <Line type="monotone" dataKey="weight_lb" name="Weight (lb)" stroke="#2563eb" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <p>No weight records yet. Add a weight to begin your chart.</p>}
          </div>
        </section>
      )}

      {activeTab === 'Workouts' && (
        <section className="panel">
          <h2>Workout tracker</h2>
          <p>Select the date you trained. You can save multiple exercises for the same date.</p>
          <div className="date-field">
            <label>Workout date
              <input type="date" value={workoutDate} max={localDateString()} onChange={(event) => { setWorkoutDate(event.target.value); setEditingWorkoutId(null) }} />
            </label>
          </div>

          <div className="schedule-grid">
            {WORKOUT_SCHEDULE.map(([day, plan]) => <div className="schedule-item" key={day}><strong>{day}</strong><span>{plan}</span></div>)}
          </div>
          <p className="small-note">Alternate the three training days each week: A/B/A, then B/A/B. Start with 1–2 sets, 8–12 reps where applicable, and rest 60–120 seconds between sets.</p>

          <div className="exercise-guide">
            <h3>Exercise guide</h3>
            <div className="guide-columns">
              {Object.entries(EXERCISES).map(([type, list]) => (
                <div key={type}>
                  <h4>{type}</h4>
                  <ul>{list.map((item) => <li key={item.name}><strong>{item.name}</strong><span>{item.band}; {item.sets} sets, {item.reps} reps</span></li>)}</ul>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={saveWorkout} className="form-grid">
            <label>Workout type
              <select value={workoutType} onChange={(event) => chooseWorkoutType(event.target.value)}>
                <option>Workout A</option>
                <option>Workout B</option>
              </select>
            </label>
            <label>Exercise
              <select value={exerciseName} onChange={(event) => chooseExercise(event.target.value)}>
                {EXERCISES[workoutType].map((item) => <option key={item.name}>{item.name}</option>)}
              </select>
            </label>
            <label>Band setup / resistance
              <input value={bandSetup} onChange={(event) => setBandSetup(event.target.value)} placeholder="e.g. 3–10 lb band" />
            </label>
            <label>Sets
              <input type="number" min="0" step="1" value={sets} onChange={(event) => setSets(event.target.value)} />
            </label>
            <label>Reps
              <input value={reps} onChange={(event) => setReps(event.target.value)} placeholder="e.g. 8–12 or 10 per leg" />
            </label>
            <label className="full-width">Notes
              <textarea rows="2" value={workoutNotes} onChange={(event) => setWorkoutNotes(event.target.value)} placeholder="How it felt, form, or resistance changes" />
            </label>
            <div className="button-row">
              <button type="submit" disabled={busy}>{busy ? 'Saving…' : editingWorkoutId ? 'Update exercise' : 'Save exercise'}</button>
              {editingWorkoutId && <button type="button" className="secondary-button" onClick={resetWorkoutForm}>Cancel edit</button>}
            </div>
          </form>

          <h3>Entries for {formatDate(workoutDate)}</h3>
          {workoutEntries.length === 0 ? <p>No exercises saved for this date yet.</p> : (
            <div className="entry-list">
              {workoutEntries.map((entry) => (
                <article className="entry-card" key={entry.id}>
                  <div>
                    <h4>{entry.exercise_name}</h4>
                    <p>{entry.workout_type} · {showValue(entry.sets, ' sets')} · {showValue(entry.reps, ' reps')}</p>
                    {entry.band_setup && <p>Band setup: {entry.band_setup}</p>}
                    {entry.notes && <p>{entry.notes}</p>}
                  </div>
                  <div className="button-row">
                    <button type="button" className="secondary-button" onClick={() => editWorkout(entry)}>Edit</button>
                    <button type="button" className="danger-button" onClick={() => deleteWorkout(entry)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'Measurements' && (
        <section className="panel">
          <h2>Body measurements</h2>
          <p>Choose the date you measured. Saving again on the same date updates that record.</p>
          <div className="date-field">
            <label>Measurement date
              <input type="date" value={measurementDate} max={localDateString()} onChange={(event) => setMeasurementDate(event.target.value)} />
            </label>
          </div>
          <form onSubmit={saveMeasurements} className="form-grid">
            <label>Waist (in)
              <input type="number" min="0" step="0.1" value={waist} onChange={(event) => setWaist(event.target.value)} />
            </label>
            <label>Chest (in)
              <input type="number" min="0" step="0.1" value={chest} onChange={(event) => setChest(event.target.value)} />
            </label>
            <label>Upper arm (in)
              <input type="number" min="0" step="0.1" value={upperArm} onChange={(event) => setUpperArm(event.target.value)} />
            </label>
            <label>Thigh (in)
              <input type="number" min="0" step="0.1" value={thigh} onChange={(event) => setThigh(event.target.value)} />
            </label>
            <label className="full-width">Notes
              <textarea rows="2" value={measurementNotes} onChange={(event) => setMeasurementNotes(event.target.value)} placeholder="Optional notes" />
            </label>
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : `Save measurements for ${formatDate(measurementDate)}`}</button>
          </form>

          <h3>Measurement history</h3>
          {measurements.length === 0 ? <p>No measurements saved yet.</p> : (
            <div className="table-scroll">
              <table className="measurement-table">
                <thead><tr><th>Date</th><th>Waist</th><th>Chest</th><th>Upper arm</th><th>Thigh</th><th>Notes</th></tr></thead>
                <tbody>{measurements.map((item) => (
                  <tr key={item.id}>
                    <td><button type="button" className="text-button" onClick={() => setMeasurementDate(item.measurement_date)}>{formatDate(item.measurement_date)}</button></td>
                    <td>{showValue(item.waist_in, ' in')}</td>
                    <td>{showValue(item.chest_in, ' in')}</td>
                    <td>{showValue(item.upper_arm_in, ' in')}</td>
                    <td>{showValue(item.thigh_in, ' in')}</td>
                    <td>{item.notes || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'History' && (
        <section className="panel">
          <h2>Combined history</h2>
          <p>View daily logs, workout entries, and body measurements together. Select a date range below.</p>
          <div className="history-filters">
            <label>From
              <input type="date" value={historyFrom} max={historyTo || localDateString()} onChange={(event) => setHistoryFrom(event.target.value)} />
            </label>
            <label>To
              <input type="date" value={historyTo} min={historyFrom} max={localDateString()} onChange={(event) => setHistoryTo(event.target.value)} />
            </label>
            <button type="button" className="secondary-button" onClick={() => { setHistoryFrom(dateDaysAgo(30)); setHistoryTo(localDateString()) }}>Last 30 days</button>
            <button type="button" className="secondary-button" onClick={() => { setHistoryFrom('2000-01-01'); setHistoryTo(localDateString()) }}>All history</button>
          </div>

          <div className="history-section">
            <h3>Daily logs ({filteredHistoryLogs.length})</h3>
            {filteredHistoryLogs.length === 0 ? <p>No daily logs in this date range.</p> : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Date</th><th>Weight</th><th>Calories</th><th>Protein</th><th>Training</th><th>Sleep</th><th>Water</th><th>Notes</th></tr></thead>
                  <tbody>{filteredHistoryLogs.map((item) => (
                    <tr key={item.id}>
                      <td><button type="button" className="text-button" onClick={() => { setLogDate(item.log_date); setActiveTab('Daily log') }}>{formatDate(item.log_date)}</button></td>
                      <td>{showValue(item.weight_lb, ' lb')}</td>
                      <td>{showValue(item.calories)}</td>
                      <td>{showValue(item.protein_g, ' g')}</td>
                      <td>{item.training_type || '—'}</td>
                      <td>{showValue(item.sleep_hours, ' h')}</td>
                      <td>{showValue(item.water_l, ' L')}</td>
                      <td>{item.notes || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          <div className="history-section">
            <h3>Workout entries ({filteredHistoryWorkouts.length})</h3>
            {filteredHistoryWorkouts.length === 0 ? <p>No workout entries in this date range.</p> : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Date</th><th>Workout</th><th>Exercise</th><th>Band setup</th><th>Sets</th><th>Reps</th><th>Notes</th><th>Actions</th></tr></thead>
                  <tbody>{filteredHistoryWorkouts.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.workout_date)}</td><td>{item.workout_type}</td><td>{item.exercise_name}</td>
                      <td>{item.band_setup || '—'}</td><td>{showValue(item.sets)}</td><td>{item.reps || '—'}</td><td>{item.notes || '—'}</td>
                      <td><div className="button-row"><button type="button" className="secondary-button" onClick={() => editWorkout(item)}>Edit</button><button type="button" className="danger-button" onClick={() => deleteWorkout(item)}>Delete</button></div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          <div className="history-section">
            <h3>Body measurements ({filteredHistoryMeasurements.length})</h3>
            {filteredHistoryMeasurements.length === 0 ? <p>No measurements in this date range.</p> : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Date</th><th>Waist</th><th>Chest</th><th>Upper arm</th><th>Thigh</th><th>Notes</th></tr></thead>
                  <tbody>{filteredHistoryMeasurements.map((item) => (
                    <tr key={item.id}>
                      <td><button type="button" className="text-button" onClick={() => { setMeasurementDate(item.measurement_date); setActiveTab('Measurements') }}>{formatDate(item.measurement_date)}</button></td>
                      <td>{showValue(item.waist_in, ' in')}</td><td>{showValue(item.chest_in, ' in')}</td>
                      <td>{showValue(item.upper_arm_in, ' in')}</td><td>{showValue(item.thigh_in, ' in')}</td><td>{item.notes || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          <div className="export-panel">
            <h3>Download your data</h3>
            <p>Export each section as a CSV file you can open in Excel or Google Sheets.</p>
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={() => exportTable('daily_logs')}>Export daily logs CSV</button>
              <button type="button" className="secondary-button" onClick={() => exportTable('workout_entries')}>Export workouts CSV</button>
              <button type="button" className="secondary-button" onClick={() => exportTable('body_measurements')}>Export measurements CSV</button>
            </div>
          </div>
        </section>
      )}

      {message && <div className="notice" role="status">{message}</div>}
    </main>
  )
}
