import { catalogMuscleFor } from "../constants/gymConstants";

export const analyzeWorkout = (routine) => {
  const exercises = Array.isArray(routine?.exercises) ? routine.exercises : [];

  const volume = {};

  exercises.forEach(ex => {

    const muscle = catalogMuscleFor(ex.name) || "other";

    if (!volume[muscle]) volume[muscle] = 0;

    volume[muscle] += ex.sets?.length || 0;

  });

  return volume;

};
