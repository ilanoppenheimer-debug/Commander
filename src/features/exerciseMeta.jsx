import React from "react";
import { Dumbbell } from "lucide-react";
import { ChestIcon, BackIcon, LegsIcon, ShouldersIcon, ArmsIcon, CoreIcon } from '../components/icons/MuscleIcons';

export const getExerciseDetails = (name) => {
  if (!name) {
    return { icon: <Dumbbell size={18} />, color: "text-slate-400", bg: "bg-slate-800", border: "border-slate-700", label: "General", dotBg: "bg-slate-500" };
  }

  const n = String(name).toLowerCase();

  // BACK — check before chest so "jalón al pecho" resolves as back, not chest
  if (n.includes("remo") || n.includes("dominada") || n.includes("jalón") || n.includes("jalon") || n.includes("pulldown") || n.includes("espalda") || n.includes("pull-over")) {
    return { icon: <BackIcon size={18} />, color: "text-red-500", bg: "bg-red-900/20", border: "border-red-500/30", label: "Espalda", dotBg: "bg-red-500" };
  }

  if (n.includes("press banca") || n.includes("pecho") || n.includes("aperturas") || n.includes("cruce") || n.includes("fondo") || n.includes("push")) {
    return { icon: <ChestIcon size={18} />, color: "text-sky-400", bg: "bg-sky-900/20", border: "border-sky-500/30", label: "Pecho", dotBg: "bg-sky-400" };
  }

  // LEGS — deadlifts are posterior chain / leg day in powerlifting context
  if (n.includes("sentadilla") || n.includes("squat") || n.includes("prensa") || n.includes("pierna") || n.includes("femoral") || n.includes("gemelo") || n.includes("thrust") || n.includes("hack") || n.includes("búlgara") || n.includes("bulgara") || n.includes("cuádriceps") || n.includes("cuadriceps") || n.includes("peso muerto") || n.includes("deadlift") || n.includes("rdl") || n.includes("rumano") || n.includes("buenos días") || n.includes("buenos dias")) {
    return { icon: <LegsIcon size={18} />, color: "text-amber-500", bg: "bg-amber-900/20", border: "border-amber-500/30", label: "Piernas", dotBg: "bg-amber-500" };
  }

  // SHOULDERS — facepull, rear delt, laterals
  if (n.includes("militar") || n.includes("lateral") || n.includes("pájaro") || n.includes("pajaro") || n.includes("hombro") || n.includes("encogimiento") || n.includes("facepull") || n.includes("face pull") || n.includes("rear delt")) {
    return { icon: <ShouldersIcon size={18} />, color: "text-purple-400", bg: "bg-purple-900/20", border: "border-purple-500/30", label: "Hombros", dotBg: "bg-purple-400" };
  }

  if (n.includes("curl") || n.includes("bíceps") || n.includes("biceps") || n.includes("tríceps") || n.includes("triceps") || n.includes("brazo") || n.includes("rompecráneos") || n.includes("rompecraneos") || n.includes("francés") || n.includes("frances") || n.includes("skull")) {
    return { icon: <ArmsIcon size={18} />, color: "text-blue-400", bg: "bg-blue-900/20", border: "border-blue-500/30", label: "Brazos", dotBg: "bg-blue-400" };
  }

  if (n.includes("plancha") || n.includes("abdominal") || n.includes("crunch") || n.includes("core")) {
    return { icon: <CoreIcon size={18} />, color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-500/30", label: "Core", dotBg: "bg-emerald-400" };
  }

  return { icon: <Dumbbell size={18} />, color: "text-slate-400", bg: "bg-slate-800", border: "border-slate-700", label: "General", dotBg: "bg-slate-500" };
};
