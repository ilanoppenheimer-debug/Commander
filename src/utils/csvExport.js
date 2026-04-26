const HEADERS = [
  "historyId",
  "completedAt",
  "sessionName",
  "exerciseName",
  "equipment",
  "setIndex",
  "setType",
  "weight",
  "reps",
  "rpe",
];

const escapeCell = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

export const historyToCSV = (history) => {
  const rows = [HEADERS.join(",")];
  const safeHistory = Array.isArray(history) ? history : [];

  safeHistory.forEach((session) => {
    if (!session) return;
    const exercises = Array.isArray(session.exercises) ? session.exercises : [];

    if (exercises.length === 0) {
      rows.push(
        [
          session.historyId || "",
          session.completedAt || "",
          session.name || "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]
          .map(escapeCell)
          .join(",")
      );
      return;
    }

    exercises.forEach((ex) => {
      if (!ex) return;
      const sets = Array.isArray(ex.sets) ? ex.sets : [];

      if (sets.length === 0) {
        rows.push(
          [
            session.historyId || "",
            session.completedAt || "",
            session.name || "",
            ex.name || "",
            ex.equipment || "",
            "",
            "",
            "",
            "",
            "",
          ]
            .map(escapeCell)
            .join(",")
        );
        return;
      }

      sets.forEach((set, i) => {
        rows.push(
          [
            session.historyId || "",
            session.completedAt || "",
            session.name || "",
            ex.name || "",
            ex.equipment || "",
            i,
            set?.type || "normal",
            set?.weight ?? "",
            set?.reps ?? "",
            set?.rpe ?? "",
          ]
            .map(escapeCell)
            .join(",")
        );
      });
    });
  });

  return rows.join("\n");
};

const parseCSVRow = (line) => {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
};

export const csvToHistory = (csvText) => {
  if (typeof csvText !== "string" || !csvText.trim()) return [];

  const lines = csvText.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const header = parseCSVRow(lines[0]).map((h) => h.trim());
  const idx = (name) => header.indexOf(name);

  const iHist = idx("historyId");
  const iDate = idx("completedAt");
  const iName = idx("sessionName");
  const iEx = idx("exerciseName");
  const iEq = idx("equipment");
  const iSetIdx = idx("setIndex");
  const iType = idx("setType");
  const iWeight = idx("weight");
  const iReps = idx("reps");
  const iRpe = idx("rpe");

  if (iHist < 0 || iEx < 0) return [];

  const sessionsMap = new Map();

  for (let r = 1; r < lines.length; r++) {
    const row = parseCSVRow(lines[r]);
    const historyId = row[iHist];
    if (!historyId) continue;

    if (!sessionsMap.has(historyId)) {
      sessionsMap.set(historyId, {
        historyId,
        completedAt: row[iDate] || null,
        name: row[iName] || "Entrenamiento Importado",
        exercises: [],
      });
    }

    const session = sessionsMap.get(historyId);
    const exName = row[iEx];
    if (!exName) continue;

    let exercise = session.exercises.find(
      (e) => e.name === exName && e.equipment === (row[iEq] || "barbell")
    );
    if (!exercise) {
      exercise = {
        id: `${historyId}-${exName}-${session.exercises.length}`,
        name: exName,
        equipment: row[iEq] || "barbell",
        sets: [],
      };
      session.exercises.push(exercise);
    }

    const weight = parseFloat(row[iWeight]);
    const reps = parseFloat(row[iReps]);
    const rpe = parseFloat(row[iRpe]);

    // Skip rows where both weight and reps are unparseable (corrupted)
    if (!Number.isFinite(weight) && !Number.isFinite(reps)) {
      console.warn(`CSV import: skipping corrupted row ${r} (weight="${row[iWeight]}" reps="${row[iReps]}")`);
      continue;
    }

    exercise.sets.push({
      type: row[iType] || "normal",
      weight: Number.isFinite(weight) && weight >= 0 ? weight : 0,
      reps: Number.isFinite(reps) && reps >= 0 ? Math.round(reps) : 0,
      rpe: Number.isFinite(rpe) && rpe >= 0 && rpe <= 10 ? rpe : 0,
    });
  }

  return Array.from(sessionsMap.values());
};

export const downloadCSV = (csvText, filename) => {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
