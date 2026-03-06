import {
  Dumbbell,
  Shield,
  Layers,
  Activity,
  Target,
  Zap,
  LayoutGrid
} from "lucide-react";

export const getExerciseDetails = (name) => {
  if (!name)
    return {
      icon: <Dumbbell size={18} />,
      label: "General"
    };

  const n = name.toLowerCase();

  if (n.includes("press") || n.includes("pecho"))
    return { icon: <Shield size={18} />, label: "Pecho" };

  if (n.includes("remo") || n.includes("espalda"))
    return { icon: <Layers size={18} />, label: "Espalda" };

  if (n.includes("sentadilla") || n.includes("pierna"))
    return { icon: <Activity size={18} />, label: "Piernas" };

  if (n.includes("hombro"))
    return { icon: <Target size={18} />, label: "Hombros" };

  if (n.includes("curl") || n.includes("brazo"))
    return { icon: <Zap size={18} />, label: "Brazos" };

  if (n.includes("core") || n.includes("plancha"))
    return { icon: <LayoutGrid size={18} />, label: "Core" };

  return { icon: <Dumbbell size={18} />, label: "General" };
};