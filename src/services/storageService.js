export const saveSessions = (sessions) => {
  localStorage.setItem("sessions", JSON.stringify(sessions));
};

export const loadSessions = () => {
  const data = localStorage.getItem("sessions");
  return data ? JSON.parse(data) : [];
};