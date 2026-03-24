import { EXERCISE_TO_MUSCLE } from "../constants/gymConstants";

export const analyzeWorkout = (routine) => {

  const volume = {};

  routine.exercises.forEach(ex => {

    const muscle = EXERCISE_TO_MUSCLE[ex.name] || "other";

    if (!volume[muscle]) volume[muscle] = 0;

    volume[muscle] += ex.sets?.length || 0;

  });

  return volume;

};