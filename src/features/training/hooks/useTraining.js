import { useState, useEffect } from "react";
import { saveSessions, loadSessions } from "@/services/storageService";

export const useTraining = () => {

  const [sessions, setSessions] = useState(() => loadSessions());
  const [currentSession, setCurrentSession] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const startSession = () => {
    setCurrentSession({
      startedAt: new Date(),
      exercises: []
    });
  };

  const finishSession = () => {
    if (!currentSession) return;
    setSessions(prev => [...prev, { ...currentSession, completedAt: new Date() }]);
    setCurrentSession(null);
  };

  const addExercise = (exerciseName) => {
    if (!currentSession) return;

    setCurrentSession(prev => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        { name: exerciseName, sets: [] }
      ]
    }));
  };

  const addSet = (exerciseIndex, setData) => {
    setCurrentSession(prev => {
      const updated = { ...prev };
      updated.exercises[exerciseIndex].sets.push(setData);
      return updated;
    });
  };

  return {
    sessions,
    currentSession,
    selectedExercise,
    setSelectedExercise,
    startSession,
    finishSession,
    addExercise,
    addSet
  };
};