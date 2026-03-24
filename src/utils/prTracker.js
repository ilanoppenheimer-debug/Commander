export const updatePR = (exercise, weight, reps) => {

  const key = `pr_${exercise}`

  const existing = JSON.parse(localStorage.getItem(key) || "0")

  const score = weight * reps

  if (score > existing) {
    localStorage.setItem(key, JSON.stringify(score))
    return true
  }

  return false
}

const isPR = updatePR(exercise, weight, reps)

if(isPR){
  console.log("🔥 NUEVO PR")
}