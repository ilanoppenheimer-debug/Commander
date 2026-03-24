import React, { useState } from "react";
import { Dumbbell, X, Search, Plus } from "lucide-react";
import { MUSCLE_GROUPS, EXERCISE_CATEGORIES } from "../../constants/gymConstants";

const ExerciseSelectorModal = ({
  onClose,
  onSelect,
  customExercises,
  setCustomExercises
}) => {

  const [search, setSearch] = useState("");
  const [newExercise, setNewExercise] = useState("");
  const [muscle, setMuscle] = useState("chest");
  const [openGroup, setOpenGroup] = useState(null);

  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("favoriteExercises");
    return saved ? JSON.parse(saved) : [];
  });

  const [usageStats, setUsageStats] = useState(() => {
    const saved = localStorage.getItem("exerciseUsage");
    return saved ? JSON.parse(saved) : {};
  });

  const toggleFavorite = (exercise) => {

    let updated;

    if (favorites.includes(exercise)) {
      updated = favorites.filter(e => e !== exercise);
    } else {
      updated = [...favorites, exercise];
    }

    setFavorites(updated);
    localStorage.setItem("favoriteExercises", JSON.stringify(updated));

  };

  const registerUsage = (exercise) => {

    const updated = {
      ...usageStats,
      [exercise]: (usageStats[exercise] || 0) + 1
    };

    setUsageStats(updated);
    localStorage.setItem("exerciseUsage", JSON.stringify(updated));

  };

  const deleteExercise = (exerciseName, group) => {

    if (!confirm("Eliminar ejercicio?")) return;

    const updated = {
      ...customExercises,
      [group]: (customExercises[group] || []).filter(e => e !== exerciseName)
    };

    setCustomExercises(updated);

  };

  const addCustomExercise = () => {

    if (!newExercise.trim()) return;

    const updated = {
      ...customExercises,
      [muscle]: [...(customExercises[muscle] || []), newExercise]
    };

    setCustomExercises(updated);
    setNewExercise("");

  };

  const mostUsed = Object.entries(usageStats)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5)
    .map(e=>e[0]);

  const groupedExercises = [

    ["mostUsed", mostUsed],
    ["favorites", favorites],

    ...Object.entries(EXERCISE_CATEGORIES).map(
      ([group, exercises]) => [
        group,
        [
          ...exercises,
          ...((customExercises && customExercises[group]) || [])
        ]
      ]
    )

  ];

  return (

    <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center p-4 z-[9999]">

      <div className="bg-slate-900 w-full max-w-md rounded-xl border border-slate-700 p-4">

        <div className="flex items-center justify-between mb-4">

          <h2 className="text-white font-bold flex items-center gap-2">
            <Dumbbell size={18}/> Seleccionar Ejercicio
          </h2>

          <button onClick={onClose}>
            <X className="text-slate-400 hover:text-white"/>
          </button>

        </div>

        <div className="flex items-center gap-2 bg-slate-800 rounded p-2 mb-3">
          <Search size={16} className="text-slate-400"/>

          <input
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            placeholder="Buscar ejercicio..."
            className="bg-transparent outline-none text-white flex-1 text-sm"
          />
        </div>

        <div className="max-h-64 overflow-y-auto flex flex-col gap-2 mb-3">

          {groupedExercises.map(([group, exercises]) => {

            const isOpen = openGroup === group;

            const filtered = exercises.filter(e =>
              e.toLowerCase().includes(search.toLowerCase())
            );

            if (search && filtered.length === 0) return null;
            if (!filtered.length) return null;

            const title =
              group === "favorites"
                ? "⭐ FAVORITOS"
                : group === "mostUsed"
                ? "🔥 MÁS USADOS"
                : group.toUpperCase();

            return (

              <div key={group} className="bg-slate-800 rounded">

                <button
                  onClick={()=>setOpenGroup(isOpen ? null : group)}
                  className="w-full text-left px-3 py-2 font-semibold text-slate-200 hover:bg-slate-700 rounded"
                >
                  {title}
                </button>

                {isOpen && (

                  <div className="flex flex-col">

                    {filtered.map((name,i)=>{

                      const isCustom =
                        (customExercises[group] || []).includes(name);

                      return (

                        <div
                          key={i}
                          className="flex items-center justify-between border-t border-slate-700"
                        >

                          <button
                            onClick={()=>{
                              registerUsage(name);
                              onSelect(name);
                              onClose();
                            }}
                            className="flex-1 text-left px-3 py-2 text-sm text-white hover:bg-slate-700"
                          >
                            {name}
                          </button>

                          <button
                            onClick={()=>toggleFavorite(name)}
                            className="px-2 text-yellow-400 hover:text-yellow-300"
                          >
                            {favorites.includes(name) ? "★" : "☆"}
                          </button>

                          {isCustom && (
                            <button
                              onClick={()=>deleteExercise(name,group)}
                              className="px-3 text-red-400 hover:text-red-300"
                            >
                              🗑
                            </button>
                          )}

                        </div>

                      )

                    })}

                  </div>

                )}

              </div>

            )

          })}

        </div>

        <div className="flex gap-2">

          <input
            value={newExercise}
            onChange={(e)=>setNewExercise(e.target.value)}
            placeholder="Agregar ejercicio..."
            className="flex-1 bg-slate-800 text-white p-2 rounded text-sm"
          />

          <select
            value={muscle}
            onChange={(e)=>setMuscle(e.target.value)}
            className="bg-slate-800 text-white p-2 rounded text-sm"
          >
            {MUSCLE_GROUPS.map(m=>(
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <button
            onClick={addCustomExercise}
            className="bg-purple-600 px-3 rounded flex items-center justify-center"
          >
            <Plus size={16}/>
          </button>

        </div>

      </div>

    </div>

  );

};

export default ExerciseSelectorModal;