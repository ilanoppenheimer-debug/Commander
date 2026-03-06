import { useState } from "react";

export const useTrainingState = () => {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);

  const startSession = () => {
    setCurrentSession({
      startedAt: new Date(),
      exercises: []
    });
  };

  const finishSession = () => {
    if (!currentSession) return;
    setSessions(prev => [...prev, currentSession]);
    setCurrentSession(null);
  };

  return {
    sessions,
    currentSession,
    startSession,
    finishSession
  };
};